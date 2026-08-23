import { analyzeBufferToStems, arrangeTranceFromAnalysis, midiToHz, secToTick } from '../services/audioStemService';
import { theoryEngine } from '../services/theoryEngine';
import { MusicGenre } from '../types';

/**
 * REALISTIC melody benchmark.
 * The old gate only tested a solo melody with a quiet bass. Real songs bury the
 * lead inside chords at a similar level, with vibrato, legato and drums on top -
 * which is exactly where the tracker was failing.
 */
const sr = 22050;
const BPM = 126;
// 0.004 = gentle instrument vibrato, 0.035 = strong singer vibrato (~+-0.6 semitone)
const VIBRATO = Number(process.env.VIBRATO ?? 0.02);
const beat = 60 / BPM;

type Ev = { midi: number; t: number; dur: number };

// 8 bars of melody in A minor, mixed rhythm (quarters, 8ths, dotted, held notes)
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
  for (const [midi, beats] of pattern) {
    MELODY.push({ midi, t, dur: beats * beat * 0.92 });
    t += beats * beat;
  }
}
const totalSec = MELODY[MELODY.length - 1].t + MELODY[MELODY.length - 1].dur + 0.5;
const n = Math.floor(sr * totalSec);
const mix = new Float32Array(n);

const rnd = (() => { let s = 7; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s / 0x7fffffff) * 2 - 1; }; })();

const addOsc = (
  start: number, dur: number, midi: number, gain: number,
  harms: number[], opts: { vibrato?: number; attack?: number; release?: number } = {}
) => {
  const f = midiToHz(midi);
  const i0 = Math.floor(start * sr);
  const len = Math.floor(dur * sr);
  const atk = opts.attack ?? 0.012;
  const rel = opts.release ?? 0.06;
  let phase = 0;
  for (let i = 0; i < len && i0 + i < n; i++) {
    const t = i / sr;
    const env = Math.min(1, t / atk) * Math.min(1, (dur - t) / rel);
    const vib = opts.vibrato ? 1 + opts.vibrato * Math.sin(2 * Math.PI * 5.2 * t) : 1;
    phase += (2 * Math.PI * f * vib) / sr;
    let s = 0;
    harms.forEach((h, hi) => { s += (1 / (hi + 1)) * Math.sin(phase * h); });
    mix[i0 + i] += gain * env * s;
  }
};

const addNoise = (start: number, dur: number, gain: number, decay: number, hp: boolean) => {
  const i0 = Math.floor(start * sr);
  const len = Math.floor(dur * sr);
  let prev = 0;
  for (let i = 0; i < len && i0 + i < n; i++) {
    let x = rnd();
    if (hp) { const d = x - prev; prev = x; x = d; }
    mix[i0 + i] += gain * x * Math.exp(-(i / sr) * decay);
  }
};

// --- accompaniment: chords at the SAME level as the lead (the hard part) -----
const CHORDS: number[][] = [
  [57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59],
  [57, 60, 64], [53, 57, 60], [55, 59, 62], [57, 60, 64],
];
const barSec = beat * 4;
const bars = Math.ceil(totalSec / barSec);
for (let bar = 0; bar < bars; bar++) {
  const chord = CHORDS[bar % CHORDS.length];
  const t0 = bar * barSec;
  chord.forEach((m) => addOsc(t0, barSec * 0.98, m, 0.14, [1, 2, 3], { attack: 0.05, release: 0.2 }));
  // bass root, 8th note pulse
  for (let e = 0; e < 8; e++) {
    addOsc(t0 + e * (beat / 2), beat * 0.4, chord[0] - 24, 0.30, [1, 2]);
  }
  // drums
  for (let q = 0; q < 4; q++) {
    const tb = t0 + q * beat;
    addOsc(tb, 0.18, 24, 0.55, [1], { attack: 0.001, release: 0.12 }); // kick
    addNoise(tb + beat / 2, 0.05, 0.16, 90, true);                     // closed hat
    if (q % 2 === 1) addNoise(tb, 0.15, 0.28, 26, false);              // snare
  }
}

