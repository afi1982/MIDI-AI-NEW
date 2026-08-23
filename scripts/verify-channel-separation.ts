import { analyzeBufferToStems, arrangeTranceFromAnalysis, midiToHz } from '../services/audioStemService';
import { ELITE_16_CHANNELS } from '../services/maestroService';
import { MusicGenre } from '../types';

/**
 * Builds a synthetic "full band" mix: 4-on-the-floor kick, closed + open hats,
 * snare, clap, a tom, a bass line, a sustained minor chord and a lead melody.
 * The engine must separate these onto distinct channels.
 */
const sr = 22050;
const BPM = 145;
const beat = 60 / BPM;
const bars = 8;
const total = bars * 4 * beat;
const n = Math.floor(sr * total);
const mix = new Float32Array(n);

const rnd = (() => { let s = 12345; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s / 0x7fffffff) * 2 - 1; }; })();

const add = (start: number, sample: (t: number) => number, dur: number, gain: number) => {
  const i0 = Math.floor(start * sr);
  const len = Math.floor(dur * sr);
  for (let i = 0; i < len && i0 + i < n; i++) mix[i0 + i] += gain * sample(i / sr);
};

// --- drum voices -----------------------------------------------------------
const kick = (t: number) => Math.sin(2 * Math.PI * (48 + 60 * Math.exp(-t * 40)) * t) * Math.exp(-t * 16);

// hats: heavily high-passed noise (differentiated twice => strong >6kHz energy)
let hp1 = 0, hp2 = 0;
const hatNoise = (decay: number) => (t: number) => {
  const x = rnd();
  const d1 = x - hp1; hp1 = x;
  const d2 = d1 - hp2; hp2 = d1;
  return d2 * Math.exp(-t / decay);
};

// snare: noise burst WITH 190Hz shell body
const snare = (t: number) => (rnd() * 0.7 + Math.sin(2 * Math.PI * 190 * t) * 0.9) * Math.exp(-t * 22);

// clap: white noise through two RBJ highpasses at 1.2kHz => no low-mid body
const makeHp = (freq: number) => {
  const w = (2 * Math.PI * freq) / sr, cs = Math.cos(w), sn = Math.sin(w), alpha = sn / (2 * 0.707);
  const b0 = (1 + cs) / 2, b1 = -(1 + cs), b2 = (1 + cs) / 2, a0 = 1 + alpha, a1 = -2 * cs, a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x: number) => {
    const y = (b0 / a0) * x + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
};
const clapHpA = makeHp(1200), clapHpB = makeHp(1200);
const clap = (t: number) => clapHpB(clapHpA(rnd())) * Math.exp(-t * 30);

// tom / perc: pitched 300Hz body
const tom = (t: number) => Math.sin(2 * Math.PI * 300 * t) * Math.exp(-t * 12);

const tone = (midi: number, harmonics: number[]) => (t: number) => {
  const f = midiToHz(midi);
  let s = 0;
  harmonics.forEach((h, i) => { s += (1 / (i + 1)) * Math.sin(2 * Math.PI * f * h * t); });
  return s * Math.min(1, t / 0.01);
};

for (let bar = 0; bar < bars; bar++) {
  const b0 = bar * 4 * beat;
  for (let q = 0; q < 4; q++) {
    add(b0 + q * beat, kick, 0.25, 0.95);                                  // kick on every beat
    add(b0 + q * beat + beat / 2, hatNoise(0.018), 0.09, 0.5);             // closed hat offbeats
  }
  add(b0 + 3 * beat + beat / 2, hatNoise(0.16), 0.35, 0.55);               // open hat end of bar
  add(b0 + beat, snare, 0.2, 0.55);                                        // snare on 2
  add(b0 + 3 * beat, clap, 0.18, 0.6);                                     // clap on 4
  add(b0 + 2 * beat + beat * 0.75, tom, 0.25, 0.35);                       // tom fill (off the hat grid)
  // bass line (root movement)
  const bassNotes = [33, 33, 36, 31];
  add(b0, tone(bassNotes[bar % 4], [1, 2]), beat * 3.8, 0.5);
  // sustained A minor-ish chord (A3 C4 E4)
  [57, 60, 64].forEach((m) => add(b0, tone(m, [1, 2, 3]), beat * 3.9, 0.16));
  // lead melody, one note per beat
  const melody = [72, 74, 76, 79];
  melody.forEach((m, i) => add(b0 + i * beat + 0.02, tone(m, [1, 2, 3, 4]), beat * 0.8, 0.42));
}

