import { GrooveObject, MusicGenre, NoteEvent, SectionType, EnergyLevel } from '../types';
import { ELITE_16_CHANNELS } from './maestroService';
import { theoryEngine } from './theoryEngine';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface PitchFrame {
  t: number;
  m: number;
  v: number;
  voiced: boolean;
}

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
  snareHits: number[];
  bassNotes: NoteEvent[];
  kickMask: number[];
  detected: Partial<Record<string, number>>;
}

export interface ArrangeOptions {
  genre: MusicGenre | string;
  bpm?: number;
  key?: string;
  scale?: string;
  trackName?: string;
}

const NFFT = 2048;
const HOP = 256;
const TARGET_SR = 22050;
const LEAD_MIN = 55;
const LEAD_MAX = 88;
const GRID = 0.25;
const TOP_K = 6;

const ev = (midi: number, startTick: number, durationTicks: number, velocity: number, pitchBend = 0): NoteEvent => {
  const bar = Math.floor(startTick / 1920);
  const beat = Math.floor((startTick % 1920) / 480);
  const six = Math.floor((startTick % 480) / 120);
  return {
    note: theoryEngine.midiToNote(Math.round(midi)),
    time: `${bar}:${beat}:${six}`,
    duration: 'custom',
    durationTicks: Math.max(20, Math.round(durationTicks)),
    startTick: Math.max(0, Math.round(startTick)),
    velocity: Math.max(0.2, Math.min(1, velocity)),
    pitchBend: Math.round(Math.max(-8191, Math.min(8191, pitchBend))),
  };
};

export function hzToMidi(hz: number) {
  return 69 + 12 * Math.log2(hz / 440);
}

export function midiToHz(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function downsample(input: Float32Array, from: number, to: number) {
  if (Math.abs(from - to) < 1) return input.slice();
  const ratio = from / to;
  const out = new Float32Array(Math.max(1, Math.floor(input.length / ratio)));
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const f = x - i0;
    out[i] = (input[i0] || 0) * (1 - f) + (input[i0 + 1] || 0) * f;
  }
  return out;
}

function biquadProcess(x: Float32Array, b0: number, b1: number, b2: number, a1: number, a2: number) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const yn = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = yn;
    y[i] = yn;
  }
  return y;
}

function rbjHighpass(x: Float32Array, sr: number, freq: number, q = 0.707) {
  const w0 = 2 * Math.PI * freq / sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  const a0 = 1 + alpha;
  const b0 = ((1 + cos) / 2) / a0;
  const b1 = (-(1 + cos)) / a0;
  const b2 = ((1 + cos) / 2) / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  return biquadProcess(x, b0, b1, b2, a1, a2);
}

function rbjLowpass(x: Float32Array, sr: number, freq: number, q = 0.707) {
  const w0 = 2 * Math.PI * freq / sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  const a0 = 1 + alpha;
  const b0 = ((1 - cos) / 2) / a0;
  const b1 = (1 - cos) / a0;
  const b2 = ((1 - cos) / 2) / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  return biquadProcess(x, b0, b1, b2, a1, a2);
}

function preEmphasis(x: Float32Array, coeff = 0.94) {
  const y = new Float32Array(x.length);
  y[0] = x[0];
  for (let i = 1; i < x.length; i++) y[i] = x[i] - coeff * x[i - 1];
  return y;
}

const BITREV = (() => {
  const n = NFFT;
  const bits = Math.log2(n);
  const t = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    let j = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) j |= 1 << (bits - 1 - b);
    t[i] = j;
  }
  return t;
})();

const HANN = (() => {
  const w = new Float32Array(NFFT);
  for (let i = 0; i < NFFT; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (NFFT - 1));
  return w;
})();

