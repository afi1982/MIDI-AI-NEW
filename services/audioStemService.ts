import { ChannelKey, GrooveObject, MusicGenre, NoteEvent, SectionType, EnergyLevel } from '../types';
import { ELITE_16_CHANNELS } from './maestroService';
import { theoryEngine } from './theoryEngine';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface AudioStemAnalysis {
  bpm: number;
  sourceBpm?: number;
  key: string;
  scale: string;
  durationSec: number;
  lead: NoteEvent[];
  harmony: NoteEvent[];
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
    durationTicks: Math.max(30, Math.round(durationTicks)),
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
  for (let bpm = 90; bpm <= 180; bpm++) {
    const lag = 60 / bpm / hopSec;
    if (lag < 2) continue;
    let s = 0;
    const iLag = Math.round(lag);
    for (let i = 0; i + iLag < flux.length; i++) s += flux[i] * flux[i + iLag];
    scores.push({ bpm, s });
  }
  scores.sort((a, b) => b.s - a.s);
  let bpm = scores[0]?.bpm || 145;
  if (bpm < 110) bpm *= 2;
  if (bpm > 170) bpm = Math.round(bpm / 2);
  return Math.max(90, Math.min(180, bpm));
}

function yinHz(frame: Float32Array, sr: number, minF: number, maxF: number): number | null {
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
  let tauEst = -1;
  let best = 1;
  for (let tau = minTau; tau <= maxTau; tau++) {
    if (cmnd[tau] < 0.14) {
      while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEst = tau;
      best = cmnd[tau];
      break;
    }
    if (cmnd[tau] < best) { best = cmnd[tau]; tauEst = tau; }
  }
  if (tauEst < 0 || best > 0.4) return null;
  const s0 = cmnd[Math.max(minTau, tauEst - 1)];
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

/** Harmonic product spectrum — finds the sung/played fundamental, not the bass. */
function hpsMidi(frame: Float32Array, sr: number, minMidi: number, maxMidi: number): { m: number; s: number } | null {
  const n = 512;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  const lim = Math.min(n, frame.length);
  for (let i = 0; i < lim; i++) re[i] = frame[i] * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (lim - 1)));
  const bits = Math.log2(n);
  for (let i = 0; i < n; i++) {
    let j = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) j |= 1 << (bits - 1 - b);
    if (j > i) { const t = re[i]; re[i] = re[j]; re[j] = t; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = (Math.PI * 2) / size;
    for (let i = 0; i < n; i += size) {
      for (let k = 0; k < half; k++) {
        const ang = -step * k;
        const wr = Math.cos(ang);
        const wi = Math.sin(ang);
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = wr * re[i + k + half] - wi * im[i + k + half];
        const vi = wr * im[i + k + half] + wi * re[i + k + half];
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + half] = ur - vr;
        im[i + k + half] = ui - vi;
      }
    }
  }
  const mag = new Float32Array(n / 2);
  for (let i = 0; i < mag.length; i++) mag[i] = Math.hypot(re[i], im[i]);

  let best = { m: 0, s: 0 };
  for (let midi = minMidi; midi <= maxMidi; midi += 0.5) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    let prod = 1;
    for (let h = 1; h <= 4; h++) {
      const bin = (f * h * n) / sr;
      const i0 = Math.floor(bin);
      if (i0 < 1 || i0 + 1 >= mag.length) { prod = 0; break; }
      const frac = bin - i0;
      prod *= mag[i0] * (1 - frac) + mag[i0 + 1] * frac;
    }
    if (prod > best.s) best = { m: midi, s: prod };
  }
  if (best.s <= 0) return null;
  return best;
}

function peakTimes(values: number[], hop: number, sr: number, threshRatio: number) {
  const mean = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  const thresh = mean * threshRatio;
  const times: number[] = [];
  for (let i = 2; i < values.length - 2; i++) {
    if (values[i] > thresh && values[i] >= values[i - 1] && values[i] >= values[i + 1]) {
      if (!times.length || (i * hop) / sr - times[times.length - 1] > 0.07) {
        times.push((i * hop) / sr);
      }
    }
  }
  return times;
}

function chromaKey(midiHist: number[]) {
  const templates: Record<string, number[]> = {
    Minor: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0],
    Major: [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
    Dorian: [1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0],
    Phrygian: [1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0],
  };
  let best = { key: 'C', scale: 'Minor', score: -1 };
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
  return Math.round((sec * bpm * 480) / 60 / 15) * 15;
}

