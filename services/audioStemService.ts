import { ChannelKey, GrooveObject, MusicGenre, NoteEvent } from '../types';
import { ELITE_16_CHANNELS } from './maestroService';
import { theoryEngine } from './theoryEngine';
import { composeProfessionalTrack } from './trackComposer';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface AudioStemAnalysis {
  bpm: number;
  key: string;
  scale: string;
  durationSec: number;
  lead: NoteEvent[];
  kickHits: number[];
  hatHits: number[];
  bassNotes: NoteEvent[];
  kickMask: number[];
  detected: Partial<Record<ChannelKey, number>>;
}

export interface ArrangeOptions {
  genre: MusicGenre | string;
  bpm?: number;
  key?: string;
  scale?: string;
  trackName?: string;
}

const ev = (midi: number, startTick: number, durationTicks: number, velocity: number): NoteEvent => {
  const bar = Math.floor(startTick / 1920);
  const beat = Math.floor((startTick % 1920) / 480);
  const six = Math.floor((startTick % 480) / 120);
  return {
    note: theoryEngine.midiToNote(Math.round(midi)),
    time: `${bar}:${beat}:${six}`,
    duration: 'custom',
    durationTicks: Math.max(40, Math.round(durationTicks)),
    startTick: Math.max(0, Math.round(startTick)),
    velocity: Math.max(0.25, Math.min(1, velocity)),
  };
};

function downsample(input: Float32Array, from: number, to: number) {
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) out[i] = input[Math.floor(i * ratio)] || 0;
  return out;
}

function applyBand(samples: Float32Array, sr: number, hpHz: number, lpHz: number) {
  const out = new Float32Array(samples.length);
  const aHp = Math.exp(-2 * Math.PI * hpHz / sr);
  const aLp = 1 - Math.exp(-2 * Math.PI * lpHz / sr);
  let hp = 0;
  let lp = 0;
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    hp = aHp * (hp + samples[i] - prev);
    prev = samples[i];
    lp += aLp * (hp - lp);
    out[i] = lp;
  }
  return out;
}

function simpleFlux(samples: Float32Array, hop: number) {
  const flux: number[] = [];
  let prev = 0;
  for (let i = 0; i + hop < samples.length; i += hop) {
    let e = 0;
    for (let j = 0; j < hop; j++) e += samples[i + j] * samples[i + j];
    const rms = Math.sqrt(e / hop);
    flux.push(Math.max(0, rms - prev * 0.8));
    prev = rms;
  }
  return flux;
}

function estimateBpm(flux: number[], hop: number, sr: number) {
  const hopSec = hop / sr;
  const scores: { bpm: number; s: number }[] = [];
  for (let bpm = 120; bpm <= 155; bpm++) {
    const lag = 60 / bpm / hopSec;
    if (lag < 2) continue;
    let s = 0;
    const iLag = Math.round(lag);
    for (let i = 0; i + iLag < flux.length; i++) s += flux[i] * flux[i + iLag];
    const half = Math.round(lag / 2);
    if (half > 1) {
      for (let i = 0; i + half < flux.length; i++) s += flux[i] * flux[i + half] * 0.35;
    }
    scores.push({ bpm, s });
  }
  scores.sort((a, b) => b.s - a.s);
  return scores[0]?.bpm || 145;
}

function yinHz(frame: Float32Array, sr: number, minF = 110, maxF = 900): number | null {
  const n = frame.length;
  const minTau = Math.max(2, Math.floor(sr / maxF));
  const maxTau = Math.min(Math.floor(sr / minF), Math.floor(n / 2) - 2);
  if (maxTau <= minTau + 2) return null;
  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    const lim = n - tau;
    for (let i = 0; i < lim; i++) {
      const diff = frame[i] - frame[i + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  let running = 0;
  const cmnd = new Float32Array(maxTau + 1);
  cmnd[0] = 1;
  for (let tau = 1; tau <= maxTau; tau++) {
    running += d[tau];
    cmnd[tau] = running ? (d[tau] * tau) / running : 1;
  }
  const threshold = 0.18;
  let tauEst = -1;
  for (let tau = minTau; tau <= maxTau; tau++) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEst = tau;
      break;
    }
  }
  if (tauEst < 0) {
    let best = 1;
    for (let tau = minTau; tau <= maxTau; tau++) {
      if (cmnd[tau] < best) {
        best = cmnd[tau];
        tauEst = tau;
      }
    }
    if (best > 0.45) return null;
  }
  const s0 = cmnd[Math.max(0, tauEst - 1)];
  const s1 = cmnd[tauEst];
  const s2 = cmnd[Math.min(maxTau, tauEst + 1)];
  const denom = 2 * s1 - s2 - s0;
  const adj = denom !== 0 ? (s0 - s2) / (2 * denom) : 0;
  const hz = sr / (tauEst + adj);
  if (!Number.isFinite(hz) || hz < minF || hz > maxF) return null;
  return hz;
}

