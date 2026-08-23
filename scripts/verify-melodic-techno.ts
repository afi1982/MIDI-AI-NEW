import { analyzeBufferToStems, arrangeMelodyOnly, midiToHz, secToTick } from '../services/audioStemService';
import { theoryEngine } from '../services/theoryEngine';

/**
 * MELODIC-TECHNO benchmark (Anyma / Afterlife style production).
 *
 * What makes this material hard, and what the previous benchmarks all missed:
 *  - the lead has RESTS; nothing melodic is playing for bars at a time
 *  - wide reverb / delay tails keep ringing after every note
 *  - detuned saw stacks (7 voices) smear each partial across ~30 cents
 *  - a busy 16th arp runs underneath the lead
 *  - sidechain pumping modulates everything at the kick rate
 *
 * The failure it measures: "note confetti" - hundreds of tiny scattered notes,
 * especially during the rests, instead of a melody.
 */
const sr = 22050;
const BPM = 122;
const beat = 60 / BPM;
const bar = beat * 4;
const BARS = 16;
const totalSec = BARS * bar;
const n = Math.floor(sr * totalSec);
const mix = new Float32Array(n);
const rnd = (() => { let s = 99; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s / 0x7fffffff) * 2 - 1; }; })();

const addVoice = (
  start: number, dur: number, midi: number, gain: number,
  opts: { detune?: number; voices?: number; harms?: number[]; attack?: number; release?: number } = {}
) => {
  const harms = opts.harms ?? [1, 2, 3, 4, 5];
  const voices = opts.voices ?? 1;
  const detune = opts.detune ?? 0;
  const i0 = Math.floor(start * sr), len = Math.floor(dur * sr);
  const atk = opts.attack ?? 0.02, rel = opts.release ?? 0.15;
  for (let v = 0; v < voices; v++) {
    const cents = voices > 1 ? (v - (voices - 1) / 2) * detune : 0;
    const f = midiToHz(midi) * Math.pow(2, cents / 1200);
    for (let i = 0; i < len && i0 + i < n; i++) {
      const t = i / sr;
      const env = Math.min(1, t / atk) * Math.min(1, (dur - t) / rel);
      let s = 0;
      harms.forEach((h, hi) => { s += (1 / (hi + 1)) * Math.sin(2 * Math.PI * f * h * t); });
      mix[i0 + i] += (gain / voices) * env * s;
    }
  }
};
const addNoise = (start: number, dur: number, gain: number, decay: number) => {
  const i0 = Math.floor(start * sr), len = Math.floor(dur * sr);
  for (let i = 0; i < len && i0 + i < n; i++) mix[i0 + i] += gain * rnd() * Math.exp(-(i / sr) * decay);
};

// --- LEAD: phrases separated by real rests ---------------------------------
type Ev = { midi: number; t: number; dur: number };
const LEAD: Ev[] = [];
const REST_BARS = [2, 3, 8, 9, 14, 15];         // bars where NO lead plays
const phrase = [69, 76, 74, 72, 71, 69, 67, 69];
for (let b = 0; b < BARS; b++) {
  if (REST_BARS.includes(b)) continue;
  for (let s = 0; s < 4; s++) {
    const midi = phrase[(b * 2 + s) % phrase.length];
    const t = b * bar + s * beat;
    LEAD.push({ midi, t, dur: beat * 0.85 });
  }
}

