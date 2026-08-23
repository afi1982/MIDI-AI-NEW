import { analyzeBufferToStems, arrangeMelodyOnly, midiToHz, secToTick } from '../services/audioStemService';
import { ELITE_16_CHANNELS } from '../services/maestroService';
import { theoryEngine } from '../services/theoryEngine';

/**
 * "One melody channel, 1:1 with the song."
 * Verifies that MELODY_1_1 mode returns a single monophonic lead channel that
 * follows the source, and that NOTHING else is invented (no kick, no bass,
 * no chords, no filler arrangement).
 */
const sr = 22050;
const BPM = 126;
const beat = 60 / BPM;
const VIBRATO = Number(process.env.VIBRATO ?? 0.02);

type Ev = { midi: number; t: number; dur: number };
const MELODY: Ev[] = [];
{
  const pattern: [number, number][] = [
    [69, 1], [72, 0.5], [71, 0.5], [69, 1], [67, 1],
    [69, 0.5], [71, 0.5], [72, 1], [76, 1.5], [74, 0.5],
    [72, 1], [71, 1], [69, 2],
    [69, 1], [72, 0.5], [74, 0.5], [76, 2],
    [74, 1], [72, 1], [71, 1], [69, 1],
    [67, 1], [69, 1], [72, 2],
  ];
  let t = 0;
  for (const [midi, beats] of pattern) { MELODY.push({ midi, t, dur: beats * beat * 0.92 }); t += beats * beat; }
}
const totalSec = MELODY[MELODY.length - 1].t + MELODY[MELODY.length - 1].dur + 0.5;
const n = Math.floor(sr * totalSec);
const mix = new Float32Array(n);
const rnd = (() => { let s = 7; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s / 0x7fffffff) * 2 - 1; }; })();

const addOsc = (start: number, dur: number, midi: number, gain: number, harms: number[], vib = 0) => {
  const f = midiToHz(midi);
  const i0 = Math.floor(start * sr), len = Math.floor(dur * sr);
  let phase = 0;
  for (let i = 0; i < len && i0 + i < n; i++) {
    const t = i / sr;
    const env = Math.min(1, t / 0.015) * Math.min(1, (dur - t) / 0.06);
    phase += (2 * Math.PI * f * (vib ? 1 + vib * Math.sin(2 * Math.PI * 5.2 * t) : 1)) / sr;
    let s = 0;
    harms.forEach((h, hi) => { s += (1 / (hi + 1)) * Math.sin(phase * h); });
    mix[i0 + i] += gain * env * s;
  }
};
const addNoise = (start: number, dur: number, gain: number, decay: number) => {
  const i0 = Math.floor(start * sr), len = Math.floor(dur * sr);
  for (let i = 0; i < len && i0 + i < n; i++) mix[i0 + i] += gain * rnd() * Math.exp(-(i / sr) * decay);
};

// full arrangement around the melody: chords, bass, kick, hats, snare
const CHORDS = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]];
const barSec = beat * 4;
for (let bar = 0; bar < Math.ceil(totalSec / barSec); bar++) {
  const chord = CHORDS[bar % CHORDS.length];
  const t0 = bar * barSec;
  chord.forEach((m) => addOsc(t0, barSec * 0.98, m, 0.14, [1, 2, 3]));
  for (let e = 0; e < 8; e++) addOsc(t0 + e * (beat / 2), beat * 0.4, chord[0] - 24, 0.30, [1, 2]);
  for (let q = 0; q < 4; q++) {
    addOsc(t0 + q * beat, 0.18, 24, 0.55, [1]);
    addNoise(t0 + q * beat + beat / 2, 0.05, 0.16, 90);
    if (q % 2 === 1) addNoise(t0 + q * beat, 0.15, 0.28, 26);
  }
}
MELODY.forEach((m) => addOsc(m.t, m.dur, m.midi, 0.30, [1, 2, 3, 4], VIBRATO));
let peak = 0;
for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mix[i]));
for (let i = 0; i < n; i++) mix[i] = (mix[i] / peak) * 0.9;

const midiOf = (note: string | string[]) => theoryEngine.getMidiNote(Array.isArray(note) ? note[0] : note);
const analysis = await analyzeBufferToStems(mix, sr, undefined, { bpm: BPM });

const failures: string[] = [];

for (const gridDiv of [4, 8, 16]) {
  const groove: any = arrangeMelodyOnly(analysis, { bpm: BPM, gridDiv, trackName: 'test' });
  const melody = groove.ch4_leadA as any[];

  const others = ELITE_16_CHANNELS.filter((ch) => ch !== 'ch4_leadA' && (groove[ch] || []).length > 0);
  if (others.length) failures.push(`grid ${gridDiv}: extra channels populated -> ${others.join(', ')}`);

  let overlaps = 0;
  for (let i = 0; i < melody.length - 1; i++) {
    if ((melody[i].startTick || 0) + (melody[i].durationTicks || 0) > (melody[i + 1].startTick || 0)) overlaps++;
  }
  if (overlaps) failures.push(`grid ${gridDiv}: ${overlaps} overlapping notes (not monophonic)`);

  let matched = 0;
  let onsetErrTicks = 0;
  for (const exp of MELODY) {
    const expTick = secToTick(exp.t, BPM);
    const hit = melody.find((no) => Math.abs(midiOf(no.note) - exp.midi) <= 0.6 && Math.abs((no.startTick || 0) - expTick) < 200);
    if (hit) { matched++; onsetErrTicks += Math.abs((hit.startTick || 0) - expTick); }
  }
  const recall = matched / MELODY.length;
  const precision = melody.length ? Math.min(1, matched / melody.length) : 0;
  const avgOnsetMs = matched ? (onsetErrTicks / matched) * (60000 / (BPM * 480)) : 0;

  console.log(`grid 1/${gridDiv * 4}: notes=${String(melody.length).padStart(3)} recall=${Math.round(recall * 100)}% precision=${Math.round(precision * 100)}% avgOnsetError=${avgOnsetMs.toFixed(0)}ms channels=${1 + others.length}`);

  if (gridDiv === 4) {
    if (recall < 0.75) failures.push(`grid 4: recall ${Math.round(recall * 100)}% < 75%`);
    if (precision < 0.8) failures.push(`grid 4: precision ${Math.round(precision * 100)}% < 80%`);
  }
}

// key snapping must stay opt-in
const raw: any = arrangeMelodyOnly(analysis, { bpm: BPM, gridDiv: 4 });
const snapped: any = arrangeMelodyOnly(analysis, { bpm: BPM, gridDiv: 4, snapToKey: true });
if (raw.ch4_leadA.length !== snapped.ch4_leadA.length) failures.push('snapToKey changed the note count');
console.log(`snapToKey off/on -> ${raw.ch4_leadA.length}/${snapped.ch4_leadA.length} notes (same count, pitches corrected only)`);

if (failures.length) {
  console.error('MELODY-ONLY FAILURES:\n - ' + failures.join('\n - '));
  throw new Error('Melody-only mode check failed');
}
console.log('MELODY 1:1 CHECK PASSED');
