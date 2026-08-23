import { ChannelKey, GrooveObject, NoteEvent } from '../types';
import { theoryEngine } from './theoryEngine';
import { ELITE_16_CHANNELS } from './maestroService';
import { optimizationService } from './optimizationService';

export type QualityTool = 'TRACK' | 'LOOP' | 'AUDIO_TO_MIDI' | 'MIDI_TO_AUDIO';

export interface QualityCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  severity: 'info' | 'warn' | 'fail';
}

export interface QualityReport {
  tool: QualityTool;
  score: number;
  passed: boolean;
  checks: QualityCheck[];
  healed: string[];
}

const MELODIC: ChannelKey[] = ['ch4_leadA', 'ch5_leadB', 'ch6_arpA', 'ch7_arpB', 'ch14_acid', 'ch15_pad', 'ch16_synth'];
const DRUMS: ChannelKey[] = ['ch1_kick', 'ch8_snare', 'ch9_clap', 'ch12_hhClosed', 'ch13_hhOpen', 'ch10_percLoop', 'ch11_percTribal'];

const check = (id: string, label: string, passed: boolean, detail: string, severity: QualityCheck['severity'] = passed ? 'info' : 'warn'): QualityCheck =>
  ({ id, label, passed, detail, severity: passed ? 'info' : severity });

const midiOf = (n: NoteEvent) => theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);

function scoreFrom(checks: QualityCheck[]) {
  if (!checks.length) return 0;
  const weights = { info: 1, warn: 1, fail: 1.4 };
  let pts = 0;
  let max = 0;
  checks.forEach((c) => {
    const w = weights[c.severity === 'info' && c.passed ? 'info' : c.severity];
    max += w;
    if (c.passed) pts += w;
  });
  return Math.round((pts / max) * 100);
}

function healGroove(groove: GrooveObject): string[] {
  const healed: string[] = [];
  optimizationService.applyCommand(groove, { operation: 'SYSTEM_SYNC', params: { root: groove.key, mode: groove.scale } });
  healed.push('Quantized pitched notes to key/scale');

  const kick = groove.ch1_kick || [];
  kick.forEach((n) => {
    const m = midiOf(n);
    if (m < 34 || m > 38) {
      n.note = 'C2';
      healed.push('Mapped kick to GM C2');
    }
  });

  MELODIC.forEach((ch) => {
    const notes = (groove as any)[ch] as NoteEvent[];
    if (!notes?.length) return;
    notes.forEach((n) => {
      let m = midiOf(n);
      if (ch.includes('lead') || ch.includes('arp') || ch.includes('synth')) {
        while (m < 55) m += 12;
        while (m > 88) m -= 12;
        n.note = theoryEngine.midiToNote(m);
      }
      if (ch.includes('acid') && (m < 36 || m > 60)) {
        while (m < 36) m += 12;
        while (m > 60) m -= 12;
        n.note = theoryEngine.midiToNote(m);
      }
    });
  });

  ['ch2_sub', 'ch3_midBass'].forEach((ch) => {
    const notes = (groove as any)[ch] as NoteEvent[];
    notes?.forEach((n) => {
      let m = midiOf(n);
      const min = ch === 'ch2_sub' ? 24 : 36;
      const max = ch === 'ch2_sub' ? 43 : 55;
      while (m < min) m += 12;
      while (m > max) m -= 12;
      n.note = theoryEngine.midiToNote(m);
    });
  });

  optimizationService.applyCommand(groove, { operation: 'SYNC_MELODIC_INTERACTION', params: {} });
  healed.push('Cleared kick/bass collisions and note overlaps');
  return [...new Set(healed)];
}