// --- production layers ------------------------------------------------------
const PROG = [[45, 48, 52], [43, 47, 50], [41, 45, 48], [43, 47, 50]];
for (let b = 0; b < BARS; b++) {
  const t0 = b * bar;
  const chord = PROG[b % PROG.length];

  // huge detuned pad with a long release tail (the reverb wash)
  chord.forEach((m) => addVoice(t0, bar * 1.15, m, 0.16, { voices: 7, detune: 14, attack: 0.4, release: 1.2, harms: [1, 2, 3] }));
  chord.forEach((m) => addVoice(t0, bar * 1.4, m + 12, 0.06, { voices: 5, detune: 22, attack: 0.6, release: 2.0, harms: [1, 2] }));

  // 16th arpeggio under the lead
  for (let s = 0; s < 16; s++) {
    const m = chord[s % chord.length] + 12;
    addVoice(t0 + s * (beat / 4), beat / 4 * 0.9, m, 0.10, { voices: 3, detune: 10, harms: [1, 2, 3] });
  }

  // bass + drums
  for (let e = 0; e < 8; e++) addVoice(t0 + e * (beat / 2), beat * 0.42, chord[0] - 12, 0.26, { harms: [1, 2] });
  for (let q = 0; q < 4; q++) {
    addVoice(t0 + q * beat, 0.2, 24, 0.6, { harms: [1], attack: 0.001, release: 0.15 });
    addNoise(t0 + q * beat + beat / 2, 0.06, 0.14, 80);
    if (q % 2 === 1) addNoise(t0 + q * beat, 0.16, 0.24, 24);
  }
}
LEAD.forEach((e) => addVoice(e.t, e.dur, e.midi, 0.34, { voices: 5, detune: 12, harms: [1, 2, 3, 4], release: 0.35 }));

// sidechain pump at the kick rate
for (let i = 0; i < n; i++) {
  const phase = ((i / sr) % beat) / beat;
  mix[i] *= 0.35 + 0.65 * Math.min(1, phase / 0.35);
}
let peak = 0;
for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mix[i]));
for (let i = 0; i < n; i++) mix[i] = (mix[i] / peak) * 0.92;

// --- analysis ---------------------------------------------------------------
const midiOf = (note: string | string[]) => theoryEngine.getMidiNote(Array.isArray(note) ? note[0] : note);
const analysis = await analyzeBufferToStems(mix, sr, undefined, { bpm: BPM });
const groove: any = arrangeMelodyOnly(analysis, { bpm: BPM, gridDiv: Number(process.env.GRID ?? 4), trackName: 'anyma-style' });
const melody = (groove.ch4_leadA || []) as any[];

const tickOfSec = (s: number) => secToTick(s, BPM);
const restRanges = REST_BARS.map((b) => [tickOfSec(b * bar), tickOfSec((b + 1) * bar)] as const);
const inRest = (tick: number) => restRanges.some(([a, b]) => tick >= a && tick < b);

const spray = melody.filter((no) => inRest(no.startTick || 0)).length;
let matched = 0;
for (const e of LEAD) {
  const t = tickOfSec(e.t);
  if (melody.some((no) => Math.abs(midiOf(no.note) - e.midi) <= 0.6 && Math.abs((no.startTick || 0) - t) < 180)) matched++;
}
const recall = matched / LEAD.length;
const precision = melody.length ? matched / melody.length : 0;

const durs = melody.map((no) => no.durationTicks || 0).sort((a, b) => a - b);
const medianDur = durs.length ? durs[Math.floor(durs.length / 2)] : 0;
let bigJumps = 0;
for (let i = 1; i < melody.length; i++) {
  if (Math.abs(midiOf(melody[i].note) - midiOf(melody[i - 1].note)) > 12) bigJumps++;
}

console.log({
  expectedLeadNotes: LEAD.length,
  transcribedNotes: melody.length,
  recallPct: Math.round(recall * 100),
  precisionPct: Math.round(precision * 100),
  notesInRests: spray,
  restBars: REST_BARS.length,
  medianDurationTicks: medianDur,
  octaveJumps: bigJumps,
  detectedBpm: analysis.sourceBpm,
});

const failures: string[] = [];
if (spray > LEAD.length * 0.1) failures.push(`note confetti: ${spray} notes during ${REST_BARS.length} silent bars`);
if (melody.length > LEAD.length * 2) failures.push(`too many notes: ${melody.length} for ${LEAD.length} real ones`);
if (recall < 0.5) failures.push(`recall ${Math.round(recall * 100)}% < 50%`);
if (precision < 0.4) failures.push(`precision ${Math.round(precision * 100)}% < 40%`);
if (medianDur < 100) failures.push(`median note is ${medianDur} ticks - fragmented spray`);

if (failures.length) {
  console.error('MELODIC-TECHNO FAILURES:\n - ' + failures.join('\n - '));
  throw new Error('Melodic techno melody check failed');
}
console.log('MELODIC TECHNO CHECK PASSED');
