import { analyzeBufferToStems, dropChromaticSweeps, midiToHz, sculptLead, secToTick } from '../services/audioStemService';
import { theoryEngine } from '../services/theoryEngine';

function synthMix(sr: number) {
  const melody = [67, 69, 71, 74, 71, 69, 67, 64, 62, 64, 67, 67];
  const noteDur = 0.36;
  const total = melody.length * noteDur + 0.4;
  const n = Math.floor(sr * total);
  const mix = new Float32Array(n);
  const expected: { midi: number; t: number; dur: number }[] = [];

  const addTone = (start: number, dur: number, midi: number, gain: number, harms: number[]) => {
    const f = midiToHz(midi);
    const i0 = Math.floor(start * sr);
    const len = Math.floor(dur * sr);
    for (let i = 0; i < len && i0 + i < n; i++) {
      const t = i / sr;
      const env = Math.min(1, t / 0.012) * Math.min(1, (dur - t) / 0.03);
      let s = 0;
      harms.forEach((h, hi) => { s += (1 / (hi + 1)) * Math.sin(2 * Math.PI * f * h * t); });
      mix[i0 + i] += gain * env * s;
    }
  };

  melody.forEach((midi, i) => {
    const t = 0.12 + i * noteDur;
    addTone(t, noteDur * 0.92, midi, 0.42, [1, 2, 3, 4]);
    expected.push({ midi, t, dur: noteDur * 0.92 });
  });

  for (let i = 0; i < melody.length; i += 2) {
    const t = 0.12 + i * noteDur;
    addTone(t, noteDur * 1.85, i % 4 === 0 ? 36 : 31, 0.28, [1, 2]);
  }
  for (let t = 0.12; t < total - 0.2; t += 0.36) {
    const i0 = Math.floor(t * sr);
    for (let i = 0; i < Math.floor(0.05 * sr) && i0 + i < n; i++) {
      const env = Math.exp(-i / (0.012 * sr));
      mix[i0 + i] += 0.35 * env * Math.sin(2 * Math.PI * 55 * (i / sr));
    }
  }
  return { mix, expected };
}

function midiOf(note: string | string[]) {
  return theoryEngine.getMidiNote(Array.isArray(note) ? note[0] : note);
}

const sr = 22050;
const { mix, expected } = synthMix(sr);
const analysis = await analyzeBufferToStems(mix, sr);
const lead = analysis.lead;
if (lead.length < expected.length * 0.6) {
  throw new Error(`Too few lead notes: ${lead.length} vs expected ${expected.length}`);
}

let hits = 0;
for (const exp of expected) {
  const expTick = secToTick(exp.t, analysis.sourceBpm || analysis.bpm);
  const match = lead.find((n) => {
    const m = midiOf(n.note);
    const dt = Math.abs((n.startTick || 0) - expTick);
    return Math.abs(m - exp.midi) <= 1 && dt < 240;
  });
  if (match) hits++;
}
const acc = hits / expected.length;
console.log({
  leadNotes: lead.length,
  expected: expected.length,
  hits,
  accuracyPct: Math.round(acc * 100),
  bpm: analysis.bpm,
  sourceBpm: analysis.sourceBpm,
  key: `${analysis.key} ${analysis.scale}`,
  bass: analysis.bassNotes.length,
  firstLead: lead.slice(0, 12).map((n) => `${n.note}@${n.startTick}`),
  expectedMidi: expected.map((e) => e.midi),
});
if (acc < 0.75) {
  throw new Error(`Melody accuracy ${Math.round(acc * 100)}% is below 75% 1:1 gate`);
}