// --- the lead: same level as the chords, with vibrato ------------------------
MELODY.forEach((m) => addOsc(m.t, m.dur, m.midi, 0.30, [1, 2, 3, 4], { vibrato: VIBRATO, attack: 0.02 }));

// normalise
let peak = 0;
for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mix[i]));
for (let i = 0; i < n; i++) mix[i] = (mix[i] / peak) * 0.9;

const midiOf = (note: string | string[]) => theoryEngine.getMidiNote(Array.isArray(note) ? note[0] : note);

const analysis = await analyzeBufferToStems(mix, sr, undefined, { bpm: BPM });
const lead = analysis.lead;
const refBpm = analysis.sourceBpm || analysis.bpm;

let matched = 0;
const missed: string[] = [];
for (const exp of MELODY) {
  const expTick = secToTick(exp.t, refBpm);
  const hit = lead.find((no) => {
    const dm = Math.abs(midiOf(no.note) - exp.midi);
    const dt = Math.abs((no.startTick || 0) - expTick);
    return (dm <= 0.6 || Math.abs(dm - 12) <= 0.6) && dt < 0.16 * refBpm * 8;
  });
  if (hit) matched++; else missed.push(`${exp.midi}@${exp.t.toFixed(2)}s`);
}

// octave-exact recall (no octave forgiveness)
let exact = 0;
for (const exp of MELODY) {
  const expTick = secToTick(exp.t, refBpm);
  if (lead.some((no) => Math.abs(midiOf(no.note) - exp.midi) <= 0.6 && Math.abs((no.startTick || 0) - expTick) < 0.16 * refBpm * 8)) exact++;
}

const recall = matched / MELODY.length;
const exactRecall = exact / MELODY.length;
const precision = lead.length ? Math.min(1, matched / lead.length) : 0;

console.log({
  expectedNotes: MELODY.length,
  transcribedNotes: lead.length,
  recallPct: Math.round(recall * 100),
  octaveExactPct: Math.round(exactRecall * 100),
  precisionPct: Math.round(precision * 100),
  detectedBpm: analysis.sourceBpm,
  key: `${analysis.key} ${analysis.scale}`,
});
console.log('first transcribed:', lead.slice(0, 14).map((no) => `${no.note}`).join(' '));
console.log('expected        :', MELODY.slice(0, 14).map((m) => theoryEngine.midiToNote(m.midi)).join(' '));
if (missed.length) console.log('missed:', missed.slice(0, 12).join(' '));

// What the user actually receives is the ARRANGED groove (after key repair)
const groove: any = arrangeTranceFromAnalysis(analysis, { genre: MusicGenre.PSYTRANCE_FULLON, bpm: BPM });
const arranged = [...(groove.ch4_leadA || []), ...(groove.ch6_arpA || [])]
  .sort((a: any, b: any) => (a.startTick || 0) - (b.startTick || 0));

let arrMatched = 0;
for (const exp of MELODY) {
  const expTick = secToTick(exp.t, BPM);
  if (arranged.some((no: any) => Math.abs(midiOf(no.note) - exp.midi) <= 0.6 && Math.abs((no.startTick || 0) - expTick) < 200)) arrMatched++;
}
const arrRecall = arrMatched / MELODY.length;
const arrPrecision = arranged.length ? Math.min(1, arrMatched / arranged.length) : 0;
console.log({
  arrangedNotes: arranged.length,
  arrangedRecallPct: Math.round(arrRecall * 100),
  arrangedPrecisionPct: Math.round(arrPrecision * 100),
  arrangedKey: `${groove.key} ${groove.scale}`,
});
console.log('arranged lead   :', arranged.slice(0, 14).map((no: any) => `${no.note}@${no.startTick}`).join(' '));

if (arrRecall < 0.85) throw new Error(`Arranged lead recall ${Math.round(arrRecall * 100)}% below 85%`);

if (recall < 0.85) throw new Error(`Melody recall ${Math.round(recall * 100)}% is below the 85% gate`);
if (exactRecall < 0.85) throw new Error(`Octave-exact recall ${Math.round(exactRecall * 100)}% is below the 85% gate`);
if (precision < 0.65) throw new Error(`Melody precision ${Math.round(precision * 100)}% is below the 65% gate`);

console.log('REALISTIC MELODY CHECK PASSED');