function fftRadix2(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 0; i < n; i++) {
    const j = BITREV[i];
    if (j > i) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = (-Math.PI * 2) / size;
    for (let i = 0; i < n; i += size) {
      for (let k = 0; k < half; k++) {
        const ang = step * k;
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
}

function magAt(mag: Float32Array, nfft: number, sr: number, hz: number) {
  const bin = (hz * nfft) / sr;
  const i0 = Math.floor(bin);
  if (i0 < 1 || i0 + 1 >= mag.length) return 0;
  const f = bin - i0;
  return mag[i0] * (1 - f) + mag[i0 + 1] * f;
}

function whiten(mag: Float32Array) {
  const n = mag.length;
  const out = new Float32Array(n);
  const win = 18;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += mag[i];
    if (i >= win) acc -= mag[i - win];
    const mean = acc / Math.min(win, i + 1);
    out[i] = mag[i] / (mean + 1e-8);
  }
  return out;
}

const HARM_W = [1, 0.84, 0.7, 0.55, 0.4, 0.28];

function salienceAt(spec: Float32Array, nfft: number, sr: number, midi: number) {
  const f = midiToHz(midi);
  if (f < 20 || f > sr / 2 - 40) return 0;
  let s = 0;
  for (let h = 1; h <= HARM_W.length; h++) {
    const m = magAt(spec, nfft, sr, f * h);
    if (m <= 0) continue;
    s += HARM_W[h - 1] * m;
  }
  const half = magAt(spec, nfft, sr, f * 0.5);
  const fund = magAt(spec, nfft, sr, f);
  if (half > fund * 0.85 && midi - 12 >= LEAD_MIN) s *= 0.42;
  return s;
}

function topCandidates(spec: Float32Array, nfft: number, sr: number, minM: number, maxM: number, k: number) {
  const scored: { m: number; s: number }[] = [];
  for (let midi = minM; midi <= maxM; midi += GRID) {
    scored.push({ m: midi, s: salienceAt(spec, nfft, sr, midi) });
  }
  const peaks: { m: number; s: number }[] = [];
  for (let i = 1; i < scored.length - 1; i++) {
    if (scored[i].s >= scored[i - 1].s && scored[i].s >= scored[i + 1].s) {
      const s0 = scored[i - 1].s;
      const s1 = scored[i].s;
      const s2 = scored[i + 1].s;
      const den = s0 - 2 * s1 + s2;
      const delta = den !== 0 ? (0.5 * (s0 - s2)) / den : 0;
      peaks.push({ m: scored[i].m + GRID * Math.max(-1, Math.min(1, delta)), s: s1 });
    }
  }
  peaks.sort((a, b) => b.s - a.s);
  const picked: { m: number; s: number }[] = [];
  for (const p of peaks) {
    if (picked.some((q) => Math.abs(q.m - p.m) < 0.7 || Math.abs(Math.abs(q.m - p.m) - 12) < 0.7)) continue;
    picked.push(p);
    if (picked.length >= k) break;
  }
  return picked;
}

function peakinessOf(cands: { m: number; s: number }[]) {
  if (!cands[0]) return 0;
  const rival = cands.find((c) => Math.abs(c.m - cands[0].m) > 2.4 && Math.abs(Math.abs(c.m - cands[0].m) - 12) > 1.6);
  if (!rival) return 3;
  return cands[0].s / (rival.s + 1e-9);
}

function viterbiTrack(cands: { m: number; s: number }[][], rms: number[], flux: number[]) {
  const T = cands.length;
  const K = TOP_K + 1;
  const emit: number[][] = Array.from({ length: T }, () => new Array(K).fill(-1e9));
  const midiOf: number[][] = Array.from({ length: T }, () => new Array(K).fill(-1));

  const scores = rms.map((_, t) => (cands[t][0]?.s || 0));
  const sorted = scores.slice().sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length * 0.62)] || 1e-8;
  const rmsSorted = rms.slice().sort((a, b) => a - b);
  const noise = rmsSorted[Math.floor(rmsSorted.length * 0.25)] || 1e-5;

  for (let t = 0; t < T; t++) {
    emit[t][0] = 0.22;
    midiOf[t][0] = -1;
    const peaky = peakinessOf(cands[t]);
    const clear = peaky >= 1.32 && (cands[t][0]?.s || 0) > med * 0.3 && rms[t] > noise * 1.7;
    for (let k = 0; k < TOP_K; k++) {
      const c = cands[t][k];
      if (!c) continue;
      emit[t][k + 1] = Math.log(c.s + 1e-8) * (clear ? 1 : 0.08);
      midiOf[t][k + 1] = c.m;
    }
  }

  const dp = Array.from({ length: T }, () => new Array(K).fill(-1e12));
  const bt = Array.from({ length: T }, () => new Array(K).fill(0));
  for (let k = 0; k < K; k++) dp[0][k] = emit[0][k];

  const transCost = (a: number, b: number) => {
    if (a < 0 && b < 0) return 0.05;
    if (a < 0 || b < 0) return 1.85;
    const d = Math.abs(a - b);
    if (d < 0.55) return 0;
    if (d < 1.3) return 0.08 * d;
    if (d < 3.2) return 0.75 * d;
    if (d < 6) return 1.5 * d;
    const oct = Math.abs(d - 12);
    if (oct < 1.1) return 2.6;
    return 4.2 + 0.35 * d;
  };

  for (let t = 1; t < T; t++) {
    for (let j = 0; j < K; j++) {
      let best = -1e12;
      let arg = 0;
      for (let i = 0; i < K; i++) {
        const sc = dp[t - 1][i] + emit[t][j] - transCost(midiOf[t - 1][i], midiOf[t][j]);
        if (sc > best) { best = sc; arg = i; }
      }
      dp[t][j] = best;
      bt[t][j] = arg;
    }
  }

  let end = 0;
  for (let k = 1; k < K; k++) if (dp[T - 1][k] > dp[T - 1][end]) end = k;
  const path = new Array(T).fill(-1);
  let k = end;
  for (let t = T - 1; t >= 0; t--) {
    path[t] = midiOf[t][k];
    k = bt[t][k];
  }

  let last = -1;
  const medianWin: number[] = [];
  for (let t = 0; t < T; t++) {
    if (path[t] < 0) { last = -1; continue; }
    if (last >= 0) {
      const down = path[t] - 12;
      const up = path[t] + 12;
      if (down >= LEAD_MIN && Math.abs(down - last) + 1.2 < Math.abs(path[t] - last)) path[t] = down;
      else if (up <= LEAD_MAX && Math.abs(up - last) + 1.2 < Math.abs(path[t] - last)) path[t] = up;
    }
    if (medianWin.length >= 12) {
      const mid = medianWin.slice().sort((a, b) => a - b)[Math.floor(medianWin.length / 2)];
      if (Math.abs(path[t] - mid) > 9) {
        const d = path[t] - 12;
        const u = path[t] + 12;
        if (Math.abs(d - mid) < Math.abs(path[t] - mid) && d >= LEAD_MIN) path[t] = d;
        else if (Math.abs(u - mid) < Math.abs(path[t] - mid) && u <= LEAD_MAX) path[t] = u;
      }
    }
    last = path[t];
    medianWin.push(path[t]);
    if (medianWin.length > 24) medianWin.shift();
  }
  const smoothed = path.slice();
  for (let t = 2; t < T - 2; t++) {
    if (path[t] < 0) continue;
    const win = [path[t - 2], path[t - 1], path[t], path[t + 1], path[t + 2]].filter((x) => x >= 0);
    if (win.length >= 3) smoothed[t] = median(win);
  }
  return smoothed;
}