const buried = synthMix(sr);
for (let i = 0; i < buried.mix.length; i++) {
  const t = i / sr;
  buried.mix[i] = buried.mix[i] * 0.72 + 0.12 * Math.sin(2 * Math.PI * 220 * t);
}
const buriedAnalysis = await analyzeBufferToStems(buried.mix, sr);
let buriedHits = 0;
for (const exp of buried.expected) {
  const expTick = secToTick(exp.t, buriedAnalysis.sourceBpm || buriedAnalysis.bpm);
  if (buriedAnalysis.lead.some((n) => Math.abs(midiOf(n.note) - exp.midi) <= 1 && Math.abs((n.startTick || 0) - expTick) < 280)) {
    buriedHits++;
  }
}
const buriedAcc = buriedHits / buried.expected.length;
console.log({ buriedLead: buriedAnalysis.lead.length, buriedHits, buriedPct: Math.round(buriedAcc * 100) });
if (buriedAcc < 0.65) {
  throw new Error(`Buried melody accuracy ${Math.round(buriedAcc * 100)}% is below 65%`);
}

const padMix = synthMix(sr);
for (let i = 0; i < padMix.mix.length; i++) {
  const t = i / sr;
  padMix.mix[i] = padMix.mix[i] * 0.55
    + 0.16 * Math.sin(2 * Math.PI * midiToHz(48) * t)
    + 0.12 * Math.sin(2 * Math.PI * midiToHz(52) * t)
    + 0.1 * Math.sin(2 * Math.PI * midiToHz(55) * t);
}
const padAnalysis = await analyzeBufferToStems(padMix.mix, sr);
const maxLead = Math.ceil(padMix.expected.length * 2.2);
if (padAnalysis.lead.length > maxLead) {
  throw new Error(`Pad wash produced a jitter cloud: ${padAnalysis.lead.length} lead notes (max ${maxLead})`);
}
let padHits = 0;
for (const exp of padMix.expected) {
  const expTick = secToTick(exp.t, padAnalysis.sourceBpm || padAnalysis.bpm);
  if (padAnalysis.lead.some((n) => Math.abs(midiOf(n.note) - exp.midi) <= 1 && Math.abs((n.startTick || 0) - expTick) < 300)) padHits++;
}
if (padHits / padMix.expected.length < 0.55) {
  throw new Error(`Pad mix lost the melody (${Math.round((padHits / padMix.expected.length) * 100)}%)`);
}
console.log({ padLead: padAnalysis.lead.length, padHits, padPct: Math.round((padHits / padMix.expected.length) * 100) });

const evNote = (midi: number, start: number, dur: number) => ({
  note: theoryEngine.midiToNote(midi),
  time: '0:0:0',
  duration: 'custom' as const,
  durationTicks: dur,
  startTick: start,
  velocity: 0.8,
});
const sweep = [60, 61, 62, 63, 64, 65, 66, 67].map((m, i) => evNote(m, 1920 + i * 90, 80));
const hook = [evNote(72, 0, 720), evNote(71, 800, 640), evNote(67, 1520, 700)];
const isolated = [evNote(64, 4800, 80), evNote(66, 7200, 90)];
const cleaned = sculptLead([...hook, ...sweep, ...isolated], 125);
const cleanedMidi = cleaned.map((n) => midiOf(n.note));
if (cleaned.some((n) => (n.durationTicks || 0) < 100)) {
  throw new Error(`sculptLead kept tiny notes: ${cleaned.map((n) => `${n.note}:${n.durationTicks}`).join(',')}`);
}
const sweepLeft = dropChromaticSweeps(sweep, 125);
if (sweepLeft.length > 1) {
  throw new Error(`chromatic sweep was not dropped (${sweepLeft.length} notes remain)`);
}
if (!cleanedMidi.includes(72) || !cleanedMidi.includes(71) || !cleanedMidi.includes(67)) {
  throw new Error(`sculptLead lost the long hook (${cleanedMidi.join(',')})`);
}
if (cleaned.length > 5) {
  throw new Error(`sculptLead still too busy (${cleaned.length} notes)`);
}
console.log({ sculptNotes: cleaned.length, sculptMidi: cleanedMidi, sweepLeft: sweepLeft.length });

console.log('AUDIO-TO-MIDI 1:1 CHECK PASSED');
