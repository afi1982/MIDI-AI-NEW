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
    note: theoryEngine.midiToNote(midi),
    time: `${bar}:${beat}:${six}`,
    duration: 'custom',
    durationTicks: Math.max(30, durationTicks),
    startTick: Math.max(0, startTick),
    velocity: Math.max(0.2, Math.min(1, velocity)),
  };
};

function downsample(input: Float32Array, from: number, to: number) {
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) out[i] = input[Math.floor(i * ratio)] || 0;
  return out;
}

function bandEnergy(samples: Float32Array, sr: number, lowHz: number, highHz: number, hop = 1024) {
  const out: number[] = [];
  const rcLow = 1 / (2 * Math.PI * highHz);
  const rcHigh = 1 / (2 * Math.PI * lowHz);
  const dt = 1 / sr;
  const aLow = dt / (rcLow + dt);
  const aHigh = rcHigh / (rcHigh + dt);
  let lp = 0;
  let hp = 0;
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    lp += aLow * (samples[i] - lp);
    hp = aHigh * (hp + samples[i] - prev);
    prev = samples[i];
    if (i % hop === hop - 1) {
      let e = 0;
      const start = Math.max(0, i - hop);
      for (let j = start; j <= i; j++) {
        const x = j === i ? hp : 0;
        e += x * x;
      }
      out.push(Math.sqrt(e / hop));
    }
  }
  return { flux: out, hop };
}

function simpleFlux(samples: Float32Array, hop: number) {
  const flux: number[] = [];
  let prev = 0;
  for (let i = 0; i + hop < samples.length; i += hop) {
    let e = 0;
    for (let j = 0; j < hop; j++) e += samples[i + j] * samples[i + j];
    const rms = Math.sqrt(e / hop);
    flux.push(Math.max(0, rms - prev));
    prev = rms * 0.85;
  }
  return flux;
}

function estimateBpm(flux: number[], hop: number, sr: number) {
  const hopSec = hop / sr;
  let bestLag = 0;
  let best = 0;
  const minLag = Math.max(2, Math.round((60 / 180) / hopSec));
  const maxLag = Math.max(minLag + 2, Math.round((60 / 90) / hopSec));
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < flux.length; i++) s += flux[i] * flux[i + lag];
    if (s > best) {
      best = s;
      bestLag = lag;
    }
  }
  let bpm = bestLag ? 60 / (bestLag * hopSec) : 145;
  if (bpm < 110) bpm *= 2;
  if (bpm > 175) bpm /= 2;
  return Math.max(90, Math.min(175, Math.round(bpm)));
}

function yinHz(frame: Float32Array, sr: number, minF = 90, maxF = 1400): number | null {
  const minTau = Math.max(2, Math.floor(sr / maxF));
  const maxTau = Math.min(Math.floor(sr / minF), Math.floor(frame.length / 2) - 1);
  if (maxTau <= minTau) return null;
  let bestTau = -1;
  let best = Infinity;
  for (let tau = minTau; tau < maxTau; tau++) {
    let sum = 0;
    const n = frame.length - tau;
    for (let i = 0; i < n; i += 2) {
      const d = frame[i] - frame[i + tau];
      sum += d * d;
    }
    if (sum < best) {
      best = sum;
      bestTau = tau;
    }
  }
  if (bestTau < 0 || best > 8) return null;
  return sr / bestTau;
}

function hzToMidi(hz: number) {
  return Math.round(69 + 12 * Math.log2(hz / 440));
}