export function inspectAndHealGroove(groove: GrooveObject, tool: QualityTool = 'TRACK'): { groove: GrooveObject, report: QualityReport } {
  const next = JSON.parse(JSON.stringify(groove)) as GrooveObject;
  const healed = healGroove(next);
  const checks: QualityCheck[] = [];
  const bars = next.totalBars || 64;
  const key = next.key || 'F#';
  const scale = next.scale || 'Phrygian';

  const counts = Object.fromEntries(ELITE_16_CHANNELS.map((ch) => [ch, ((next as any)[ch] || []).length]));
  const active = ELITE_16_CHANNELS.filter((ch) => counts[ch] > 0);

  checks.push(check('kick', 'Kick present', counts.ch1_kick > 0, counts.ch1_kick ? `${counts.ch1_kick} hits` : 'Missing kick', 'fail'));
  checks.push(check('sub', 'Sub bass present', counts.ch2_sub > 0, counts.ch2_sub ? `${counts.ch2_sub} notes` : 'Missing sub', 'fail'));
  checks.push(check('structure', 'Arrangement map', !!(next.structureMap && next.structureMap.length >= 4), next.structureMap ? `${next.structureMap.length} sections` : 'No form', 'fail'));
  checks.push(check('length', 'Track length', bars >= 32, `${bars} bars`, 'warn'));

  let outOfScale = 0;
  let melodicNotes = 0;
  let lowLeads = 0;
  MELODIC.forEach((ch) => {
    ((next as any)[ch] as NoteEvent[] || []).forEach((n) => {
      const name = Array.isArray(n.note) ? n.note[0] : n.note;
      melodicNotes++;
      if (!theoryEngine.isNoteInScale(name, key, scale)) outOfScale++;
      if ((ch.includes('lead') || ch.includes('arp')) && midiOf(n) < 52) lowLeads++;
    });
  });
  const scalePct = melodicNotes ? 1 - outOfScale / melodicNotes : 1;
  checks.push(check('scale', 'In-scale melody', scalePct >= 0.92, `${Math.round(scalePct * 100)}% in ${key} ${scale}`, 'fail'));
  checks.push(check('register', 'Lead register', lowLeads === 0, lowLeads ? `${lowLeads} lead notes too low` : 'Leads sit above the bass', 'warn'));
  checks.push(check('voices', 'Active instruments', active.length >= 4, `${active.length} channels`, 'warn'));

  const drop = next.structureMap?.find((s) => s.type === 'DROP');
  if (drop) {
    const kickInDrop = (next.ch1_kick || []).filter((n) => {
      const b = Math.floor((n.startTick || 0) / 1920);
      return b >= drop.startBar && b < drop.startBar + drop.durationBars;
    }).length;
    checks.push(check('drop', 'Drop has kick', kickInDrop > 8, kickInDrop ? `${kickInDrop} kick hits in drop` : 'Empty drop', 'fail'));
  }

  const score = scoreFrom(checks);
  return {
    groove: next,
    report: { tool, score, passed: score >= 78 && !checks.some((c) => !c.passed && c.severity === 'fail'), checks, healed },
  };
}

export function inspectAndHealLoop(notes: NoteEvent[], channel: ChannelKey, key: string, scale: string): { notes: NoteEvent[], report: QualityReport } {
  const next = JSON.parse(JSON.stringify(notes)) as NoteEvent[];
  const healed: string[] = [];
  next.forEach((n) => {
    const name = Array.isArray(n.note) ? n.note[0] : n.note;
    if (!name) return;
    if (!DRUMS.includes(channel) && !theoryEngine.isNoteInScale(name, key, scale)) {
      n.note = theoryEngine.getClosestNoteInScale(name, key, scale);
      healed.push('Snapped out-of-scale notes');
    }
    let m = midiOf(n);
    if (channel === 'ch1_kick' && (m < 34 || m > 38)) { n.note = 'C2'; healed.push('Kick → C2'); }
    if ((channel.includes('lead') || channel.includes('arp')) && (m < 55 || m > 88)) {
      while (m < 55) m += 12;
      while (m > 88) m -= 12;
      n.note = theoryEngine.midiToNote(m);
      healed.push('Moved melody into lead register');
    }
  });

  const checks: QualityCheck[] = [
    check('notes', 'Has notes', next.length > 0, `${next.length} events`, 'fail'),
    check('span', 'Covers 4 bars', next.some((n) => (n.startTick || 0) >= 1920), 'Loop occupies more than one bar', 'warn'),
  ];
  if (!DRUMS.includes(channel)) {
    const bad = next.filter((n) => !theoryEngine.isNoteInScale(Array.isArray(n.note) ? n.note[0] : n.note, key, scale)).length;
    checks.push(check('scale', 'In key', bad === 0, bad ? `${bad} off-key` : `${key} ${scale}`, 'fail'));
  }
  const score = scoreFrom(checks);
  return { notes: next, report: { tool: 'LOOP', score, passed: score >= 70, checks, healed: [...new Set(healed)] } };
}

export async function inspectAudioBlob(blob: Blob): Promise<QualityReport> {
  const checks: QualityCheck[] = [];
  const healed: string[] = [];
  try {
    const ctx = new OfflineAudioContext(2, 44100, 44100);
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const ch = buf.getChannelData(0);
    let peak = 0;
    let sum = 0;
    let silent = 0;
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      if (a > peak) peak = a;
      sum += a * a;
      if (a < 0.0008) silent++;
    }
    const rms = Math.sqrt(sum / ch.length);
    const lufsApprox = 20 * Math.log10(Math.max(rms, 1e-8));
    checks.push(check('decode', 'WAV decodes', true, `${buf.duration.toFixed(1)}s / ${buf.sampleRate}Hz`));
    checks.push(check('peak', 'No clip', peak < 0.99, `Peak ${(peak * 100).toFixed(1)}%`, 'fail'));
    checks.push(check('loud', 'Has energy', rms > 0.01, `RMS ${rms.toFixed(3)} (${lufsApprox.toFixed(1)} dBFS)`, 'fail'));
    checks.push(check('silence', 'Not empty', silent / ch.length < 0.92, `${Math.round((1 - silent / ch.length) * 100)}% active`, 'warn'));
    checks.push(check('length', 'Usable length', buf.duration >= 1, `${buf.duration.toFixed(1)} seconds`, 'warn'));
  } catch (e: any) {
    checks.push(check('decode', 'WAV decodes', false, e?.message || 'Decode failed', 'fail'));
  }
  const score = scoreFrom(checks);
  return { tool: 'MIDI_TO_AUDIO', score, passed: score >= 75, checks, healed };
}
