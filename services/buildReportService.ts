import { ChannelKey, GrooveObject, NoteEvent } from '../types';
import { ELITE_16_CHANNELS } from './maestroService';
import { theoryEngine } from './theoryEngine';
import { QualityReport } from './qualityGateService';

export const ENGINE_BUILD = '2026-08-24-editable-lead-channel';

export type BuildTool = 'TRACK' | 'LOOP' | 'AUDIO_TO_MIDI' | 'STUDIO' | 'OTHER';

const midiOf = (n: NoteEvent) => theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);

const CHANNEL_LABEL: Record<string, string> = {
  ch1_kick: 'Kick', ch2_sub: 'Sub', ch3_midBass: 'MidBass', ch4_leadA: 'LeadA',
  ch5_leadB: 'LeadB', ch6_arpA: 'ArpA', ch7_arpB: 'ArpB', ch8_snare: 'Snare',
  ch9_clap: 'Clap', ch10_percLoop: 'Perc', ch11_percTribal: 'Tribal',
  ch12_hhClosed: 'HHClosed', ch13_hhOpen: 'HHOpen', ch14_acid: 'Acid',
  ch15_pad: 'Pad', ch16_synth: 'FX',
};

function channelStats(notes: NoteEvent[], key: string, scale: string) {
  if (!notes.length) {
    return { count: 0, min: 0, max: 0, unique: 0, longs: 0, shorts: 0, inScale: 100, span: 0, avgDur: 0, contour: '' };
  }
  const midis = notes.map(midiOf);
  const uniq = new Set(midis);
  const longs = notes.filter((n) => (n.durationTicks || 0) >= 240).length;
  const shorts = notes.filter((n) => (n.durationTicks || 0) < 160).length;
  const inScale = notes.filter((n) => theoryEngine.isNoteInScale(Array.isArray(n.note) ? n.note[0] : n.note, key, scale)).length;
  const avgDur = Math.round(notes.reduce((s, n) => s + (n.durationTicks || 0), 0) / notes.length);
  const contour = notes.slice(0, 16).map((n) => {
    const name = Array.isArray(n.note) ? n.note[0] : n.note;
    return `${name}@${n.startTick || 0}(${n.durationTicks || 0})`;
  }).join(' ');
  return {
    count: notes.length,
    min: Math.min(...midis),
    max: Math.max(...midis),
    unique: uniq.size,
    longs,
    shorts,
    inScale: Math.round((inScale / notes.length) * 100),
    span: Math.max(...midis) - Math.min(...midis),
    avgDur,
    contour,
  };
}

function kickTicks(groove: GrooveObject) {
  return new Set((groove.ch1_kick || []).map((n) => n.startTick || 0));
}