export function yinHz(frame: Float32Array, sr: number, minF: number, maxF: number): number | null {
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
    if (cmnd[tau] < 0.12) {
      while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEst = tau;
      best = cmnd[tau];
      break;
    }
    if (cmnd[tau] < best) { best = cmnd[tau]; tauEst = tau; }
  }
  if (tauEst < 0 || best > 0.35) return null;
  const s0 = cmnd[Math.max(minTau, tauEst - 1)];
  const s1 = cmnd[tauEst];
  const s2 = cmnd[Math.min(maxTau, tauEst + 1)];
  const denom = 2 * s1 - s2 - s0;
  const adj = denom !== 0 ? (s0 - s2) / (2 * denom) : 0;
  const hz = sr / (tauEst + adj);
  if (!Number.isFinite(hz) || hz < minF || hz > maxF) return null;
  return hz;
}

function peakTimes(values: number[], hop: number, sr: number, threshRatio: number, minGap = 0.07) {
  const mean = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  const thresh = mean * threshRatio;
  const times: number[] = [];
  for (let i = 2; i < values.length - 2; i++) {
    if (values[i] > thresh && values[i] >= values[i - 1] && values[i] >= values[i + 1]) {
      if (!times.length || (i * hop) / sr - times[times.length - 1] > minGap) {
        times.push((i * hop) / sr);
      }
    }
  }
  return times;
}