function trackMelodyHps(samples: Float32Array, sr: number, hop: number, frame: number) {
  const out: { t: number; m: number; v: number }[] = [];
  let prev: number | null = null;
  for (let i = 0; i + frame < samples.length; i += hop) {
    const win = samples.subarray(i, i + frame);
    let e = 0;
    for (let j = 0; j < win.length; j++) e += win[j] * win[j];
    const rms = Math.sqrt(e / win.length);
    if (rms < 0.005) { prev = null; continue; }
    const hit = hpsMidi(win, sr, 55, 88);
    if (!hit) continue;
    let midi = hit.m;
    if (prev != null) {
      const down = midi - 12;
      const up = midi + 12;
      if (Math.abs(down - prev) + 1.5 < Math.abs(midi - prev)) midi = down;
      else if (Math.abs(up - prev) + 1.5 < Math.abs(midi - prev)) midi = up;
      if (Math.abs(midi - prev) > 8 && hit.s < 1e-6) continue;
    }
    prev = midi;
    out.push({ t: i / sr, m: midi, v: Math.min(1, 0.35 + rms * 7) });
  }
  if (out.length < 6) return out;
  return out.map((p, i) => {
    const a = out[Math.max(0, i - 2)].m;
    const b = p.m;
    const c = out[Math.min(out.length - 1, i + 2)].m;
    return { ...p, m: [a, b, c].sort((x, y) => x - y)[1] };
  });
}

function trackBassYin(samples: Float32Array, sr: number, hop: number, frame: number) {
  const out: { t: number; m: number; v: number }[] = [];
  let prev: number | null = null;
  for (let i = 0; i + frame < samples.length; i += hop) {
    const win = samples.subarray(i, i + frame);
    let e = 0;
    for (let j = 0; j < win.length; j++) e += win[j] * win[j];
    const rms = Math.sqrt(e / win.length);
    if (rms < 0.008) { prev = null; continue; }
    const hz = yinHz(win, sr, 40, 220);
    if (!hz) continue;
    let midi = hzToMidi(hz);
    if (prev != null) {
      const down = midi - 12;
      if (Math.abs(down - prev) + 1 < Math.abs(midi - prev)) midi = down;
    }
    if (midi < 24 || midi > 52) continue;
    prev = midi;
    out.push({ t: i / sr, m: midi, v: Math.min(1, 0.4 + rms * 6) });
  }
  return out;
}