function hzToMidi(hz: number) {
  return 69 + 12 * Math.log2(hz / 440);
}

function peakTimes(values: number[], hop: number, sr: number, threshRatio: number) {
  const mean = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  const thresh = mean * threshRatio;
  const times: number[] = [];
  for (let i = 2; i < values.length - 2; i++) {
    if (values[i] > thresh && values[i] >= values[i - 1] && values[i] >= values[i + 1]) {
      if (!times.length || (i * hop) / sr - times[times.length - 1] > 0.08) {
        times.push((i * hop) / sr);
      }
    }
  }
  return times;
}

function chromaKey(midiHist: number[]) {
  const templates: Record<string, number[]> = {
    Minor: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0],
    Phrygian: [1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0],
    Major: [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
    Dorian: [1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0],
  };
  let best = { key: 'F#', scale: 'Phrygian', score: -1 };
  for (let root = 0; root < 12; root++) {
    for (const [scale, tmpl] of Object.entries(templates)) {
      let s = 0;
      for (let i = 0; i < 12; i++) s += (midiHist[i] || 0) * tmpl[(i - root + 12) % 12];
      if (s > best.score) best = { key: NOTE_NAMES[root], scale, score: s };
    }
  }
  return best;
}

function secToTick(sec: number, bpm: number) {
  return Math.round((sec * bpm * 480) / 60 / 30) * 30;
}

