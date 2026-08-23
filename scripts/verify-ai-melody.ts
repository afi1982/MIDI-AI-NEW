import { mapAiNotes, enforceMonophony, isSprayResponse, msToTick } from '../services/melodyAiMapping';
import { theoryEngine } from '../services/theoryEngine';

/**
 * Offline checks for the AI melody engine: the network call cannot be tested
 * here, but every transformation applied to the model's answer can be.
 */
const problems: string[] = [];
const BPM = 120; // 1 beat = 500ms = 480 ticks  => 1ms = 0.96 ticks
const midiOf = (n: any) => theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);

// 1. millisecond -> tick conversion
if (msToTick(500, BPM) !== 480) problems.push(`msToTick(500ms @120bpm) = ${msToTick(500, BPM)}, expected 480`);
if (msToTick(0, BPM) !== 0) problems.push('msToTick(0) must be 0');

// 2. chunk offset is applied
const chunk2 = mapAiNotes([{ n: 'A4', t_ms: 250, dur_ms: 250, v: 0.9 }], 12, BPM);
const expectedTick = msToTick(12250, BPM);
if (chunk2[0].startTick !== expectedTick) problems.push(`chunk offset wrong: ${chunk2[0].startTick} vs ${expectedTick}`);

// 3. octave clamping towards the register the DSP measured
const clamped = mapAiNotes(
  [{ n: 'A2', t_ms: 0, dur_ms: 500, v: 0.8 }, { n: 'A6', t_ms: 500, dur_ms: 500, v: 0.8 }],
  0, BPM, 69 /* A4 */
);
if (clamped.some((n) => Math.abs(midiOf(n) - 69) > 9)) {
  problems.push(`octave clamp failed: ${clamped.map((n) => n.note).join(',')}`);
}
if (clamped.map((n) => midiOf(n) % 12).some((pc) => pc !== 9)) problems.push('octave clamp changed the pitch class');

// 4. garbage is rejected
const junk = mapAiNotes([{ n: 'not-a-note', t_ms: 0, dur_ms: 100 }, { n: 'C-9', t_ms: 0, dur_ms: 100 }, null, { t_ms: 5 }] as any, 0, BPM);
if (junk.length !== 0) problems.push(`invalid entries survived: ${JSON.stringify(junk)}`);

// 5. monophony is enforced (overlaps trimmed, duplicate onsets dropped)
const overlapping = mapAiNotes([
  { n: 'C4', t_ms: 0, dur_ms: 2000, v: 0.8 },
  { n: 'E4', t_ms: 500, dur_ms: 500, v: 0.8 },
  { n: 'G4', t_ms: 500, dur_ms: 500, v: 0.8 },
], 0, BPM);
const mono = enforceMonophony(overlapping);
for (let i = 0; i < mono.length - 1; i++) {
  const end = (mono[i].startTick || 0) + (mono[i].durationTicks || 0);
  if (end > (mono[i + 1].startTick || 0)) problems.push(`overlap survived at index ${i}`);
}
if (mono.length !== 2) problems.push(`duplicate onset not removed (${mono.length} notes, expected 2)`);

// 6. spray guard
if (!isSprayResponse(200, 12)) problems.push('spray guard missed 200 notes in 12s');
if (isSprayResponse(30, 12)) problems.push('spray guard rejected a legitimate 30-note phrase');

// 7. minimum durations so nothing is inaudible
const shorty = mapAiNotes([{ n: 'C4', t_ms: 0, dur_ms: 5, v: 0.9 }], 0, BPM);
if ((shorty[0].durationTicks || 0) < 60) problems.push(`duration floor not applied: ${shorty[0].durationTicks}`);

console.log(`checked ms->tick math, chunk offsets, octave clamping, junk rejection, monophony, spray guard, duration floor`);
if (problems.length) {
  console.error('AI MELODY FAILURES:\n - ' + problems.join('\n - '));
  throw new Error('AI melody mapping check failed');
}
console.log('AI MELODY MAPPING CHECK PASSED');
