import { Midi } from '@tonejs/midi';

/**
 * Robust MIDI file loading.
 *
 * Real-world failures this layer handles (all seen with files produced by
 * Audio-to-MIDI tools and phone file pickers):
 *  - iOS/Android hand back a File whose blob cannot be read with
 *    file.arrayBuffer() (iCloud placeholder / revoked content URI) -> the OS
 *    shows "The file '1.mid' could not be opened".
 *  - RMID containers (RIFF....RMIDdata<SMF>) written by some exporters.
 *  - Junk / ID3 bytes prepended before the real "MThd" chunk.
 *  - Files truncated mid-write: last track missing its End-of-Track meta event,
 *    or a track length field longer than the bytes actually present.
 *  - Type 0 / 1 / 2 files (all are valid SMF and must be accepted).
 */

export type MidiLoadErrorCode =
  | 'EMPTY_FILE'
  | 'UNREADABLE'
  | 'NOT_MIDI'
  | 'NO_TRACKS'
  | 'NO_NOTES'
  | 'PARSE_FAILED';

export class MidiLoadError extends Error {
  code: MidiLoadErrorCode;
  detail: string;
  constructor(code: MidiLoadErrorCode, message: string, detail = '') {
    super(message);
    this.name = 'MidiLoadError';
    this.code = code;
    this.detail = detail;
  }
}

const MESSAGES: Record<MidiLoadErrorCode, string> = {
  EMPTY_FILE: 'הקובץ ריק (0 בייטים) — הייצוא כנראה נקטע. נסו לייצא שוב.',
  UNREADABLE: 'לא ניתן לקרוא את הקובץ מהמכשיר. אם הקובץ ב-iCloud/Drive — הורידו אותו למכשיר ונסו שוב.',
  NOT_MIDI: 'זה לא קובץ MIDI תקין (חסרה כותרת MThd).',
  NO_TRACKS: 'קובץ ה-MIDI לא מכיל אף טראק.',
  NO_NOTES: 'קובץ ה-MIDI נפתח אך אין בו תווים לנגן.',
  PARSE_FAILED: 'מבנה קובץ ה-MIDI פגום ולא ניתן לפענוח.',
};

export interface MidiLoadResult {
  midi: Midi;
  info: {
    fileName: string;
    bytes: number;
    ppq: number;
    format: number | 'unknown';
    tracks: number;
    notes: number;
    repaired: string[];
  };
}

/** Reads the File into an ArrayBuffer, with a FileReader fallback for phones. */
async function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (!file) throw new MidiLoadError('UNREADABLE', MESSAGES.UNREADABLE, 'no file handle');
  if (file.size === 0) throw new MidiLoadError('EMPTY_FILE', MESSAGES.EMPTY_FILE, `${file.name} is 0 bytes`);

  try {
    const buf = await file.arrayBuffer();
    if (buf.byteLength > 0) return buf;
  } catch (err: any) {
    console.warn('[MIDI] file.arrayBuffer() failed, falling back to FileReader', err);
  }

  // Safari/iOS sometimes only succeeds through FileReader
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result;
      if (res instanceof ArrayBuffer && res.byteLength > 0) resolve(res);
      else reject(new MidiLoadError('UNREADABLE', MESSAGES.UNREADABLE, 'FileReader returned no data'));
    };
    reader.onerror = () => reject(new MidiLoadError('UNREADABLE', MESSAGES.UNREADABLE, String(reader.error?.name || 'FileReader error')));
    reader.readAsArrayBuffer(file);
  });
}

const ascii = (bytes: Uint8Array, at: number, len: number) => {
  let s = '';
  for (let i = at; i < at + len && i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
};

const readU32 = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;

/** Finds the SMF payload inside RMID containers or after junk/ID3 headers. */
function extractSmf(bytes: Uint8Array, repaired: string[]): Uint8Array {
  if (ascii(bytes, 0, 4) === 'MThd') return bytes;

  // RIFF....RMID + "data" chunk wrapper
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'RMID') {
    for (let i = 12; i < bytes.length - 8; i += 2) {
      if (ascii(bytes, i, 4) === 'data') {
        repaired.push('unwrapped RMID container');
        return bytes.subarray(i + 8);
      }
    }
  }

  // ID3 tag or arbitrary junk before the header: scan for the magic
  const limit = Math.min(bytes.length - 4, 1 << 16);
  for (let i = 1; i < limit; i++) {
    if (bytes[i] === 0x4d && bytes[i + 1] === 0x54 && bytes[i + 2] === 0x68 && bytes[i + 3] === 0x64) {
      repaired.push(`skipped ${i} junk bytes before MThd`);
      return bytes.subarray(i);
    }
  }
  return bytes;
}

/**
 * Repairs a truncated SMF so a strict parser can still read it:
 *  - clamps track length fields that exceed the remaining bytes
 *  - appends the End-of-Track meta event when it is missing
 *  - drops a trailing partial track and fixes the track count in the header
 */