function buildKickMask(hits: number[], bpm: number) {
  const stepSec = 60 / bpm / 4;
  const hist = new Array(16).fill(0);
  hits.forEach((t) => {
    hist[Math.round(t / stepSec) % 16] += 1;
  });
  const max = Math.max(1, ...hist);
  const mask = hist.map((h) => (h >= max * 0.28 ? 1 : 0));
  if (mask[0] + mask[4] + mask[8] + mask[12] < 2) {
    return [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  }
  return mask;
}

export async function analyzeSongToStems(
  file: File,
  onProgress?: (p: number) => void,
  override?: { bpm?: number; key?: string; scale?: string }
): Promise<AudioStemAnalysis> {
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new Ctx();
  onProgress?.(8);
  const raw = await file.arrayBuffer();
  onProgress?.(16);
  const decoded = await ctx.decodeAudioData(raw.slice(0));
  onProgress?.(26);
  const src = decoded.numberOfChannels > 1
    ? (() => {
        const a = decoded.getChannelData(0);
        const b = decoded.getChannelData(1);
        const m = new Float32Array(a.length);
        for (let i = 0; i < a.length; i++) m[i] = (a[i] + b[i]) * 0.5;
        return m;
      })()
    : decoded.getChannelData(0);
  const take = Math.min(src.length, Math.floor(decoded.sampleRate * 90));
  const slice = src.subarray(0, take);
  const sr = 11025;
  const mono = downsample(slice, decoded.sampleRate, sr);
  const hop = 512;
  const flux = simpleFlux(mono, hop);
  const bpm = override?.bpm && override.bpm > 40 ? override.bpm : estimateBpm(flux, hop, sr);
  onProgress?.(40);

  const low = applyBand(mono, sr, 20, 160);
  const high = applyBand(mono, sr, 5000, 9000);
  const mid = applyBand(mono, sr, 280, 1800);
  const lowFlux = simpleFlux(low, hop);
  const highFlux = simpleFlux(high, hop);
  const kickHits = peakTimes(lowFlux, hop, sr, 1.7);
  const hatHits = peakTimes(highFlux, hop, sr, 1.35);
  const kickMask = buildKickMask(kickHits, bpm);
  onProgress?.(55);

  const frame = 1024;
  const hopP = 512;
  const midis: { t: number; m: number; v: number }[] = [];
  const hist = new Array(12).fill(0);
  for (let i = 0; i + frame < mid.length; i += hopP) {
    const win = mid.subarray(i, i + frame);
    let e = 0;
    for (let j = 0; j < win.length; j++) e += win[j] * win[j];
    const rms = Math.sqrt(e / win.length);
    if (rms < 0.008) continue;
    const hz = yinHz(win, sr);
    if (!hz) continue;
    const midi = hzToMidi(hz);
    if (midi < 50 || midi > 86) continue;
    hist[Math.round(midi) % 12] += rms;
    midis.push({ t: i / sr, m: midi, v: Math.min(1, 0.4 + rms * 10) });
  }
  const guessed = chromaKey(hist);
  const key = override?.key || guessed.key;
  const scale = override?.scale || guessed.scale;
  onProgress?.(72);

  const lead: NoteEvent[] = [];
  if (midis.length) {
    let start = midis[0];
    let last = midis[0];
    const flush = () => {
      const rawMidi = Math.round((start.m + last.m) / 2);
      const snapped = theoryEngine.snapMidiToScale(rawMidi, key, scale);
      const lifted = snapped < 55 ? snapped + 12 : snapped > 86 ? snapped - 12 : snapped;
      const startTick = secToTick(start.t, bpm);
      const durSec = Math.max(0.09, last.t - start.t + hopP / sr);
      lead.push(ev(lifted, startTick, (durSec * bpm * 480) / 60, last.v));
    };
    for (let i = 1; i < midis.length; i++) {
      const cur = midis[i];
      const samePitch = Math.abs(cur.m - last.m) < 0.8;
      const close = cur.t - last.t < 0.22;
      if (samePitch && close) last = cur;
      else {
        flush();
        start = cur;
        last = cur;
      }
    }
    flush();
  }

  const bassNotes = lead.filter((_, i) => i % 2 === 0).map((n) => {
    let m = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
    while (m > 46) m -= 12;
    while (m < 28) m += 12;
    return ev(m, n.startTick || 0, Math.min(200, n.durationTicks || 120), 0.82);
  });

  await ctx.close();
  onProgress?.(84);
  return {
    bpm,
    key,
    scale,
    durationSec: decoded.duration,
    lead,
    kickHits,
    hatHits,
    bassNotes,
    kickMask,
    detected: {
      ch1_kick: kickHits.length,
      ch2_sub: bassNotes.length,
      ch3_midBass: bassNotes.length,
      ch4_leadA: lead.length,
      ch8_snare: Math.round(kickHits.length * 0.4),
      ch12_hhClosed: hatHits.length,
      ch13_hhOpen: Math.round(hatHits.length * 0.2),
      ch15_pad: lead.length ? 1 : 0,
    },
  };
}

function tileLead(source: NoteEvent[], startBar: number, bars: number, lift = 0) {
  if (!source.length) return [];
  const loopTicks = Math.max(1920, Math.max(...source.map((n) => (n.startTick || 0) + (n.durationTicks || 120))));
  const loopBars = Math.max(4, Math.ceil(loopTicks / 1920));
  const loopLen = loopBars * 1920;
  const out: NoteEvent[] = [];
  for (let bar = 0; bar < bars; bar += loopBars) {
    const offset = (startBar + bar) * 1920;
    source.forEach((n) => {
      const local = (n.startTick || 0) % loopLen;
      if (bar * 1920 + local >= bars * 1920) return;
      let midi = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note) + lift;
      out.push(ev(midi, offset + local, n.durationTicks || 160, n.velocity || 0.8));
    });
  }
  return out;
}