const analysis = await analyzeBufferToStems(mix, sr, undefined, { bpm: BPM });
const groove: any = arrangeTranceFromAnalysis(analysis, { genre: MusicGenre.PSYTRANCE_FULLON, bpm: BPM });

const counts: Record<string, number> = {};
ELITE_16_CHANNELS.forEach((ch) => { if (groove[ch]?.length) counts[ch] = groove[ch].length; });

console.log('detected stems :', analysis.detected);
console.log('chords         :', (analysis.chords || []).slice(0, 4).map((c) => `${c.root}${c.isMinor ? 'm' : ''} ${c.startSec.toFixed(2)}-${c.endSec.toFixed(2)}s`));
console.log('groove channels:', counts);

const beatSec = beat;
const inBeats = (hits: number[] | undefined) => (hits || []).map((t) => t / beatSec);
const matches = (hits: number[] | undefined, expectedBeats: number[], tolBeats = 0.12) =>
  expectedBeats.filter((e) => inBeats(hits).some((h) => Math.abs(h - e) <= tolBeats)).length;

const snareExpected = Array.from({ length: bars }, (_, b) => b * 4 + 1);
const clapExpected = Array.from({ length: bars }, (_, b) => b * 4 + 3);
const openHatExpected = Array.from({ length: bars }, (_, b) => b * 4 + 3.5);
const hatExpected = Array.from({ length: bars * 4 }, (_, i) => i + 0.5);
const kickExpected = Array.from({ length: bars * 4 }, (_, i) => i);

const acc = {
  kick: matches(analysis.kickHits, kickExpected) / kickExpected.length,
  snare: matches(analysis.snareHits, snareExpected) / snareExpected.length,
  clap: matches(analysis.clapHits, clapExpected) / clapExpected.length,
  hatClosed: matches(analysis.hatHits, hatExpected) / hatExpected.length,
  hatOpen: matches(analysis.openHatHits, openHatExpected) / openHatExpected.length,
};
console.log('placement accuracy:', Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, `${Math.round(v * 100)}%`])));

const populated = Object.keys(counts).length;
const failures: string[] = [];

if (populated < 7) failures.push(`only ${populated} channels populated (expected >= 7)`);
if (!counts['ch1_kick']) failures.push('no kick detected');
if (!counts['ch12_hhClosed']) failures.push('no closed hats detected');
if (!counts['ch13_hhOpen']) failures.push('no open hats detected');
if (!counts['ch8_snare']) failures.push('no snare detected');
if (!counts['ch9_clap']) failures.push('no clap detected (snare/clap not separated)');
if (acc.kick < 0.7) failures.push(`kick placement ${Math.round(acc.kick * 100)}% < 70%`);
if (acc.snare < 0.7) failures.push(`snare placement ${Math.round(acc.snare * 100)}% < 70%`);
if (acc.clap < 0.6) failures.push(`clap placement ${Math.round(acc.clap * 100)}% < 60%`);
if (acc.hatClosed < 0.7) failures.push(`closed hat placement ${Math.round(acc.hatClosed * 100)}% < 70%`);
if (acc.hatOpen < 0.7) failures.push(`open hat placement ${Math.round(acc.hatOpen * 100)}% < 70%`);
if (!counts['ch16_synth']) failures.push('no chords extracted');
if (!counts['ch15_pad']) failures.push('no pad extracted');
if (!counts['ch2_sub']) failures.push('no bass detected');
if (!counts['ch4_leadA'] && !counts['ch6_arpA']) failures.push('no melodic content detected');

// chords must be真 polyphonic: at least one tick carrying 3 simultaneous notes
const chordTicks = new Map<number, number>();
(groove['ch16_synth'] || []).forEach((note: any) => {
  chordTicks.set(note.startTick, (chordTicks.get(note.startTick) || 0) + 1);
});
const maxStack = Math.max(0, ...chordTicks.values());
if (maxStack < 3) failures.push(`chords are not polyphonic (max ${maxStack} notes per tick)`);

if (failures.length) {
  console.error('CHANNEL SEPARATION FAILURES:\n - ' + failures.join('\n - '));
  throw new Error('Channel separation check failed');
}

console.log(`CHANNEL SEPARATION CHECK PASSED — ${populated} channels, chord stack ${maxStack}`);