export function buildMidiReport(groove: GrooveObject, tool: BuildTool = 'OTHER', quality?: QualityReport, extra?: Record<string, string | number | undefined>): string {
  const key = groove.key || '?';
  const scale = groove.scale || '?';
  const bpm = groove.bpm || 0;
  const bars = groove.totalBars || 0;
  const kicks = kickTicks(groove);
  const collisions = (groove.ch2_sub || []).filter((n) => kicks.has(n.startTick || 0)).length;
  const issues: string[] = [];

  const lines: string[] = [];
  lines.push('MIDI AI BUILD REPORT');
  lines.push('====================');
  lines.push(`engine: ${ENGINE_BUILD}`);
  lines.push(`tool: ${tool}`);
  lines.push(`name: ${groove.name || groove.id || 'untitled'}`);
  lines.push(`id: ${groove.id || '-'}`);
  lines.push(`created: ${new Date().toISOString()}`);
  lines.push(`bpm: ${bpm}`);
  lines.push(`key: ${key} ${scale}`);
  lines.push(`genre: ${groove.genre || '-'}`);
  lines.push(`style: ${(groove.meta as any)?.style || '-'}`);
  lines.push(`bars: ${bars}`);
  lines.push(`ppq: 480`);
  lines.push(`architecture: ${(groove.meta as any)?.architecture || '-'}`);
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => {
      if (v !== undefined && v !== '') lines.push(`${k}: ${v}`);
    });
  }
  if (groove.analysisMeta) {
    lines.push(`a2m.detectedBpm: ${groove.analysisMeta.detectedBpm ?? '-'}`);
    lines.push(`a2m.usedBpm: ${groove.analysisMeta.usedBpm ?? '-'}`);
    lines.push(`a2m.detectedKey: ${groove.analysisMeta.detectedKey ?? '-'}`);
    lines.push(`a2m.mode: ${groove.analysisMeta.mode ?? '-'}`);
    lines.push(`a2m.durationSec: ${groove.analysisMeta.durationSec ?? '-'}`);
  }
  lines.push('');
  lines.push('CHANNELS');
  ELITE_16_CHANNELS.forEach((ch) => {
    const notes = ((groove as any)[ch] || []) as NoteEvent[];
    const s = channelStats(notes, key, scale);
    const label = CHANNEL_LABEL[ch] || ch;
    if (!s.count) {
      lines.push(`${ch} ${label}: empty`);
      return;
    }
    lines.push(`${ch} ${label}: n=${s.count} midi=${s.min}-${s.max} uniq=${s.unique} span=${s.span}st long=${s.longs} short=${s.shorts} inScale=${s.inScale}% avgDur=${s.avgDur}`);
    if (s.contour) lines.push(`  contour: ${s.contour}`);
    if (ch === 'ch4_leadA') {
      if (s.shorts > s.count * 0.35) issues.push(`lead has ${s.shorts}/${s.count} notes shorter than 160ms (jitter)`);
      if (s.unique < 5 && s.count >= 8) issues.push(`lead has only ${s.unique} pitches`);
      if (s.span < 7 && s.count >= 8) issues.push(`lead span only ${s.span} semitones`);
      if (s.min < 55) issues.push(`lead sits low (min MIDI ${s.min})`);
      if (s.count > Math.max(40, bars * 4)) issues.push(`lead density high (${s.count} notes / ${bars} bars)`);
    }
  });

  lines.push('');
  lines.push('GROOVE CHECKS');
  lines.push(`kickHits: ${(groove.ch1_kick || []).length}`);
  lines.push(`bassOnKick: ${collisions}`);
  if (collisions > 0) issues.push(`${collisions} bass notes land on kick (pump broken)`);
  const map = groove.structureMap || [];
  lines.push(`sections: ${map.length} ${map.map((s) => `${s.type}@${s.startBar}+${s.durationBars}`).join(' | ') || '-'}`);

  if (quality) {
    lines.push('');
    lines.push(`QA score: ${quality.score} ${quality.passed ? 'PASS' : 'FAIL'}`);
    quality.checks.forEach((c) => lines.push(`  ${c.passed ? 'ok' : c.severity}: ${c.label} — ${c.detail}`));
    if (quality.healed.length) lines.push(`healed: ${quality.healed.join(' | ')}`);
  }

  if (!issues.length) issues.push('none auto-detected');
  lines.push('');
  lines.push('ISSUES');
  issues.forEach((i) => lines.push(`- ${i}`));
  lines.push('');
  lines.push('PASTE THIS ENTIRE REPORT BACK TO THE AGENT');
  lines.push('====================');
  return lines.join('\n');
}

export function downloadTextReport(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
}

export async function copyTextReport(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

export function reportFilename(groove: GrooveObject) {
  const base = (groove.name || 'MIDI_AI').replace(/[^\w\- ]+/g, '').trim() || 'MIDI_AI';
  return `${base}_BUILD_REPORT.txt`;
}

export function loopAsGroove(notes: NoteEvent[], channel: ChannelKey, bpm: number, key: string, scale: string, genre?: string): GrooveObject {
  const g: any = {
    id: `LOOP-${Date.now()}`,
    name: `Loop ${CHANNEL_LABEL[channel] || channel}`,
    bpm, key, scale, genre, totalBars: 4,
    meta: { architecture: 'Seeded style loop', style: genre },
  };
  ELITE_16_CHANNELS.forEach((ch) => { g[ch] = []; });
  g[channel] = notes;
  return g as GrooveObject;
}
