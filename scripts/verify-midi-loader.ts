import { Midi } from '@tonejs/midi';
import { loadMidiFile, MidiLoadError } from '../services/midiFileService';

/**
 * Regression suite for "The file '1.mid' could not be opened".
 * Every case below is a real-world file shape that used to throw a generic
 * failure (or crash the importer).
 */

// Minimal File polyfill for Node
class NodeFile {
  name: string; size: number; type: string; private data: Uint8Array;
  constructor(data: Uint8Array, name: string, type = 'audio/midi') {
    this.data = data; this.name = name; this.type = type; this.size = data.byteLength;
  }
  async arrayBuffer() {
    return this.data.buffer.slice(this.data.byteOffset, this.data.byteOffset + this.data.byteLength);
  }
}
const asFile = (data: Uint8Array, name: string, type?: string) => new NodeFile(data, name, type) as unknown as File;

// ---------- fixtures -------------------------------------------------------
function buildMidi(opts: { format?: number; tracks?: number; ppq?: number } = {}) {
  const midi = new Midi();
  midi.header.setTempo(140);
  const trackCount = opts.tracks ?? 2;
  for (let t = 0; t < trackCount; t++) {
    const track = midi.addTrack();
    track.name = `part${t}`;
    for (let i = 0; i < 8; i++) {
      track.addNote({ midi: 60 + t * 7 + (i % 4), ticks: i * 240, durationTicks: 200, velocity: 0.8 });
    }
  }
  const bytes = new Uint8Array(midi.toArray());
  if (opts.format !== undefined) { bytes[8] = 0; bytes[9] = opts.format; }
  return bytes;
}

const withJunkPrefix = (smf: Uint8Array) => {
  const junk = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0, 0, 0, 0, 0x20, 0, 0, 0]); // fake ID3
  const out = new Uint8Array(junk.length + smf.length);
  out.set(junk, 0); out.set(smf, junk.length);
  return out;
};

const asRmid = (smf: Uint8Array) => {
  const out = new Uint8Array(12 + 8 + smf.length);
  const put = (s: string, at: number) => { for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i); };
  put('RIFF', 0);
  const riffLen = 4 + 8 + smf.length;
  out[4] = riffLen & 0xff; out[5] = (riffLen >> 8) & 0xff; out[6] = (riffLen >> 16) & 0xff; out[7] = (riffLen >> 24) & 0xff;
  put('RMID', 8); put('data', 12);
  out[16] = smf.length & 0xff; out[17] = (smf.length >> 8) & 0xff; out[18] = (smf.length >> 16) & 0xff; out[19] = (smf.length >> 24) & 0xff;
  out.set(smf, 20);
  return out;
};

// cut the file mid-track: declared length no longer matches, no End-of-Track
const truncated = (smf: Uint8Array) => smf.subarray(0, Math.floor(smf.length * 0.72));

// ---------- cases ----------------------------------------------------------
type Case = { name: string; file: File; expect: 'ok' } | { name: string; file: File; expect: string };

const cases: Case[] = [
  { name: 'Type 1 (multi-track)', file: asFile(buildMidi({ format: 1, tracks: 3 }), '1.mid'), expect: 'ok' },
  { name: 'Type 0 (single track)', file: asFile(buildMidi({ format: 0, tracks: 1 }), '1.mid'), expect: 'ok' },
  { name: 'Type 2', file: asFile(buildMidi({ format: 2, tracks: 2 }), '1.mid'), expect: 'ok' },
  { name: 'empty MIME type (phone picker)', file: asFile(buildMidi(), '1.mid', ''), expect: 'ok' },
  { name: 'RMID container', file: asFile(asRmid(buildMidi()), '1.rmi'), expect: 'ok' },
  { name: 'junk/ID3 bytes before MThd', file: asFile(withJunkPrefix(buildMidi()), '1.mid'), expect: 'ok' },
  { name: 'truncated write (no End-of-Track)', file: asFile(truncated(buildMidi({ tracks: 3 })), '1.mid'), expect: 'ok' },
  { name: '0-byte file', file: asFile(new Uint8Array(0), '1.mid'), expect: 'EMPTY_FILE' },
  { name: 'not a MIDI file (mp3 renamed)', file: asFile(new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x11, 0x22, 0x33, 0x44]), '1.mid'), expect: 'NOT_MIDI' },
  { name: 'header only, no tracks', file: asFile(new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 0, 0x01, 0xe0]), '1.mid'), expect: 'NO_TRACKS' },
];

let failures = 0;
for (const c of cases) {
  try {
    const { info } = await loadMidiFile(c.file);
    if (c.expect === 'ok') {
      console.log(`  ok   ${c.name.padEnd(34)} format=${info.format} tracks=${info.tracks} notes=${info.notes}${info.repaired.length ? ` repaired[${info.repaired.join('; ')}]` : ''}`);
    } else {
      console.error(`  FAIL ${c.name} — expected error ${c.expect} but the file loaded`);
      failures++;
    }
  } catch (err) {
    const code = err instanceof MidiLoadError ? err.code : 'UNKNOWN';
    const detail = err instanceof MidiLoadError ? err.detail : String(err);
    if (c.expect === code) {
      console.log(`  ok   ${c.name.padEnd(34)} rejected as ${code} :: ${detail.slice(0, 70)}`);
    } else {
      console.error(`  FAIL ${c.name} — expected ${c.expect}, got ${code}: ${detail}`);
      failures++;
    }
  }
}

if (failures) throw new Error(`${failures} MIDI loader case(s) failed`);
console.log('MIDI LOADER CHECK PASSED');