function peakTimes(flux: number[], hop: number, sr: number, threshRatio = 1.8) {
  const mean = flux.reduce((a, b) => a + b, 0) / Math.max(1, flux.length);
  const thresh = mean * threshRatio;
  const times: number[] = [];
  for (let i = 2; i < flux.length - 2; i++) {
    if (flux[i] > thresh && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1]) {
      times.push((i * hop) / sr);
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
  onProgress?.(28);
  const src = decoded.getChannelData(0);
  const take = Math.min(src.length, Math.floor(decoded.sampleRate * 80));
  const slice = src.subarray(0, take);
  const sr = 11025;
  const mono = downsample(slice, decoded.sampleRate, sr);
  const hop = 512;
  const flux = simpleFlux(mono, hop);
  const bpm = override?.bpm && override.bpm > 40 ? override.bpm : estimateBpm(flux, hop, sr);
  onProgress?.(42);

  const low: number[] = [];
  const high: number[] = [];
  let lp = 0;
  let hp = 0;
  let prev = 0;
  const aL = 1 - Math.exp(-2 * Math.PI * 140 / sr);
  const aH = Math.exp(-2 * Math.PI * 4000 / sr);
  for (let i = 0; i < mono.length; i++) {
    lp += aL * (mono[i] - lp);
    hp = aH * (hp + mono[i] - prev);
    prev = mono[i];
    if (i % hop === hop - 1) {
      low.push(Math.abs(lp));
      high.push(Math.abs(hp));
    }
  }
  const kickHits = peakTimes(low, hop, sr, 2.1);
  const hatHits = peakTimes(high, hop, sr, 1.6);
  onProgress?.(55);

  const frame = 1024;
  const hopP = 768;
  const midis: { t: number; m: number; v: number }[] = [];
  const hist = new Array(12).fill(0);
  for (let i = 0; i + frame < mono.length; i += hopP) {
    const win = mono.subarray(i, i + frame);
    let e = 0;
    for (let j = 0; j < win.length; j++) e += win[j] * win[j];
    const rms = Math.sqrt(e / win.length);
    if (rms < 0.012) continue;
    const hz = yinHz(win, sr);
    if (!hz) continue;
    const midi = hzToMidi(hz);
    if (midi < 40 || midi > 88) continue;
    hist[midi % 12] += rms;
    midis.push({ t: i / sr, m: midi, v: Math.min(1, rms * 8) });
  }
  const guessed = chromaKey(hist);
  const key = override?.key || guessed.key;
  const scale = override?.scale || guessed.scale;
  onProgress?.(70);

  const lead: NoteEvent[] = [];
  if (midis.length) {
    let start = midis[0];
    let last = midis[0];
    const flush = () => {
      const snapped = theoryEngine.snapMidiToScale(last.m, key, scale);
      const startTick = Math.round((start.t * bpm * 480) / 60 / 60) * 60;
      const durSec = Math.max(0.08, last.t - start.t + 0.08);
      const durationTicks = Math.max(60, Math.round((durSec * bpm * 480) / 60));
      lead.push(ev(Math.min(88, Math.max(55, snapped + (snapped < 55 ? 12 : 0))), startTick, durationTicks, last.v));
    };
    for (let i = 1; i < midis.length; i++) {
      const cur = midis[i];
      if (Math.abs(cur.m - last.m) <= 1 && cur.t - last.t < 0.28) {
        last = cur;
      } else {
        flush();
        start = cur;
        last = cur;
      }
    }
    flush();
  }

  const bassNotes: NoteEvent[] = lead.slice(0, 64).map((n) => {
    let m = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
    while (m > 48) m -= 12;
    while (m < 28) m += 12;
    return ev(m, n.startTick || 0, Math.min(240, n.durationTicks || 120), 0.8);
  });

  const detected: Partial<Record<ChannelKey, number>> = {
    ch1_kick: kickHits.length,
    ch2_sub: bassNotes.length,
    ch3_midBass: bassNotes.length,
    ch4_leadA: lead.length,
    ch8_snare: Math.round(kickHits.length * 0.4),
    ch12_hhClosed: hatHits.length,
    ch13_hhOpen: Math.round(hatHits.length * 0.25),
    ch15_pad: lead.length ? 1 : 0,
  };

  await ctx.close();
  onProgress?.(82);
  return {
    bpm,
    key,
    scale,
    durationSec: decoded.duration,
    lead,
    kickHits,
    hatHits,
    bassNotes,
    detected,
  };
}

function contourDegrees(lead: NoteEvent[], key: string, scaleName: string) {
  const intervals = theoryEngine.getScaleIntervals(scaleName);
  const rootPc = theoryEngine.getMidiNote(`${key}1`) % 12;
  const degs: number[] = [];
  lead.forEach((n) => {
    const m = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
    const pc = m % 12;
    let best = 0;
    let dist = 12;
    intervals.forEach((iv, i) => {
      const d = Math.min((pc - ((rootPc + iv) % 12) + 12) % 12, ((rootPc + iv) % 12 - pc + 12) % 12);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    degs.push(best);
  });
  if (!degs.length) return [0, 2, 3, 5, 3, 2, 0, 4];
  return degs.slice(0, 32);
}

function developLead(degrees: number[], bars: number, key: string, scaleName: string, startBar: number, busy: boolean) {
  const out: NoteEvent[] = [];
  const intervals = theoryEngine.getScaleIntervals(scaleName);
  const root = theoryEngine.getMidiNote(`${key}4`);
  for (let b = 0; b < bars; b++) {
    const chapter = b % 4;
    const cells = busy
      ? (chapter === 2 ? [0, 2, 4, 6, 8, 10, 12, 14] : chapter === 3 ? [0, 3, 6, 8, 11, 12] : [0, 3, 6, 8, 12])
      : (chapter === 0 ? [0, 8] : chapter === 2 ? [0, 4, 8] : [0, 8]);
    cells.forEach((step, i) => {
      const deg = degrees[(b * 3 + i + chapter) % degrees.length];
      const lift = chapter === 2 && i > 2 ? 12 : 0;
      const midi = root + intervals[deg % intervals.length] + lift;
      out.push(ev(midi, (startBar + b) * 1920 + step * 120, busy ? 180 : 420, 0.72 + i * 0.03));
    });
  }
  return out;
}

export function arrangeTranceFromAnalysis(analysis: AudioStemAnalysis, options: ArrangeOptions): GrooveObject {
  const bpm = options.bpm && options.bpm > 40 ? options.bpm : analysis.bpm;
  const key = options.key || analysis.key;
  const scale = options.scale || analysis.scale;
  const minutes = Math.max(2, Math.min(6, analysis.durationSec / 60 || 3));
  const groove = composeProfessionalTrack(
    { bpm, key, scale, genre: options.genre, trackName: options.trackName || `From Audio · ${key} ${scale}` },
    minutes,
    [...ELITE_16_CHANNELS]
  );

  const degrees = contourDegrees(analysis.lead, key, scale);
  const ratio = bpm / Math.max(60, analysis.bpm);
  const stretchedLead = analysis.lead.map((n) => {
    const start = Math.round(((n.startTick || 0) * ratio) / 60) * 60;
    let midi = theoryEngine.snapMidiToScale(theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note), key, scale);
    while (midi < 55) midi += 12;
    while (midi > 88) midi -= 12;
    return ev(midi, start, Math.max(80, Math.round((n.durationTicks || 160) * ratio)), n.velocity || 0.8);
  });

  const drops = (groove.structureMap || []).filter((s) => s.type === 'DROP' || s.type === 'MELODY_INTRO' || s.type === 'BREAKDOWN');
  const developed: NoteEvent[] = [...stretchedLead];
  drops.forEach((section) => {
    const busy = section.type === 'DROP';
    developed.push(...developLead(degrees, section.durationBars, key, scale, section.startBar, busy));
  });
  groove.ch4_leadA = developed.sort((a, b) => (a.startTick || 0) - (b.startTick || 0));

  const harmony = groove.ch4_leadA.map((n) => {
    let m = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note) + 4;
    m = theoryEngine.snapMidiToScale(m, key, scale);
    return ev(m, (n.startTick || 0) + 60, Math.max(80, (n.durationTicks || 160) - 20), 0.62);
  });
  groove.ch5_leadB = harmony.filter((_, i) => i % 2 === 0);

  const acid = degrees.map((d, i) => {
    const intervals = theoryEngine.getScaleIntervals(scale);
    const midi = theoryEngine.getMidiNote(`${key}2`) + intervals[d % intervals.length];
    return ev(midi, (i % 16) * 120 + Math.floor(i / 16) * 1920, 55, 0.7);
  });
  const acidLoop: NoteEvent[] = [];
  const totalBars = groove.totalBars || 64;
  for (let bar = 0; bar < totalBars; bar++) {
    if (bar % 16 < 4) continue;
    acid.forEach((n) => {
      const local = (n.startTick || 0) % 1920;
      acidLoop.push(ev(theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note), bar * 1920 + local, 50, 0.68));
    });
  }
  if (acidLoop.length) groove.ch14_acid = acidLoop;

  groove.meta = {
    ...(groove.meta || {}),
    architecture: 'Audio stems → trance arrangement',
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
