import { ChannelKey, GrooveObject, MusicGenre, NoteEvent } from '../types';
import { ELITE_16_CHANNELS } from './maestroService';
import { theoryEngine } from './theoryEngine';
import { composeProfessionalTrack } from './trackComposer';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface AudioStemAnalysis {
  bpm: number;
  sourceBpm?: number;
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
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const f = x - i0;
    out[i] = (input[i0] || 0) * (1 - f) + (input[i0 + 1] || 0) * f;
  }
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

function yinPitch(frame: Float32Array, sr: number, minF: number, maxF: number): { hz: number; conf: number } | null {
  const hz = yinHz(frame, sr, minF, maxF);
  if (!hz) return null;
  return { hz, conf: 0.82 };
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

function softSnap(midi: number, key: string, scale: string) {
  const raw = Math.round(midi);
  const snapped = theoryEngine.snapMidiToScale(raw, key, scale);
  return Math.abs(snapped - raw) <= 1 ? snapped : raw;
}

function trackPitch(
  samples: Float32Array,
  sr: number,
  hop: number,
  frame: number,
  minF: number,
  maxF: number,
  minMidi: number,
  maxMidi: number
) {
  const out: { t: number; m: number; v: number }[] = [];
  let prev: number | null = null;
  for (let i = 0; i + frame < samples.length; i += hop) {
    const win = samples.subarray(i, i + frame);
    let e = 0;
    for (let j = 0; j < win.length; j++) e += win[j] * win[j];
    const rms = Math.sqrt(e / win.length);
    if (rms < 0.006) { prev = null; continue; }
    const hit = yinPitch(win, sr, minF, maxF);
    if (!hit || hit.conf < 0.55) { continue; }
    let midi = hzToMidi(hit.hz);
    if (prev != null) {
      const down = midi - 12;
      const up = midi + 12;
      if (Math.abs(down - prev) + 1.2 < Math.abs(midi - prev)) midi = down;
      else if (Math.abs(up - prev) + 1.2 < Math.abs(midi - prev)) midi = up;
    }
    if (midi < minMidi || midi > maxMidi) continue;
    prev = midi;
    out.push({ t: i / sr, m: midi, v: Math.min(1, 0.3 + rms * 8) * hit.conf });
  }
  if (out.length < 5) return out;
  const smooth = out.map((p, i) => {
    const a = out[Math.max(0, i - 2)].m;
    const b = out[i].m;
    const c = out[Math.min(out.length - 1, i + 2)].m;
    return { ...p, m: [a, b, c].sort((x, y) => x - y)[1] };
  });
  return smooth;
}

function contourToNotes(
  frames: { t: number; m: number; v: number }[],
  bpm: number,
  key: string,
  scale: string
): NoteEvent[] {
  if (!frames.length) return [];
  const notes: NoteEvent[] = [];
  let start = frames[0];
  let last = frames[0];
  const flush = () => {
    const hold = last.t - start.t + 0.04;
    if (hold < 0.06) return;
    const midi = softSnap((start.m + last.m) * 0.5, key, scale);
    notes.push(ev(midi, secToTick(start.t, bpm), (hold * bpm * 480) / 60, last.v));
  };
  for (let i = 1; i < frames.length; i++) {
    const cur = frames[i];
    const same = Math.abs(cur.m - last.m) < 0.7;
    const close = cur.t - last.t < 0.12;
    if (same && close) last = cur;
    else {
      flush();
      start = cur;
      last = cur;
    }
  }
  flush();
  return notes;
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
  const take = Math.min(src.length, Math.floor(decoded.sampleRate * 150));
  const slice = src.subarray(0, take);
  const sr = 16000;
  const mono = downsample(slice, decoded.sampleRate, sr);
  const hop = 320;
  const flux = simpleFlux(mono, hop);
  const detectedBpm = estimateBpm(flux, hop, sr);
  const targetBpm = override?.bpm && override.bpm >= 80 ? override.bpm : detectedBpm;
  onProgress?.(40);
  const low = applyBand(mono, sr, 30, 180);
  const high = applyBand(mono, sr, 5000, 9000);
  const mid = applyBand(mono, sr, 220, 2800);
  const lowFlux = simpleFlux(low, hop);
  const highFlux = simpleFlux(high, hop);
  const kickHits = peakTimes(lowFlux, hop, sr, 1.7);
  const hatHits = peakTimes(highFlux, hop, sr, 1.35);
  const kickMask = buildKickMask(kickHits, detectedBpm);
  onProgress?.(55);

  const frame = 1024;
  const hopP = 320;
  const midis = trackPitch(mid, sr, hopP, frame, 196, 1200, 55, 91);
  const bassFrames = trackPitch(low, sr, hopP, frame, 40, 200, 24, 50);
  const hist = new Array(12).fill(0);
  midis.forEach((p) => { hist[Math.round(p.m) % 12] += p.v; });
  const guessed = chromaKey(hist);
  const key = override?.key || guessed.key;
  const scale = override?.scale || guessed.scale;
  onProgress?.(72);

  const lead = contourToNotes(midis, detectedBpm, key, scale);
  const bassNotes = contourToNotes(bassFrames, detectedBpm, key, scale).map((n) => {
    let m = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
    while (m > 43) m -= 12;
    while (m < 24) m += 12;
    return ev(m, n.startTick || 0, Math.min(280, n.durationTicks || 120), 0.84);
  });

  await ctx.close();
  onProgress?.(84);
  return {
    bpm: targetBpm,
    sourceBpm: detectedBpm,
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

export function arrangeTranceFromAnalysis(analysis: AudioStemAnalysis, options: ArrangeOptions): GrooveObject {
  const bpm = options.bpm && options.bpm > 40 ? options.bpm : analysis.bpm;
  const key = options.key || analysis.key;
  const scale = options.scale || analysis.scale;
  const sourceBpm = Math.max(80, analysis.sourceBpm || analysis.bpm || bpm);
  const tickScale = bpm / sourceBpm;
  const lastLead = analysis.lead.reduce((m, n) => Math.max(m, (n.startTick || 0) + (n.durationTicks || 0)), 0);
  const totalBars = Math.min(96, Math.max(16, Math.ceil((lastLead * tickScale) / 1920) + 2));
  const minutes = (totalBars * 4) / Math.max(80, bpm);
  const groove = composeProfessionalTrack(
    { bpm, key, scale, genre: options.genre, trackName: options.trackName || `From Audio · ${key} ${scale}` },
    minutes,
    [...ELITE_16_CHANNELS]
  );

  const place = (n: NoteEvent, extraVel = 0) => {
    const midi = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
    return ev(
      midi,
      Math.round((n.startTick || 0) * tickScale),
      Math.max(50, Math.round((n.durationTicks || 160) * tickScale)),
      Math.min(1, (n.velocity || 0.8) + extraVel)
    );
  };

  const extracted = analysis.lead.map((n) => place(n, 0.1));
  groove.ch4_leadA = extracted
    .filter((n) => (n.startTick || 0) < totalBars * 1920)
    .sort((a, b) => (a.startTick || 0) - (b.startTick || 0));

  groove.ch5_leadB = groove.ch4_leadA
    .filter((n) => (n.durationTicks || 0) >= 240)
    .map((n) => {
      const m = softSnap(theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note) + 7, key, scale);
      return ev(m, n.startTick || 0, n.durationTicks || 240, 0.36);
    });

  const intervals = theoryEngine.getScaleIntervals(scale);
  const root = theoryEngine.getMidiNote(`${key}3`);
  const motif = extracted.slice(0, 8).map((n) => {
    const pc = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note) % 12;
    let best = 0;
    let dist = 12;
    intervals.forEach((iv, i) => {
      const d = Math.min((pc - ((root + iv) % 12) + 12) % 12, (((root + iv) % 12) - pc + 12) % 12);
      if (d < dist) { dist = d; best = i; }
    });
    return best;
  });
  if (!motif.length) motif.push(0, 2, 3, 5);

  const fillBars = (write: (bar: number) => NoteEvent[]) => {
    const out: NoteEvent[] = [];
    for (let bar = 0; bar < totalBars; bar++) out.push(...write(bar));
    return out;
  };

  groove.ch6_arpA = fillBars((bar) => {
    if (bar % 16 < 4) return [];
    return [0, 4, 8, 12].map((s, i) => ev(root + 12 + intervals[motif[(i + bar) % motif.length] % intervals.length], bar * 1920 + s * 120, 100, 0.45));
  });
  groove.ch7_arpB = fillBars((bar) => {
    if (bar % 16 < 8) return [];
    return [2, 6, 10, 14].map((s, i) => ev(root + 24 + intervals[motif[(i + 2) % motif.length] % intervals.length], bar * 1920 + s * 120, 80, 0.38));
  });
  groove.ch14_acid = fillBars((bar) => {
    if (bar % 8 === 0) return [];
    return [1, 3, 5, 7, 9, 11, 13, 15].map((s, i) => ev(root - 12 + intervals[motif[i % motif.length] % intervals.length], bar * 1920 + s * 120, 50, 0.55));
  });
  groove.ch16_synth = fillBars((bar) => {
    if (bar % 16 !== 15 && bar % 16 !== 7) return [];
    return [ev(root + 36 + intervals[0], bar * 1920, 480, 0.4)];
  });
  groove.ch11_percTribal = fillBars((bar) => {
    if (bar < 8) return [];
    return [1, 7, 11].map((s) => ev(62, bar * 1920 + s * 120, 50, 0.4));
  });
  groove.ch10_percLoop = fillBars((bar) => {
    if (bar % 4 === 3) return [3, 10, 14].map((s) => ev(60, bar * 1920 + s * 120, 40, 0.35));
    return [];
  });
  groove.ch13_hhOpen = fillBars((bar) => (bar % 2 === 1 ? [ev(46, bar * 1920 + 14 * 120, 80, 0.45)] : []));
  groove.ch9_clap = fillBars((bar) => (bar >= 8 ? [ev(39, bar * 1920 + 4 * 120, 80, 0.6), ev(39, bar * 1920 + 12 * 120, 80, 0.55)] : []));

  const mask = analysis.kickMask?.length === 16 ? analysis.kickMask : [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  const kickBars = totalBars;
  const styledKick: NoteEvent[] = [];
  for (let bar = 0; bar < kickBars; bar++) {
    mask.forEach((on, step) => {
      if (!on) return;
      styledKick.push(ev(36, bar * 1920 + step * 120, step % 4 === 0 ? 140 : 50, step % 4 === 0 ? 1 : 0.45));
    });
  }
  if (styledKick.length) groove.ch1_kick = styledKick;

  const bassSrc = (analysis.bassNotes.length ? analysis.bassNotes : extracted).map((n) => place(n));
  if (bassSrc.length) {
    groove.ch2_sub = bassSrc.map((n) => {
      let m = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
      while (m > 43) m -= 12;
      while (m < 24) m += 12;
      return ev(m, n.startTick || 0, Math.min(240, n.durationTicks || 120), 0.84);
    }).filter((n) => (n.startTick || 0) < totalBars * 1920);
  }

  const lastTick = totalBars * 1920;
  ELITE_16_CHANNELS.forEach((ch) => {
    const notes = (((groove as any)[ch] || []) as NoteEvent[])
      .filter((n) => (n.startTick || 0) < lastTick)
      .sort((a, b) => (a.startTick || 0) - (b.startTick || 0));
    if (ch === 'ch4_leadA' || ch === 'ch2_sub') {
      (groove as any)[ch] = notes.slice(0, 1200);
      return;
    }
    (groove as any)[ch] = notes.slice(0, ch.includes('kick') ? 600 : 220);
  });
  groove.totalBars = totalBars;

  groove.meta = {
    ...(groove.meta || {}),
    architecture: 'Full-song melody transcription',
    sourceBpm: analysis.sourceBpm || analysis.bpm,
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