export function arrangeTranceFromAnalysis(analysis: AudioStemAnalysis, options: ArrangeOptions): GrooveObject {
  const bpm = options.bpm && options.bpm > 40 ? options.bpm : analysis.bpm;
  const key = options.key || analysis.key;
  const scale = options.scale || analysis.scale;
  const groove = composeProfessionalTrack(
    { bpm, key, scale, genre: options.genre, trackName: options.trackName || `From Audio · ${key} ${scale}` },
    1,
    ['ch1_kick', 'ch2_sub', 'ch3_midBass', 'ch4_leadA', 'ch8_snare', 'ch12_hhClosed', 'ch15_pad']
  );

  const ratio = bpm / Math.max(80, analysis.bpm);
  const extracted = analysis.lead.map((n) => {
    let midi = theoryEngine.snapMidiToScale(
      theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note),
      key,
      scale
    );
    while (midi < 55) midi += 12;
    while (midi > 86) midi -= 12;
    return ev(midi, (n.startTick || 0) * ratio, Math.max(80, (n.durationTicks || 160) * ratio), n.velocity || 0.8);
  });

  const hero = extracted.length ? extracted : groove.ch4_leadA;
  const drops = (groove.structureMap || []).filter((s) => s.type === 'DROP' || s.type === 'MELODY_INTRO' || s.type === 'BREAKDOWN');
  const leadOut: NoteEvent[] = [];
  if (drops.length && hero.length) {
    drops.forEach((section) => {
      const lift = section.type === 'DROP' && section.energy >= 4 ? 12 : 0;
      leadOut.push(...tileLead(hero, section.startBar, section.durationBars, lift > 0 ? 0 : 0));
      if (section.type === 'DROP') {
        const climax = tileLead(hero, section.startBar + Math.floor(section.durationBars / 2), Math.min(8, section.durationBars), 12);
        leadOut.push(...climax);
      }
    });
    groove.ch4_leadA = leadOut.sort((a, b) => (a.startTick || 0) - (b.startTick || 0));
  } else if (hero.length) {
    groove.ch4_leadA = tileLead(hero, 16, Math.max(16, (groove.totalBars || 32) - 24));
  }

  groove.ch5_leadB = groove.ch4_leadA.filter((_, i) => i % 2 === 1).map((n) => {
    const m = theoryEngine.snapMidiToScale(theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note) + 3, key, scale);
    return ev(m, (n.startTick || 0) + 60, Math.max(80, (n.durationTicks || 160) - 30), 0.58);
  });

  const mask = analysis.kickMask?.length === 16 ? analysis.kickMask : [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  const totalBars = groove.totalBars || 64;
  const styledKick: NoteEvent[] = [];
  for (let bar = 0; bar < totalBars; bar++) {
    mask.forEach((on, step) => {
      if (!on) return;
      styledKick.push(ev(36, bar * 1920 + step * 120, step % 4 === 0 ? 140 : 50, step % 4 === 0 ? 1 : 0.45));
    });
  }
  if (styledKick.length) groove.ch1_kick = styledKick;

  const bassSrc = analysis.bassNotes.length ? analysis.bassNotes : extracted;
  if (bassSrc.length) {
    groove.ch2_sub = tileLead(bassSrc.map((n) => {
      let m = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
      while (m > 43) m -= 12;
      while (m < 24) m += 12;
      return ev(m, n.startTick || 0, 90, 0.84);
    }), 8, Math.max(16, totalBars - 16));
  }

  const PREVIEW_BARS = 32;
  ELITE_16_CHANNELS.forEach((ch) => {
    const notes = ((groove as any)[ch] || []) as NoteEvent[];
    (groove as any)[ch] = notes.filter((n) => (n.startTick || 0) < PREVIEW_BARS * 1920).slice(0, 240);
  });
  groove.totalBars = PREVIEW_BARS;

  groove.meta = {
    ...(groove.meta || {}),
    architecture: 'Audio melody + style arrangement',
    sourceBpm: analysis.bpm,
    detectedChannels: analysis.detected,
    leadNotes: analysis.lead.length,
  };
  groove.analysisMeta = {
    detectedBpm: analysis.bpm,
    usedBpm: bpm,
    detectedKey: `${analysis.key} ${analysis.scale}`,
    usedKey: `${key} ${scale}`,
    durationSec: analysis.durationSec,
    channels: analysis.detected,
    kickMask: mask,
  };
  return groove;
}

export async function decodeIfAudio(file: File): Promise<boolean> {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const buf = await file.arrayBuffer();
    await ctx.decodeAudioData(buf.slice(0));
    await ctx.close();
    return true;
  } catch {
    return false;
  }
}
