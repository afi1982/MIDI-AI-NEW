import { parseMidi } from 'midi-file';
import { exportMidi, exportMidiAsText } from '../services/midiService';
import { ELITE_16_CHANNELS } from '../services/maestroService';
import { NoteEvent } from '../types';

/**
 * Strict conformance check for the MIDI files we hand to other programs
 * (DAWs, Gemini, python mido / pretty_midi ...).
 *
 * @tonejs/midi is forgiving about what it reads back, so a round-trip through
 * it proves nothing. This validates the raw bytes with an independent parser
 * plus explicit Standard MIDI File rules.
 */

const build = (channels: string[], notesPerChannel = 8, key = 'F#', scale = 'Phrygian') => {
  const g: any = { id: 'TEST', name: 'Conformance Test', bpm: 128, key, scale, totalBars: 8 };
  ELITE_16_CHANNELS.forEach((ch) => { g[ch] = [] as NoteEvent[]; });
  channels.forEach((ch, ci) => {
    for (let i = 0; i < notesPerChannel; i++) {
      g[ch].push({
        note: ['C3', 'E3', 'G3', 'A#3'][i % 4],
        duration: 'custom',
        durationTicks: 240,
        startTick: i * 240 + ci * 20,
        velocity: 0.8,
        time: '0:0:0',
      } as NoteEvent);
    }
  });
  return g;
};

const problems: string[] = [];
const note = (scenario: string, msg: string) => problems.push(`${scenario}: ${msg}`);

function validate(scenario: string, bytes: Uint8Array) {
  // --- byte level ----------------------------------------------------------
  const ascii = (at: number, len: number) => Array.from(bytes.slice(at, at + len)).map((b) => String.fromCharCode(b)).join('');
  if (ascii(0, 4) !== 'MThd') { note(scenario, `bad magic "${ascii(0, 4)}"`); return; }
  const headerLen = (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];
  if (headerLen !== 6) note(scenario, `header length ${headerLen}, expected 6`);
  const format = (bytes[8] << 8) | bytes[9];
  const ntrks = (bytes[10] << 8) | bytes[11];
  const division = (bytes[12] << 8) | bytes[13];
  if (![0, 1, 2].includes(format)) note(scenario, `invalid format ${format}`);
  if (format === 0 && ntrks !== 1) note(scenario, `format 0 must have exactly 1 track, has ${ntrks}`);
  if (division <= 0) note(scenario, `invalid division ${division}`);

  // --- independent parser ---------------------------------------------------
  let parsed: any;
  try {
    parsed = parseMidi(bytes);
  } catch (err: any) {
    note(scenario, `independent parser threw: ${err?.message}`);
    return;
  }
  if (parsed.tracks.length !== ntrks) note(scenario, `header says ${ntrks} tracks, parser found ${parsed.tracks.length}`);

  let noteOns = 0;
  parsed.tracks.forEach((track: any[], ti: number) => {
    let sawEot = false;
    track.forEach((ev: any, ei: number) => {
      if (ev.deltaTime < 0) note(scenario, `track ${ti} event ${ei} negative delta`);
      if (sawEot) note(scenario, `track ${ti} has events after End-of-Track`);
      if (ev.meta && ev.type === 'endOfTrack') sawEot = true;

      if (ev.type === 'noteOn' || ev.type === 'noteOff') {
        noteOns += ev.type === 'noteOn' && ev.velocity > 0 ? 1 : 0;
        if (ev.channel === undefined || ev.channel < 0 || ev.channel > 15) {
          note(scenario, `track ${ti} event ${ei} INVALID CHANNEL ${ev.channel} (must be 0-15)`);
        }
        if (ev.noteNumber < 0 || ev.noteNumber > 127) note(scenario, `track ${ti} note number ${ev.noteNumber} out of range`);
        if (ev.velocity < 0 || ev.velocity > 127) note(scenario, `track ${ti} velocity ${ev.velocity} out of range`);
      }
      if (ev.type === 'keySignature') {
        if (ev.key < -7 || ev.key > 7) note(scenario, `track ${ti} INVALID KEY SIGNATURE sf=${ev.key} (must be -7..7)`);
        if (ev.scale !== 0 && ev.scale !== 1) note(scenario, `track ${ti} invalid key signature mode ${ev.scale}`);
      }
      if (ev.type === 'setTempo' && (!ev.microsecondsPerBeat || ev.microsecondsPerBeat <= 0)) {
        note(scenario, `track ${ti} invalid tempo ${ev.microsecondsPerBeat}`);
      }
    });
    if (!sawEot) note(scenario, `track ${ti} missing End-of-Track meta event`);
  });

  if (noteOns === 0) note(scenario, 'file contains no note-on events');

  // every note-on must have a matching note-off
  parsed.tracks.forEach((track: any[], ti: number) => {
    const open = new Map<string, number>();
    track.forEach((ev: any) => {
      const k = `${ev.channel}:${ev.noteNumber}`;
      if (ev.type === 'noteOn' && ev.velocity > 0) open.set(k, (open.get(k) || 0) + 1);
      if (ev.type === 'noteOff' || (ev.type === 'noteOn' && ev.velocity === 0)) {
        const c = open.get(k) || 0;
        if (c > 0) open.set(k, c - 1);
      }
    });
    const dangling = [...open.values()].reduce((a, b) => a + b, 0);
    if (dangling) note(scenario, `track ${ti} has ${dangling} note(s) without note-off`);
  });

  // every track must own a unique MIDI channel (except the GM drum channel 9)
  const chanByTrack = new Map<number, Set<number>>();
  parsed.tracks.forEach((track: any[], ti: number) => {
    const set = new Set<number>();
    track.forEach((ev: any) => { if (ev.channel !== undefined && (ev.type === 'noteOn' || ev.type === 'noteOff')) set.add(ev.channel); });
    if (set.size) chanByTrack.set(ti, set);
  });
  const seen = new Map<number, number>();
  chanByTrack.forEach((set, ti) => {
    set.forEach((c) => {
      if (c === 9) return; // GM drums are shared by design
      if (seen.has(c)) note(scenario, `channel ${c} shared by tracks ${seen.get(c)} and ${ti}`);
      else seen.set(c, ti);
    });
  });

  console.log(`  ${problems.length ? '·' : 'ok'} ${scenario.padEnd(38)} format=${format} tracks=${ntrks} division=${division} notes=${noteOns} bytes=${bytes.length}`);
}