function estimateBpm(flux: number[], hop: number, sr: number) {
  const hopSec = hop / sr;
  const scores: { bpm: number; s: number }[] = [];
  for (let bpm = 70; bpm <= 190; bpm++) {
    const lag = 60 / bpm / hopSec;
    if (lag < 2) continue;
    let s = 0;
    const iLag = Math.round(lag);
    for (let i = 0; i + iLag < flux.length; i++) s += flux[i] * flux[i + iLag];
    scores.push({ bpm, s });
  }
  scores.sort((a, b) => b.s - a.s);
  let bpm = scores[0]?.bpm || 145;
  if (bpm < 95) bpm *= 2;
  if (bpm > 185) bpm = Math.round(bpm / 2);
  return Math.max(80, Math.min(190, Math.round(bpm)));
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

export function secToTick(sec: number, bpm: number) {
  return Math.round((sec * bpm * 480) / 60);
}

function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function framesToNotes(frames: PitchFrame[], bpm: number): NoteEvent[] {
  const voiced = frames.filter((f) => f.voiced && Number.isFinite(f.m));
  if (!voiced.length) return [];
  const notes: NoteEvent[] = [];
  let group = [voiced[0]];
  const hop = frames.length > 1 ? Math.max(0.008, frames[1].t - frames[0].t) : 0.012;

  const flush = () => {
    if (!group.length) return;
    const hold = group[group.length - 1].t - group[0].t + hop;
    if (hold < 0.085 || group.length < 3) { group = []; return; }
    const inner = group.slice(Math.floor(group.length * 0.2), Math.max(1, Math.ceil(group.length * 0.8)));
    const pitch = median((inner.length ? inner : group).map((g) => g.m));
    const vel = Math.min(1, group.reduce((a, g) => a + g.v, 0) / group.length);
    const bend = (pitch - Math.round(pitch)) * 4096;
    notes.push(ev(pitch, secToTick(group[0].t, bpm), (hold * bpm * 480) / 60, vel, bend));
    group = [];
  };

  for (let i = 1; i < voiced.length; i++) {
    const cur = voiced[i];
    const last = group[group.length - 1];
    const same = Math.abs(cur.m - last.m) < 1.15;
    const close = cur.t - last.t < hop * 2.8;
    if (same && close) group.push(cur);
    else {
      flush();
      group = [cur];
    }
  }
  flush();
  return stabilizeMelody(notes, bpm);
}

export function stabilizeMelody(notes: NoteEvent[], bpm: number): NoteEvent[] {
  if (!notes.length) return [];
  const minTicks = Math.round((0.09 * bpm * 480) / 60);
  const sorted = notes.slice().sort((a, b) => (a.startTick || 0) - (b.startTick || 0));
  const merged: NoteEvent[] = [];
  for (const raw of sorted) {
    const n = { ...raw };
    const last = merged[merged.length - 1];
    if (!last) { merged.push(n); continue; }
    const a = theoryEngine.getMidiNote(Array.isArray(last.note) ? last.note[0] : last.note);
    const b = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
    const lastEnd = (last.startTick || 0) + (last.durationTicks || 0);
    const gap = (n.startTick || 0) - lastEnd;
    if (Math.abs(a - b) <= 1 && gap < 70) {
      last.durationTicks = Math.max(last.durationTicks || 0, (n.startTick || 0) + (n.durationTicks || 0) - (last.startTick || 0));
      continue;
    }
    merged.push(n);
  }
  const kept = merged.filter((n) => (n.durationTicks || 0) >= minTicks);
  const span = Math.max(1, ((kept[kept.length - 1]?.startTick || 0) + (kept[kept.length - 1]?.durationTicks || 0)) / ((bpm * 480) / 60));
  const maxNotes = Math.max(10, span * 2.4);
  if (kept.length <= maxNotes) return kept;
  return kept
    .slice()
    .sort((a, b) => (b.durationTicks || 0) - (a.durationTicks || 0))
    .slice(0, Math.floor(maxNotes))
    .sort((a, b) => (a.startTick || 0) - (b.startTick || 0));
}

export function trackMelodyFromSpectrum(
  cands: { m: number; s: number }[][],
  rms: number[],
  flux: number[],
  hopSec: number,
): PitchFrame[] {
  const path = viterbiTrack(cands, rms, flux);
  return path.map((m, i) => ({
    t: i * hopSec,
    m,
    v: Math.min(1, 0.3 + (rms[i] || 0) * 8),
    voiced: m >= 0,
  }));
}

export function trackBassYin(samples: Float32Array, sr: number, hop: number, frame: number): PitchFrame[] {
  const out: PitchFrame[] = [];
  let prev: number | null = null;
  for (let i = 0; i + frame < samples.length; i += hop) {
    const win = samples.subarray(i, i + frame);
    let e = 0;
    for (let j = 0; j < win.length; j++) e += win[j] * win[j];
    const rms = Math.sqrt(e / win.length);
    if (rms < 0.006) { prev = null; out.push({ t: i / sr, m: -1, v: 0, voiced: false }); continue; }
    const hz = yinHz(win, sr, 38, 200);
    if (!hz) { prev = null; out.push({ t: i / sr, m: -1, v: 0, voiced: false }); continue; }
    let midi = hzToMidi(hz);
    if (prev != null) {
      const down = midi - 12;
      const up = midi + 12;
      if (down >= 22 && Math.abs(down - prev) + 1 < Math.abs(midi - prev)) midi = down;
      else if (up <= 52 && Math.abs(up - prev) + 1 < Math.abs(midi - prev)) midi = up;
    }
    if (midi < 22 || midi > 52) { prev = null; continue; }
    prev = midi;
    out.push({ t: i / sr, m: midi, v: Math.min(1, 0.4 + rms * 6), voiced: true });
  }
  return out;
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

function simpleFlux(samples: Float32Array, hop: number) {
  const flux: number[] = [];
  let prev = 0;
  for (let i = 0; i + hop < samples.length; i += hop) {
    let e = 0;
    for (let j = 0; j < hop; j++) e += samples[i + j] * samples[i + j];
    const rms = Math.sqrt(e / hop);
    flux.push(Math.max(0, rms - prev * 0.75));
    prev = rms;
  }
  return flux;
}

async function yieldUi() {
  await new Promise((r) => setTimeout(r, 0));
}

export async function analyzeBufferToStems(
  raw: Float32Array,
  sampleRate: number,
  onProgress?: (p: number) => void,
  override?: { bpm?: number; key?: string; scale?: string }
): Promise<AudioStemAnalysis> {
  onProgress?.(12);
  const take = Math.min(raw.length, Math.floor(sampleRate * 240));
  const slice = raw.subarray(0, take);
  const sr = TARGET_SR;
  const mono = downsample(slice, sampleRate, sr);
  const durationSec = slice.length / sampleRate;

  const leadSrc = rbjLowpass(rbjHighpass(preEmphasis(mono, 0.93), sr, 260), sr, 3800);
  const low = rbjLowpass(rbjHighpass(mono, sr, 28), sr, 190);
  const high = rbjHighpass(mono, sr, 6200);
  const midBand = rbjLowpass(rbjHighpass(mono, sr, 180), sr, 900);

  onProgress?.(22);
  const hop = HOP;
  const nfft = NFFT;
  const re = new Float32Array(nfft);
  const im = new Float32Array(nfft);
  const cands: { m: number; s: number }[][] = [];
  const harmCands: { m: number; s: number }[][] = [];
  const rmsArr: number[] = [];
  const fluxArr: number[] = [];
  const lowEnergy: number[] = [];
  let prevSpec: Float32Array | null = null;
  const avgSpec = new Float32Array(nfft / 2);
  let avgReady = false;
  const hopSec = hop / sr;
  const totalFrames = Math.max(1, Math.floor((leadSrc.length - nfft) / hop));

  for (let i = 0, fi = 0; i + nfft < leadSrc.length; i += hop, fi++) {
    re.fill(0); im.fill(0);
    let e = 0;
    for (let j = 0; j < nfft; j++) {
      const s = leadSrc[i + j] * HANN[j];
      re[j] = s;
      e += leadSrc[i + j] * leadSrc[i + j];
    }
    fftRadix2(re, im);
    const mag = new Float32Array(nfft / 2);
    for (let b = 0; b < mag.length; b++) mag[b] = Math.hypot(re[b], im[b]);
    if (!avgReady) {
      avgSpec.set(mag);
      avgReady = true;
    } else {
      const a = fi < 70 ? 0.05 : 0.007;
      for (let b = 0; b < mag.length; b++) avgSpec[b] = avgSpec[b] * (1 - a) + mag[b] * a;
    }
    const mixed = new Float32Array(mag.length);
    for (let b = 0; b < mag.length; b++) {
      const fg = Math.max(0, mag[b] - avgSpec[b] * 0.9);
      mixed[b] = fg + 0.28 * mag[b];
    }
    const spec = whiten(mixed);
    const top = topCandidates(spec, nfft, sr, LEAD_MIN, LEAD_MAX, TOP_K);
    cands.push(top);
    harmCands.push(topCandidates(spec, nfft, sr, 50, 86, 4));
    rmsArr.push(Math.sqrt(e / nfft));
    let fl = 0;
    if (prevSpec) {
      for (let b = 8; b < 180; b++) fl += Math.max(0, mag[b] - prevSpec[b]);
    }
    fluxArr.push(fl / 172);
    prevSpec = mag;

    let le = 0;
    const iLow = Math.floor(i * (low.length / leadSrc.length));
    for (let j = 0; j < hop && iLow + j < low.length; j++) le += low[iLow + j] * low[iLow + j];
    lowEnergy.push(Math.sqrt(le / hop));

    if (fi % 280 === 0) {
      onProgress?.(22 + Math.round((fi / totalFrames) * 40));
      await yieldUi();
    }
  }

  onProgress?.(64);
  const fluxForBpm = fluxArr.length ? fluxArr : simpleFlux(mono, hop);
  const detectedBpm = estimateBpm(fluxForBpm, hop, sr);
  const targetBpm = override?.bpm && override.bpm >= 80 ? override.bpm : detectedBpm;

  const melodyFrames = trackMelodyFromSpectrum(cands, rmsArr, fluxArr, hopSec);
  const lead = framesToNotes(melodyFrames, detectedBpm);

  const secondFrames: PitchFrame[] = harmCands.map((cs, i) => {
    const leadM = melodyFrames[i]?.m ?? -1;
    const alt = cs.find((c) => leadM < 0 || (Math.abs(c.m - leadM) > 2.8 && Math.abs(Math.abs(c.m - leadM) - 12) > 1.8));
    const peaky = peakinessOf(cs);
    return {
      t: i * hopSec,
      m: alt?.m ?? -1,
      v: Math.min(0.45, 0.2 + (rmsArr[i] || 0) * 3),
      voiced: !!alt && peaky >= 1.2 && (alt.s > (cs[0]?.s || 1) * 0.45),
    };
  });
  const harmony = framesToNotes(secondFrames, detectedBpm).filter((n) => (n.durationTicks || 0) >= 480);

  onProgress?.(74);
  const bassSr = 4000;
  const bassMono = downsample(low, sr, bassSr);
  const bassFrames = trackBassYin(bassMono, bassSr, 160, 1024);
  const bassNotes = framesToNotes(bassFrames, detectedBpm).map((n) => {
    let m = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
    while (m > 50) m -= 12;
    while (m < 22) m += 12;
    return ev(m, n.startTick || 0, Math.min(480, n.durationTicks || 120), 0.88);
  });

  const kickHits = peakTimes(lowEnergy, hop, sr, 1.55, 0.12);
  const highFlux = simpleFlux(high, 256);
  const hatHits = peakTimes(highFlux, 256, sr, 1.45, 0.14);
  const midFlux = simpleFlux(midBand, 256);
  const snareHits = peakTimes(midFlux, 256, sr, 1.7, 0.18);
  const kickMask = buildKickMask(kickHits, detectedBpm);

  const hist = new Array(12).fill(0);
  melodyFrames.forEach((p) => {
    if (!p.voiced) return;
    hist[((Math.round(p.m) % 12) + 12) % 12] += p.v;
  });
  const guessed = chromaKey(hist);
  const key = override?.key || guessed.key;
  const scale = override?.scale || guessed.scale;

  onProgress?.(86);
  return {
    bpm: targetBpm,
    sourceBpm: detectedBpm,
    key,
    scale,
    durationSec,
    lead,
    harmony,
    kickHits,
    hatHits,
    snareHits,
    bassNotes,
    kickMask,
    detected: {
      ch1_kick: kickHits.length,
      ch2_sub: bassNotes.length,
      ch4_leadA: lead.length,
      ch5_leadB: harmony.length,
      ch8_snare: snareHits.length,
      ch12_hhClosed: hatHits.length,
    },
  };
}

export async function analyzeSongToStems(
  file: File,
  onProgress?: (p: number) => void,
  override?: { bpm?: number; key?: string; scale?: string }
): Promise<AudioStemAnalysis> {
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new Ctx();
  onProgress?.(6);
  const raw = await file.arrayBuffer();
  onProgress?.(10);
  const decoded = await ctx.decodeAudioData(raw.slice(0));
  const src = decoded.numberOfChannels > 1
    ? (() => {
        const a = decoded.getChannelData(0);
        const b = decoded.getChannelData(1);
        const m = new Float32Array(a.length);
        for (let i = 0; i < a.length; i++) m[i] = (a[i] + b[i]) * 0.5;
        return m;
      })()
    : decoded.getChannelData(0).slice();
  const analysis = await analyzeBufferToStems(src, decoded.sampleRate, onProgress, override);
  analysis.durationSec = decoded.duration;
  await ctx.close();
  return analysis;
}

export function arrangeTranceFromAnalysis(analysis: AudioStemAnalysis, options: ArrangeOptions): GrooveObject {
  const bpm = options.bpm && options.bpm > 40 ? options.bpm : analysis.bpm;
  const key = options.key || analysis.key;
  const scale = options.scale || analysis.scale;
  const sourceBpm = Math.max(80, analysis.sourceBpm || analysis.bpm || bpm);
  const tickScale = bpm / sourceBpm;
  const lastTickSrc = Math.max(
    analysis.lead.reduce((m, n) => Math.max(m, (n.startTick || 0) + (n.durationTicks || 0)), 0),
    analysis.bassNotes.reduce((m, n) => Math.max(m, (n.startTick || 0) + (n.durationTicks || 0)), 0),
    Math.round((analysis.durationSec || 0) * sourceBpm * 480 / 60)
  );
  const totalBars = Math.min(160, Math.max(8, Math.ceil((lastTickSrc * tickScale) / 1920) + 1));

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
    Math.max(24, Math.round((n.durationTicks || 120) * tickScale)),
    Math.min(1, (n.velocity || 0.8) + extraVel),
    n.pitchBend || 0
  );

  const lastTick = totalBars * 1920;
  groove.ch4_leadA = analysis.lead.map((n) => place(n, 0.08)).filter((n) => (n.startTick || 0) < lastTick);
  groove.ch5_leadB = (analysis.harmony || [])
    .filter((n) => (n.durationTicks || 0) >= 480)
    .map((n) => place(n))
    .filter((n) => (n.startTick || 0) < lastTick);
  groove.ch2_sub = analysis.bassNotes
    .filter((n) => (n.durationTicks || 0) >= 80)
    .map((n) => place(n))
    .filter((n) => (n.startTick || 0) < lastTick);

  analysis.kickHits.forEach((sec) => {
    const tick = Math.round(sec * bpm * 480 / 60);
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

  (analysis.snareHits || []).forEach((sec) => {
    const tick = Math.round(sec * bpm * 480 / 60);
    if (tick < lastTick) groove.ch8_snare.push(ev(38, tick, 80, 0.78));
  });

  analysis.hatHits.forEach((sec) => {
    const tick = Math.round(sec * bpm * 480 / 60);
    if (tick < lastTick) groove.ch12_hhClosed.push(ev(42, tick, 36, 0.52));
  });

  const longPads = [...groove.ch5_leadB, ...groove.ch4_leadA.filter((n: NoteEvent) => (n.durationTicks || 0) >= 960)].slice(0, 40);
  groove.ch15_pad = longPads.map((n: NoteEvent) => {
    const m = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
    return ev(m > 70 ? m - 12 : m, n.startTick || 0, Math.max(720, n.durationTicks || 720), 0.24);
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