function repairTruncated(smf: Uint8Array, repaired: string[]): Uint8Array {
  if (ascii(smf, 0, 4) !== 'MThd') return smf;

  const headerLen = readU32(smf, 4);
  let pos = 8 + headerLen;
  const chunks: Uint8Array[] = [];

  while (pos + 8 <= smf.length) {
    const id = ascii(smf, pos, 4);
    const len = readU32(smf, pos + 4);
    const dataStart = pos + 8;

    if (id !== 'MTrk') {
      // unknown chunk - skip if it fits, otherwise stop
      if (dataStart + len > smf.length) break;
      pos = dataStart + len;
      continue;
    }

    const available = smf.length - dataStart;
    if (len <= available) {
      const body = smf.subarray(dataStart, dataStart + len);
      const endsProperly = body.length >= 3 &&
        body[body.length - 3] === 0xff && body[body.length - 2] === 0x2f && body[body.length - 1] === 0x00;
      chunks.push(endsProperly ? body : appendEot(body, repaired));
      pos = dataStart + len;
    } else {
      // truncated final track - keep what exists and terminate it
      if (available > 0) {
        repaired.push(`clamped truncated track (declared ${len}B, found ${available}B)`);
        chunks.push(appendEot(smf.subarray(dataStart, smf.length), repaired));
      }
      break;
    }
  }

  if (!chunks.length) return smf;

  const header = smf.subarray(0, 8 + headerLen).slice();
  // rewrite the track count so it matches what we actually kept
  if (headerLen >= 6) {
    header[8 + 2] = (chunks.length >> 8) & 0xff;
    header[8 + 3] = chunks.length & 0xff;
  }

  let total = header.length;
  chunks.forEach((c) => { total += 8 + c.length; });
  const out = new Uint8Array(total);
  out.set(header, 0);
  let o = header.length;
  for (const c of chunks) {
    out[o] = 0x4d; out[o + 1] = 0x54; out[o + 2] = 0x72; out[o + 3] = 0x6b;
    out[o + 4] = (c.length >>> 24) & 0xff;
    out[o + 5] = (c.length >>> 16) & 0xff;
    out[o + 6] = (c.length >>> 8) & 0xff;
    out[o + 7] = c.length & 0xff;
    out.set(c, o + 8);
    o += 8 + c.length;
  }
  return out;
}

function appendEot(body: Uint8Array, repaired: string[]): Uint8Array {
  repaired.push('added missing End-of-Track marker');
  const out = new Uint8Array(body.length + 4);
  out.set(body, 0);
  out.set([0x00, 0xff, 0x2f, 0x00], body.length);
  return out;
}

const toArrayBuffer = (u8: Uint8Array): ArrayBuffer =>
  u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;

/**
 * Validates, repairs if needed, and parses a MIDI file.
 * Throws MidiLoadError with a precise code instead of a generic failure.
 */
export async function loadMidiFile(file: File): Promise<MidiLoadResult> {
  const buffer = await readArrayBuffer(file);
  const raw = new Uint8Array(buffer);
  const repaired: string[] = [];

  const smf = extractSmf(raw, repaired);
  if (ascii(smf, 0, 4) !== 'MThd') {
    throw new MidiLoadError(
      'NOT_MIDI',
      MESSAGES.NOT_MIDI,
      `Invalid header magic: expected "MThd", got "${ascii(smf, 0, 4)}" (0x${Array.from(smf.slice(0, 4)).map((b) => b.toString(16).padStart(2, '0')).join(' ')})`
    );
  }

  const format: number | 'unknown' = smf.length >= 10 ? ((smf[8] << 8) | smf[9]) : 'unknown';
  const declaredTracks = smf.length >= 12 ? (smf[10] << 8) | smf[11] : 0;

  // Count real MTrk chunks up front - a header-only file makes the parser throw
  // an opaque TypeError, and "no tracks" is a far more useful diagnosis.
  let mtrkCount = 0;
  for (let i = 0; i + 4 <= smf.length; i++) {
    if (smf[i] === 0x4d && smf[i + 1] === 0x54 && smf[i + 2] === 0x72 && smf[i + 3] === 0x6b) mtrkCount++;
  }
  if (mtrkCount === 0) {
    throw new MidiLoadError(
      'NO_TRACKS',
      MESSAGES.NO_TRACKS,
      `format=${format} declaredTracks=${declaredTracks} bytes=${raw.length} (no MTrk chunk found)`
    );
  }

  let midi: Midi | null = null;
  let firstError: any = null;
  for (const candidate of [smf, repairTruncated(smf, repaired)]) {
    try {
      midi = new Midi(toArrayBuffer(candidate));
      break;
    } catch (err) {
      firstError = firstError || err;
      console.warn('[MIDI] parse attempt failed', err);
    }
  }

  if (!midi) {
    throw new MidiLoadError(
      'PARSE_FAILED',
      MESSAGES.PARSE_FAILED,
      `format=${format} declaredTracks=${declaredTracks} bytes=${raw.length} :: ${firstError?.stack || firstError?.message || firstError}`
    );
  }

  if (!midi.tracks.length) {
    throw new MidiLoadError('NO_TRACKS', MESSAGES.NO_TRACKS, `format=${format} declaredTracks=${declaredTracks}`);
  }

  const notes = midi.tracks.reduce((sum, t) => sum + t.notes.length, 0);
  if (notes === 0) {
    throw new MidiLoadError('NO_NOTES', MESSAGES.NO_NOTES, `format=${format} tracks=${midi.tracks.length}`);
  }

  const info = {
    fileName: file.name,
    bytes: raw.length,
    ppq: midi.header.ppq || 480,
    format,
    tracks: midi.tracks.length,
    notes,
    repaired,
  };
  console.log('[MIDI] loaded', info);
  return { midi, info };
}

/** Human-readable reason for any error thrown while loading a MIDI file. */
export function describeMidiError(err: unknown): string {
  if (err instanceof MidiLoadError) {
    console.error(`[MIDI] ${err.code}: ${err.detail}`);
    return `${err.message}${err.detail ? `\n\n(${err.code}: ${err.detail})` : ''}`;
  }
  const e = err as any;
  console.error('[MIDI] unexpected failure', e?.stack || e);
  return `שגיאה בפתיחת הקובץ: ${e?.message || String(err)}`;
}