const scenarios: [string, any][] = [
  ['melody only (1 channel)', build(['ch4_leadA'])],
  ['full band (all 16 channels)', build([...ELITE_16_CHANNELS])],
  ['drums + melody', build(['ch1_kick', 'ch8_snare', 'ch12_hhClosed', 'ch4_leadA'])],
  ['key F# Phrygian', build(['ch4_leadA'], 8, 'F#', 'Phrygian')],
  ['key C# Minor', build(['ch4_leadA'], 8, 'C#', 'Minor')],
  ['key Db Major', build(['ch4_leadA'], 8, 'Db', 'Major')],
  ['key A# Locrian', build(['ch4_leadA'], 8, 'A#', 'Locrian')],
  ['unicode / spaces in name', (() => { const g = build(['ch4_leadA']); g.name = 'שיר של אנימה  2024'; return g; })()],
];

for (const [label, groove] of scenarios) {
  const before = problems.length;
  const res = exportMidi(groove);
  if (!res.bytes) { note(label, 'exportMidi returned no bytes'); continue; }
  validate(label, new Uint8Array(res.bytes as any));
  if (problems.length > before) {
    problems.slice(before).forEach((p) => console.error(`  FAIL ${p}`));
  }
}

// Format 0 (flattened) variant - the most compatible option we offer
{
  const before = problems.length;
  const res = exportMidi(build([...ELITE_16_CHANNELS]), undefined, { flatten: true });
  if (!res.bytes) note('single-track export', 'exportMidi returned no bytes');
  else validate('single-track export', new Uint8Array(res.bytes as any));
  problems.slice(before).forEach((p) => console.error(`  FAIL ${p}`));
}

// Text export for chat assistants
{
  const txt = exportMidiAsText(build(['ch4_leadA', 'ch1_kick']));
  const lines = txt.split('\n');
  const dataLines = lines.filter((l) => /^[\w]+,\d+,\d+\.\d+,\d+,/.test(l));
  if (!/tempo_bpm: \d+/.test(txt)) note('text export', 'missing tempo header');
  if (!/ticks_per_beat: \d+/.test(txt)) note('text export', 'missing ppq header');
  if (dataLines.length !== 16) note('text export', `expected 16 note rows, got ${dataLines.length}`);
  console.log(`  ok text export                            ${lines.length} lines, ${dataLines.length} note rows`);
}

// Filenames must be portable
{
  const weird = build(['ch4_leadA']);
  (weird as any).name = 'שיר / של: אנימה *2024*';
  const res = exportMidi(weird);
  if (!/^[\w\-]+\.mid$/.test(res.filename)) note('filename', `unsafe filename "${res.filename}"`);
  console.log(`  ok portable filename                      "${res.filename}"`);
}

if (problems.length) {
  console.error(`\n${problems.length} conformance problem(s) found`);
  throw new Error('MIDI conformance check failed');
}
console.log('MIDI CONFORMANCE CHECK PASSED');