function contourToNotes(frames: { t: number; m: number; v: number }[], bpm: number): NoteEvent[] {
  if (!frames.length) return [];
  const notes: NoteEvent[] = [];
  let start = frames[0];
  let last = frames[0];
  const flush = () => {
    const hold = last.t - start.t + hopGuess(frames);
    if (hold < 0.055) return;
    notes.push(ev(Math.round((start.m + last.m) * 0.5), secToTick(start.t, bpm), (hold * bpm * 480) / 60, last.v));
  };
  for (let i = 1; i < frames.length; i++) {
    const cur = frames[i];
    const same = Math.abs(cur.m - last.m) < 0.55;
    const close = cur.t - last.t < 0.11;
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

function hopGuess(frames: { t: number }[]) {
  if (frames.length < 2) return 0.04;
  return Math.max(0.03, Math.min(0.06, frames[1].t - frames[0].t));
}

function buildKickMask(hits: number[], bpm: number) {
  const stepSec = 60 / bpm / 4;
  const hist = new Array(16).fill(0);
  hits.forEach((t) => { hist[Math.round(t / stepSec) % 16] += 1; });
  const max = Math.max(1, ...hist);
  const mask = hist.map((h) => (h >= max * 0.28 ? 1 : 0));
  if (mask[0] + mask[4] + mask[8] + mask[12] < 2) return [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
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
  const take = Math.min(src.length, Math.floor(decoded.sampleRate * 180));
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
  const leadBand = applyBand(mono, sr, 280, 3200);
  const lowFlux = simpleFlux(low, hop);
  const highFlux = simpleFlux(high, hop);
  const kickHits = peakTimes(lowFlux, hop, sr, 1.65);
  const hatHits = peakTimes(highFlux, hop, sr, 1.3);
  const kickMask = buildKickMask(kickHits, detectedBpm);
  onProgress?.(55);

  const frame = 1024;
  const hopP = 320;
  const midis = trackMelodyHps(leadBand, sr, hopP, frame);
  const bassFrames = trackBassYin(low, sr, hopP, frame);
  const hist = new Array(12).fill(0);
  midis.forEach((p) => { hist[((Math.round(p.m) % 12) + 12) % 12] += p.v; });
  const guessed = chromaKey(hist);
  const key = override?.key || guessed.key;
  const scale = override?.scale || guessed.scale;
  onProgress?.(74);

  const lead = contourToNotes(midis, detectedBpm);
  const harmony = lead.filter((n) => (n.durationTicks || 0) >= 360).map((n) => {
    const m = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
    return ev(m + 7, n.startTick || 0, n.durationTicks || 360, 0.32);
  });
  const bassNotes = contourToNotes(bassFrames, detectedBpm).map((n) => {
    let m = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
    while (m > 43) m -= 12;
    while (m < 24) m += 12;
    return ev(m, n.startTick || 0, Math.min(320, n.durationTicks || 120), 0.86);
  });

  await ctx.close();
  onProgress?.(86);
  return {
    bpm: targetBpm,
    sourceBpm: detectedBpm,
    key,
    scale,
    durationSec: decoded.duration,
    lead,
    harmony,
    kickHits,
    hatHits,
    bassNotes,
    kickMask,
    detected: {
      ch1_kick: kickHits.length,
      ch2_sub: bassNotes.length,
      ch4_leadA: lead.length,
      ch5_leadB: harmony.length,
      ch12_hhClosed: hatHits.length,
    },
  };
}

export function arrangeTranceFromAnalysis(analysis: AudioStemAnalysis, options: ArrangeOptions): GrooveObject {
  const bpm = options.bpm && options.bpm > 40 ? options.bpm : analysis.bpm;
  const key = analysis.key;
  const scale = analysis.scale;
  const sourceBpm = Math.max(80, analysis.sourceBpm || analysis.bpm || bpm);
  const tickScale = bpm / sourceBpm;
  const lastTickSrc = Math.max(
    analysis.lead.reduce((m, n) => Math.max(m, (n.startTick || 0) + (n.durationTicks || 0)), 0),
    analysis.bassNotes.reduce((m, n) => Math.max(m, (n.startTick || 0) + (n.durationTicks || 0)), 0),
    Math.round((analysis.durationSec || 0) * sourceBpm * 480 / 60)
  );
  const totalBars = Math.min(128, Math.max(8, Math.ceil((lastTickSrc * tickScale) / 1920) + 1));

  const groove: any = {
    id: `A2M-${Date.now()}`,
    name: options.trackName || `From Audio · ${key} ${scale}`,
    bpm,
    key,
    scale,
    genre: options.genre,
    totalBars,
    structureMap: [{
      type: SectionType.DROP,
      startBar: 0,
      durationBars: totalBars,
      energy: EnergyLevel.PEAK,
      activeInstruments: [...ELITE_16_CHANNELS],
    }],
    meta: { architecture: '1:1 source transcription', sourceBpm, leadNotes: analysis.lead.length },
  };
  ELITE_16_CHANNELS.forEach((ch) => { groove[ch] = []; });

  const place = (n: NoteEvent, extraVel = 0) => ev(
    theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note),
    Math.round((n.startTick || 0) * tickScale),
    Math.max(40, Math.round((n.durationTicks || 120) * tickScale)),
    Math.min(1, (n.velocity || 0.8) + extraVel)
  );

  const lastTick = totalBars * 1920;
  groove.ch4_leadA = analysis.lead.map((n) => place(n, 0.12)).filter((n) => (n.startTick || 0) < lastTick);
  groove.ch5_leadB = (analysis.harmony || []).map((n) => place(n)).filter((n) => (n.startTick || 0) < lastTick);
  groove.ch2_sub = analysis.bassNotes.map((n) => place(n)).filter((n) => (n.startTick || 0) < lastTick);
  groove.ch3_midBass = groove.ch2_sub.map((n: NoteEvent) => {
    const m = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note) + 12;
    return ev(m, n.startTick || 0, Math.min(200, n.durationTicks || 120), 0.45);
  });

  analysis.kickHits.forEach((sec) => {
    const tick = Math.round(sec * bpm * 480 / 60 / 30) * 30;
    if (tick < lastTick) groove.ch1_kick.push(ev(36, tick, 140, 1));
  });
  if (!groove.ch1_kick.length) {
    const mask = analysis.kickMask?.length === 16 ? analysis.kickMask : [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    for (let bar = 0; bar < totalBars; bar++) {
      mask.forEach((on, step) => {
        if (on) groove.ch1_kick.push(ev(36, bar * 1920 + step * 120, 140, 1));
      });
    }
  }

  analysis.hatHits.forEach((sec) => {
    const tick = Math.round(sec * bpm * 480 / 60 / 60) * 60;
    if (tick < lastTick) groove.ch12_hhClosed.push(ev(42, tick, 40, 0.55));
  });

  const longPads = groove.ch4_leadA.filter((n: NoteEvent) => (n.durationTicks || 0) >= 480).slice(0, 80);
  groove.ch15_pad = longPads.map((n: NoteEvent) => {
    const m = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note) - 12;
    return ev(m, n.startTick || 0, n.durationTicks || 480, 0.28);
  });

  groove.analysisMeta = {
    detectedBpm: analysis.sourceBpm || analysis.bpm,
    usedBpm: bpm,
    detectedKey: `${analysis.key} ${analysis.scale}`,
    usedKey: `${key} ${scale}`,
    durationSec: analysis.durationSec,
    channels: analysis.detected,
    mode: '1:1 transcription',
  };
  return groove as GrooveObject;
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
