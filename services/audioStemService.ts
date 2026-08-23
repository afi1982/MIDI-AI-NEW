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

export interface ChordSegment {
  startSec: number;
  endSec: number;
  root: number;      // pitch class 0-11
  isMinor: boolean;
  tones: number[];   // absolute midi notes of the voicing
  strength: number;
}

export interface AudioStemAnalysis {
  bpm: number;
  leadFrames?: PitchFrame[];
  hopSec?: number;
  sourceBpm?: number;
  key: string;
  scale: string;
  durationSec: number;
  lead: NoteEvent[];
  harmony: NoteEvent[];
  kickHits: number[];
  hatHits: number[];
  openHatHits: number[];
  snareHits: number[];
  clapHits: number[];
  percHits: number[];
  bassNotes: NoteEvent[];
  chords: ChordSegment[];
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
const LEAD_MIN = 46;
const LEAD_MAX = 92;
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
const ODD_SUPPORT_MIN = 0.75;

/**
 * Peak magnitude within +-`cents` of a target frequency.
 * A singer's vibrato moves the partial by up to ~70 cents, so probing a single
 * FFT bin loses the harmonic entirely - which is what pushed the tracker onto
 * the octave-below ghost.
 */
function magAround(mag: Float32Array, nfft: number, sr: number, hz: number, cents = 55) {
  const lo = hz * Math.pow(2, -cents / 1200);
  const hi = hz * Math.pow(2, cents / 1200);
  const b0 = Math.max(1, Math.floor((lo * nfft) / sr));
  const b1 = Math.min(mag.length - 2, Math.ceil((hi * nfft) / sr));
  let best = 0;
  for (let b = b0; b <= b1; b++) if (mag[b] > best) best = mag[b];
  // never worse than the interpolated point value
  return Math.max(best, magAt(mag, nfft, sr, hz));
}

function salienceAt(spec: Float32Array, nfft: number, sr: number, midi: number) {
  const f = midiToHz(midi);
  if (f < 20 || f > sr / 2 - 40) return 0;

  let s = 0;
  let odd = 0;   // f, 3f, 5f
  let even = 0;  // 2f, 4f, 6f
  for (let h = 1; h <= HARM_W.length; h++) {
    const m = magAround(spec, nfft, sr, f * h);
    if (m <= 0) continue;
    s += HARM_W[h - 1] * m;
    if (h % 2 === 1) odd += m; else even += m;
  }

  /* Octave-below ghost rejection.
   * A candidate an octave under the real note collects all of the real
   * partials on its EVEN harmonics while its odd harmonics (f, 3f, 5f) have
   * nothing to sit on. A genuine tone always keeps strong odd support.
   *
   * NOTE: the previous rule did the opposite - it penalised a candidate
   * whenever energy existed an octave BELOW it, so any bass note or drone
   * under the melody dragged the transcription down an octave.
   */
  if (even > 0 && odd < even * ODD_SUPPORT_MIN) s *= 0.33;

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

function viterbiTrack(cands: { m: number; s: number }[][], rms: number[], flux: number[]) {
  const T = cands.length;
  const K = TOP_K + 1;
  const emit: number[][] = Array.from({ length: T }, () => new Array(K).fill(-1e9));
  const midiOf: number[][] = Array.from({ length: T }, () => new Array(K).fill(-1));

  const scores = rms.map((_, t) => (cands[t][0]?.s || 0));
  const sorted = scores.slice().sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length * 0.55)] || 1e-8;
  const rmsSorted = rms.slice().sort((a, b) => a - b);
  const noise = rmsSorted[Math.floor(rmsSorted.length * 0.2)] || 1e-5;

  for (let t = 0; t < T; t++) {
    emit[t][0] = 0.08;
    midiOf[t][0] = -1;
    for (let k = 0; k < TOP_K; k++) {
      const c = cands[t][k];
      if (!c) continue;
      const voicedGate = c.s > med * 0.2 && rms[t] > noise * 1.6 ? 1 : 0.15;
      const move = 1 + Math.min(1.4, (flux[t] || 0) * 8);
      emit[t][k + 1] = Math.log(c.s + 1e-8) * voicedGate * move;
      midiOf[t][k + 1] = c.m;
    }
  }

  const dp = Array.from({ length: T }, () => new Array(K).fill(-1e12));
  const bt = Array.from({ length: T }, () => new Array(K).fill(0));
  for (let k = 0; k < K; k++) dp[0][k] = emit[0][k];

  const transCost = (a: number, b: number) => {
    if (a < 0 && b < 0) return 0.15;
    if (a < 0 || b < 0) return 1.35;
    const d = Math.abs(a - b);
    if (d < 0.35) return 0;
    if (d < 2.1) return 0.18 * d;
    if (d < 5.5) return 0.55 * d;
    const oct = Math.abs(d - 12);
    if (oct < 1.1) return 2.1;
    return 3.2 + 0.28 * d;
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

  /* Octave continuity pass.
   * Shifting a frame by an octave just because the previous frame was closer
   * that way invents octave errors: one sustained drone at the start used to
   * drag an entire melody down an octave. An octave jump is only applied when
   * the spectrum ACTUALLY supports the alternative for that frame.
   */
  const supportFor = (t: number, midi: number) => {
    const list = cands[t] || [];
    const best = list[0]?.s || 0;
    if (best <= 0) return 0;
    const hit = list.find((c) => Math.abs(c.m - midi) < 0.7);
    return hit ? hit.s / best : 0;
  };

  let last = -1;
  const medianWin: number[] = [];
  for (let t = 0; t < T; t++) {
    if (path[t] < 0) { last = -1; continue; }
    if (last >= 0) {
      const down = path[t] - 12;
      const up = path[t] + 12;
      const closerDown = down >= LEAD_MIN && Math.abs(down - last) + 1.2 < Math.abs(path[t] - last);
      const closerUp = up <= LEAD_MAX && Math.abs(up - last) + 1.2 < Math.abs(path[t] - last);
      if (closerDown && supportFor(t, down) > 0.55) path[t] = down;
      else if (closerUp && supportFor(t, up) > 0.55) path[t] = up;
    }
    if (medianWin.length >= 12) {
      const mid = medianWin.slice().sort((a, b) => a - b)[Math.floor(medianWin.length / 2)];
      if (Math.abs(path[t] - mid) > 9) {
        const d = path[t] - 12;
        const u = path[t] + 12;
        if (Math.abs(d - mid) < Math.abs(path[t] - mid) && d >= LEAD_MIN && supportFor(t, d) > 0.5) path[t] = d;
        else if (Math.abs(u - mid) < Math.abs(path[t] - mid) && u <= LEAD_MAX && supportFor(t, u) > 0.5) path[t] = u;
      }
    }
    last = path[t];
    medianWin.push(path[t]);
    if (medianWin.length > 24) medianWin.shift();
  }
  return path;
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

/**
 * Onset picking against a LOCAL median instead of the global mean, so a busy
 * section does not swallow hits (and a quiet intro does not invent them).
 */
function sharpPeaks(env: number[], hop: number, sr: number, ratio: number, minGap: number) {
  const times: number[] = [];
  const win = Math.max(8, Math.round((0.75 * sr) / hop));
  for (let i = 2; i < env.length - 2; i++) {
    const lo = Math.max(0, i - win), hi = Math.min(env.length, i + win);
    const local = env.slice(lo, hi).filter((v) => v > 0).sort((a, b) => a - b);
    const med = local.length ? local[Math.floor(local.length / 2)] : 0;
    const prev = env[Math.max(0, i - Math.round((0.04 * sr) / hop))] || 1e-9;
    const isPeak = env[i] >= env[i - 1] && env[i] >= env[i + 1];
    if (isPeak && env[i] > med * ratio && env[i] > prev * 1.2) {
      const t = (i * hop) / sr;
      if (!times.length || t - times[times.length - 1] > minGap) times.push(t);
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

/**
 * @param gridDiv subdivisions per beat used for note voting:
 *   4 = 1/16 (default, DAW friendly), 8 = 1/32 (tight, closest to the source),
 *   16 = 1/64 (near raw timing).
 */
export function framesToNotes(frames: PitchFrame[], bpm: number, gridDiv = 4): NoteEvent[] {
  const voiced = frames.filter((f) => f.voiced && Number.isFinite(f.m));
  if (!voiced.length) return [];

  const hop = frames.length > 1 ? Math.max(0.008, frames[1].t - frames[0].t) : 0.012;
  const div = Math.max(1, gridDiv);
  const sixteenthSec = 60 / bpm / div;
  const framesPerSlot = Math.max(1, sixteenthSec / hop);

  /* Per-slot pitch voting.
   * Segmenting the raw contour note-by-note is hopeless on real material:
   * vibrato makes the tracker oscillate between neighbouring semitones and the
   * melody shatters into an A4/G#4/A4 stutter. Instead every 1/16 slot votes
   * once (median of its frames) and equal neighbours merge into one note - the
   * result is stable AND already aligned to a musical grid for the DAW.
   */
  const slots = new Map<number, { pitches: number[]; vels: number[] }>();
  for (const f of voiced) {
    const slot = Math.round(f.t / sixteenthSec);
    let bucket = slots.get(slot);
    if (!bucket) { bucket = { pitches: [], vels: [] }; slots.set(slot, bucket); }
    bucket.pitches.push(f.m);
    bucket.vels.push(f.v);
  }

  type Slot = { slot: number; midi: number; vel: number; bend: number };
  const voted: Slot[] = [];
  const slotKeys = [...slots.keys()].sort((a, b) => a - b);
  for (const key of slotKeys) {
    const bucket = slots.get(key)!;
    // a slot needs real coverage, otherwise it is a transient artefact
    if (bucket.pitches.length < Math.max(2, framesPerSlot * 0.35)) continue;
    const pitch = median(bucket.pitches);
    const vel = bucket.vels.reduce((a, b) => a + b, 0) / bucket.vels.length;
    voted.push({ slot: key, midi: pitch, vel, bend: (pitch - Math.round(pitch)) * 4096 });
  }
  if (!voted.length) return [];

  // Remove single-slot spikes that sit between two slots of the same pitch
  for (let i = 1; i < voted.length - 1; i++) {
    const prev = voted[i - 1], cur = voted[i], next = voted[i + 1];
    if (prev.slot + 1 === cur.slot && cur.slot + 1 === next.slot &&
        Math.round(prev.midi) === Math.round(next.midi) &&
        Math.round(cur.midi) !== Math.round(prev.midi)) {
      cur.midi = prev.midi;
    }
  }

  // Merge consecutive slots carrying the same semitone
  type Built = { midi: number; slot: number; lenSlots: number; vel: number; bend: number };
  const built: Built[] = [];
  for (const v of voted) {
    const prev = built[built.length - 1];
    if (prev && Math.round(prev.midi) === Math.round(v.midi) && prev.slot + prev.lenSlots === v.slot) {
      prev.lenSlots += 1;
      prev.vel = Math.max(prev.vel, v.vel);
      continue;
    }
    built.push({ midi: v.midi, slot: v.slot, lenSlots: 1, vel: v.vel, bend: v.bend });
  }

  // Monophonic: never let a note run into the next one
  for (let i = 0; i < built.length - 1; i++) {
    const maxLen = built[i + 1].slot - built[i].slot;
    if (maxLen > 0) built[i].lenSlots = Math.min(built[i].lenSlots, maxLen);
  }

  const ticksPerSlot = Math.round(480 / div); // slot length at 480 PPQ
  return built
    .filter((b) => b.lenSlots >= 1)
    .map((b) => ev(b.midi, b.slot * ticksPerSlot, b.lenSlots * ticksPerSlot, b.vel, b.bend));
}

/**
 * Median filter over the pitch contour (~100ms). Vibrato swings +-0.6 semitone
 * at 5-7Hz; without smoothing the note segmenter shatters every sustained note
 * into an A4/G#4/A4 stutter.
 */
function smoothContour(path: number[], win: number): number[] {
  const out = path.slice();
  const half = Math.max(1, Math.floor(win / 2));
  for (let i = 0; i < path.length; i++) {
    if (path[i] < 0) continue;
    const window: number[] = [];
    for (let j = Math.max(0, i - half); j <= Math.min(path.length - 1, i + half); j++) {
      if (path[j] >= 0) window.push(path[j]);
    }
    if (window.length < 3) continue;
    window.sort((a, b) => a - b);
    out[i] = window[Math.floor(window.length / 2)];
  }
  return out;
}

export function trackMelodyFromSpectrum(
  cands: { m: number; s: number }[][],
  rms: number[],
  flux: number[],
  hopSec: number,
): PitchFrame[] {
  const raw = viterbiTrack(cands, rms, flux);
  const win = Math.max(3, Math.round(0.1 / Math.max(0.004, hopSec)));
  const path = smoothContour(raw, win);
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


/* ---------------------------------------------------------------------------
 * MULTI-CHANNEL SEPARATION HELPERS
 * The first engine only produced kick / snare / hat / bass / lead. These add
 * real timbre classification (clap vs snare, open vs closed hat, percussion)
 * and harmonic chord extraction so a normal song lands on many channels.
 * ------------------------------------------------------------------------ */

function bandpass(x: Float32Array, sr: number, lo: number, hi: number) {
  return rbjLowpass(rbjHighpass(x, sr, lo), sr, hi);
}

/** RMS envelope, one value per hop. */
function rmsEnvelope(samples: Float32Array, hop: number) {
  const env: number[] = [];
  for (let i = 0; i + hop < samples.length; i += hop) {
    let e = 0;
    for (let j = 0; j < hop; j++) e += samples[i + j] * samples[i + j];
    env.push(Math.sqrt(e / hop));
  }
  return env;
}

const envAt = (env: number[], sec: number, hop: number, sr: number) => {
  const i = Math.round((sec * sr) / hop);
  return env[Math.max(0, Math.min(env.length - 1, i))] || 0;
};

/**
 * Energy ADDED by the transient in this band (peak minus the level 45ms before).
 * Absolute band levels are useless in a dense mix - a sustaining bass line keeps
 * the shell band lit permanently, which made every clap look like a snare.
 */
const envDelta = (env: number[], sec: number, hop: number, sr: number) => {
  const i = Math.round((sec * sr) / hop);
  if (i < 1 || i >= env.length) return 0;
  const back = Math.max(0, i - Math.round((0.045 * sr) / hop));
  const peak = Math.max(env[i] || 0, env[i + 1] || 0, env[i + 2] || 0);
  return Math.max(0, peak - (env[back] || 0));
};

/** Peak-relative decay length in seconds (how long the band stays above 40%). */
function decayLength(env: number[], sec: number, hop: number, sr: number) {
  const start = Math.max(0, Math.round((sec * sr) / hop));
  const peak = Math.max(env[start] || 0, env[start + 1] || 0);
  if (peak <= 0) return 0;
  let i = start;
  const limit = Math.min(env.length - 1, start + 40);
  while (i < limit && env[i] > peak * 0.4) i++;
  return ((i - start) * hop) / sr;
}

export interface DrumClassification {
  kick: number[];
  snare: number[];
  clap: number[];
  hatClosed: number[];
  hatOpen: number[];
  perc: number[];
}

/**
 * Classifies raw transients into drum families using band ratios + decay time.
 *  - hats: high band dominates. Closed = short decay, open = long ringing decay.
 *  - clap: broadband 1.5-4k noise burst with almost no 150-400Hz body.
 *  - snare: noise burst WITH low-mid body.
 *  - perc: everything else with 400-1600Hz energy (toms, congas, rides, fx).
 */
/**
 * True percussion has a sharp rise and a fast decay. Sustained synth/vocal
 * onsets do not - without this gate every lead note was counted as a snare.
 */
function isPercussive(env: number[], sec: number, hop: number, sr: number, riseRatio = 1.9, maxDecay = 0.4) {
  const i = Math.round((sec * sr) / hop);
  if (i < 2 || i >= env.length) return false;
  const back = Math.max(0, i - Math.round((0.05 * sr) / hop));
  const before = Math.max(1e-9, env[back]);
  const peak = Math.max(env[i], env[i + 1] || 0);
  if (peak / before < riseRatio) return false;
  return decayLength(env, sec, hop, sr) <= maxDecay;
}

function classifyTransients(
  candidates: number[],
  envs: { body: number[]; noise: number[]; perc: number[]; high: number[]; low: number[] },
  hop: number,
  sr: number,
  kickHits: number[],
  flatness?: { noise: number[]; high: number[]; hopSec: number }
): DrumClassification {
  const flatAt = (arr: number[] | undefined, sec: number) => {
    if (!arr || !arr.length || !flatness) return 1;
    const i = Math.round(sec / flatness.hopSec);
    return arr[Math.max(0, Math.min(arr.length - 1, i))] ?? 1;
  };
  const out: DrumClassification = { kick: kickHits, snare: [], clap: [], hatClosed: [], hatOpen: [], perc: [] };
  const isNearKick = (t: number) => kickHits.some((k) => Math.abs(k - t) < 0.035);

  const norm = (env: number[]) => {
    const sorted = [...env].filter((v) => v > 0).sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor(sorted.length * 0.9)] || 1 : 1;
  };
  const nBody = norm(envs.body), nNoise = norm(envs.noise), nPerc = norm(envs.perc), nHigh = norm(envs.high);

  for (const t of candidates) {
    const body = envDelta(envs.body, t, hop, sr) / nBody;
    const noise = envDelta(envs.noise, t, hop, sr) / nNoise;
    const perc = envDelta(envs.perc, t, hop, sr) / nPerc;
    const high = envDelta(envs.high, t, hop, sr) / nHigh;

    // Skip transients that are just the kick bleeding into other bands
    if (isNearKick(t) && high < 0.55 && noise < 0.5) continue;

    // Hats: high band dominates and the burst is genuinely percussive
    const noiseFlat = flatAt(flatness?.noise, t);
    const highFlat = flatAt(flatness?.high, t);

    if (high > 0.18 && high >= noise * 0.8 && high >= body * 0.8 && highFlat > 0.12 && isPercussive(envs.high, t, hop, sr, 1.7, 0.5)) {
      const decay = decayLength(envs.high, t, hop, sr);
      (decay > 0.11 ? out.hatOpen : out.hatClosed).push(t);
      continue;
    }

    // Snare/clap vs tuned percussion: compare the noise+shell signature against
    // the tonal 420-1600Hz body of toms/congas.
    const snareScore = noise * 1.15 + body * 0.7;
    const percScore = perc * 1.1;
    // A broadband noise burst is mandatory - tonal chord/bass attacks also rise
    // sharply in the shell band, and used to be mislabelled as snares.
    const noisePercussive = isPercussive(envs.noise, t, hop, sr, 1.7, 0.35);

    if (snareScore >= percScore * 0.85 && noise > 0.15 && noiseFlat > 0.12 && noisePercussive) {
      // clap = noise burst without shell body, snare = noise burst with body
      if (body < noise * 0.55) out.clap.push(t);
      else out.snare.push(t);
      continue;
    }

    if (perc > 0.15 && isPercussive(envs.perc, t, hop, sr, 1.9, 0.4)) { out.perc.push(t); continue; }

    // Tuned percussion (toms, congas) - strong low-mid body, no noise burst,
    // but still decays fast (a sustaining bass note does not).
    if (body > 0.2 && noise < body * 0.6 && isPercussive(envs.body, t, hop, sr, 2.0, 0.3)) { out.perc.push(t); continue; }
  }

  // Collapse double-triggers inside each family (one hit per 60ms)
  const tighten = (xs: number[]) => {
    const sorted = [...xs].sort((a, b) => a - b);
    const kept: number[] = [];
    for (const t of sorted) if (!kept.length || t - kept[kept.length - 1] > 0.06) kept.push(t);
    return kept;
  };
  out.snare = tighten(out.snare);
  out.clap = tighten(out.clap);
  out.hatClosed = tighten(out.hatClosed);
  out.hatOpen = tighten(out.hatOpen);
  out.perc = tighten(out.perc);
  return out;
}

/**
 * Spectral flatness inside a band: ~1.0 for noise (drums), near 0 for a tonal
 * harmonic stack (synth/vocal). This is what separates a snare hit from the
 * attack transient of a chord.
 */
function bandFlatness(mag: Float32Array, nfft: number, sr: number, lo: number, hi: number) {
  const binHz = sr / nfft;
  const b0 = Math.max(1, Math.floor(lo / binHz));
  const b1 = Math.min(mag.length - 1, Math.ceil(hi / binHz));
  if (b1 <= b0) return 0;
  let logSum = 0, sum = 0;
  for (let b = b0; b <= b1; b++) {
    const v = mag[b] + 1e-9;
    logSum += Math.log(v);
    sum += v;
  }
  const count = b1 - b0 + 1;
  const geo = Math.exp(logSum / count);
  const arith = sum / count;
  return arith > 0 ? geo / arith : 0;
}

const CHORD_MIN = 130;
const CHORD_MAX = 2200;

/** Per-frame 12-bin chroma restricted to the harmonic region of the mix. */
function chromaFromSpectrum(mag: Float32Array, nfft: number, sr: number) {
  const chroma = new Float32Array(12);
  const binHz = sr / nfft;
  const startBin = Math.max(1, Math.floor(CHORD_MIN / binHz));
  const endBin = Math.min(mag.length - 1, Math.ceil(CHORD_MAX / binHz));
  for (let b = startBin; b <= endBin; b++) {
    const hz = b * binHz;
    const midi = hzToMidi(hz);
    if (!Number.isFinite(midi)) continue;
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    chroma[pc] += mag[b];
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += chroma[i];
  if (sum > 0) for (let i = 0; i < 12; i++) chroma[i] /= sum;
  return chroma;
}

/**
 * Segments the song into 2-beat windows, matches each against major/minor
 * triad templates and merges repeats into sustained chord events.
 */
function detectChords(chromaFrames: Float32Array[], hopSec: number, bpm: number): ChordSegment[] {
  if (!chromaFrames.length) return [];
  const beatSec = 60 / bpm;
  const winSec = beatSec * 2;
  const framesPerWin = Math.max(4, Math.round(winSec / hopSec));
  const raw: { start: number; end: number; root: number; isMinor: boolean; strength: number }[] = [];

  for (let i = 0; i + framesPerWin <= chromaFrames.length; i += framesPerWin) {
    const acc = new Float32Array(12);
    for (let f = i; f < i + framesPerWin; f++) {
      const fr = chromaFrames[f];
      for (let c = 0; c < 12; c++) acc[c] += fr[c];
    }
    let total = 0;
    for (let c = 0; c < 12; c++) total += acc[c];
    if (total <= 0) continue;
    for (let c = 0; c < 12; c++) acc[c] /= total;

    let best = { root: -1, isMinor: true, score: -Infinity };
    for (let root = 0; root < 12; root++) {
      for (const isMinor of [true, false]) {
        const third = (root + (isMinor ? 3 : 4)) % 12;
        const fifth = (root + 7) % 12;
        const inChord = acc[root] * 1.25 + acc[third] + acc[fifth];
        let outChord = 0;
        for (let c = 0; c < 12; c++) if (c !== root && c !== third && c !== fifth) outChord += acc[c];
        const score = inChord - outChord * 0.35;
        if (score > best.score) best = { root, isMinor, score };
      }
    }
    if (best.root < 0 || best.score < 0.18) continue;
    raw.push({ start: i * hopSec, end: (i + framesPerWin) * hopSec, root: best.root, isMinor: best.isMinor, strength: best.score });
  }

  // Merge consecutive identical chords
  const merged: ChordSegment[] = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && last.root === seg.root && last.isMinor === seg.isMinor && Math.abs(last.endSec - seg.start) < 0.05) {
      last.endSec = seg.end;
      last.strength = Math.max(last.strength, seg.strength);
      continue;
    }
    const rootMidi = 48 + seg.root;
    const tones = [rootMidi, rootMidi + (seg.isMinor ? 3 : 4), rootMidi + 7];
    merged.push({ startSec: seg.start, endSec: seg.end, root: seg.root, isMinor: seg.isMinor, tones, strength: seg.strength });
  }
  return merged;
}

/**
 * Pulls dense runs of short notes out of a melodic line - those are arpeggios,
 * not a lead melody, and belong on their own channel.
 */
function splitArpFromLead(notes: NoteEvent[]): { lead: NoteEvent[]; arp: NoteEvent[] } {
  if (notes.length < 8) return { lead: notes, arp: [] };
  const sorted = [...notes].sort((a, b) => (a.startTick || 0) - (b.startTick || 0));
  const arp: NoteEvent[] = [];
  const lead: NoteEvent[] = [];
  let run: NoteEvent[] = [];

  const flush = () => {
    if (run.length >= 6) arp.push(...run); else lead.push(...run);
    run = [];
  };

  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i];
    const prev = run[run.length - 1];
    const short = (n.durationTicks || 0) <= 200;
    const tight = !prev || ((n.startTick || 0) - (prev.startTick || 0)) <= 260;
    if (short && tight) run.push(n);
    else { flush(); if (short) run.push(n); else lead.push(n); }
  }
  flush();
  return { lead, arp };
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

  const leadSrc = rbjLowpass(rbjHighpass(preEmphasis(mono, 0.93), sr, 180), sr, 4200);
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
  const chromaFrames: Float32Array[] = [];
  const noiseFlatness: number[] = [];
  const highFlatness: number[] = [];
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
    chromaFrames.push(chromaFromSpectrum(mag, nfft, sr));
    noiseFlatness.push(bandFlatness(mag, nfft, sr, 1500, 4200));
    highFlatness.push(bandFlatness(mag, nfft, sr, 6000, 10000));
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
    const alt = cs.find((c) => leadM < 0 || (Math.abs(c.m - leadM) > 2.2 && Math.abs(Math.abs(c.m - leadM) - 12) > 1.5));
    return {
      t: i * hopSec,
      m: alt?.m ?? -1,
      v: Math.min(0.55, 0.22 + (rmsArr[i] || 0) * 4),
      voiced: !!alt && (alt.s > (cs[0]?.s || 1) * 0.35),
    };
  });
  const harmony = framesToNotes(secondFrames, detectedBpm).filter((n) => (n.durationTicks || 0) >= 240);

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

  const kickEnv = rmsEnvelope(low, hop);
  let kickHits = sharpPeaks(kickEnv, hop, sr, 1.35, 0.1);
  if (kickHits.length < 4) kickHits = peakTimes(lowEnergy, hop, sr, 1.55, 0.12);

  // --- Multi-channel drum separation -------------------------------------
  const DHOP = 256;
  const bodyBand = bandpass(mono, sr, 150, 420);     // snare shell / tom body
  const noiseBand = bandpass(mono, sr, 1500, 4200);  // clap & snare noise burst
  const percBand = bandpass(mono, sr, 420, 1600);    // toms, congas, fx perc
  const envs = {
    body: rmsEnvelope(bodyBand, DHOP),
    noise: rmsEnvelope(noiseBand, DHOP),
    perc: rmsEnvelope(percBand, DHOP),
    high: rmsEnvelope(high, DHOP),
    low: rmsEnvelope(low, DHOP),
  };

  const highFlux = simpleFlux(high, DHOP);
  const midFlux = simpleFlux(midBand, DHOP);
  const percFlux = simpleFlux(percBand, DHOP);
  const candidateHits = Array.from(new Set([
    ...peakTimes(highFlux, DHOP, sr, 1.25, 0.045),
    ...peakTimes(midFlux, DHOP, sr, 1.5, 0.06),
    ...peakTimes(percFlux, DHOP, sr, 1.6, 0.07),
  ].map((t) => Math.round(t * 1000) / 1000))).sort((a, b) => a - b);

  const drums = classifyTransients(candidateHits, envs, DHOP, sr, kickHits, {
    noise: noiseFlatness,
    high: highFlatness,
    hopSec,
  });
  const hatHits = drums.hatClosed;
  const openHatHits = drums.hatOpen;
  const snareHits = drums.snare;
  const clapHits = drums.clap;
  const percHits = drums.perc;
  const kickMask = buildKickMask(kickHits, detectedBpm);

  // --- Harmony / chord extraction ----------------------------------------
  const chords = detectChords(chromaFrames, hopSec, detectedBpm);

  const hist = new Array(12).fill(0);
  melodyFrames.forEach((p) => {
    if (!p.voiced) return;
    hist[((Math.round(p.m) % 12) + 12) % 12] += p.v;
  });
  // Chords carry far more key information than a melody contour does
  const melodyWeight = hist.reduce((a, b) => a + b, 0) || 1;
  chords.forEach((c) => {
    const dur = Math.max(0.1, c.endSec - c.startSec);
    c.tones.forEach((m, i) => {
      hist[((m % 12) + 12) % 12] += (melodyWeight * 0.03) * dur * (i === 0 ? 1.4 : 1);
    });
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
    leadFrames: melodyFrames,
    hopSec,
    harmony,
    kickHits,
    hatHits,
    openHatHits,
    snareHits,
    clapHits,
    percHits,
    bassNotes,
    chords,
    kickMask,
    detected: {
      ch1_kick: kickHits.length,
      ch2_sub: bassNotes.length,
      ch4_leadA: lead.length,
      ch5_leadB: harmony.length,
      ch8_snare: snareHits.length,
      ch9_clap: clapHits.length,
      ch10_percLoop: percHits.length,
      ch12_hhClosed: hatHits.length,
      ch13_hhOpen: openHatHits.length,
      ch16_synth: chords.length,
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

  // Lead: pull dense 16th runs out to the arp channel so the lead stays a melody
  const leadPlaced = analysis.lead.map((n) => place(n, 0.08)).filter((n) => (n.startTick || 0) < lastTick);
  const { lead: leadOnly, arp: arpNotes } = splitArpFromLead(leadPlaced);
  groove.ch4_leadA = leadOnly;
  groove.ch6_arpA = arpNotes.map((n) => ev(
    theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note),
    n.startTick || 0,
    Math.min(160, n.durationTicks || 120),
    Math.min(1, (n.velocity || 0.7))
  ));
  groove.ch5_leadB = (analysis.harmony || []).map((n) => place(n)).filter((n) => (n.startTick || 0) < lastTick);
  groove.ch2_sub = analysis.bassNotes.map((n) => place(n)).filter((n) => (n.startTick || 0) < lastTick);
  groove.ch3_midBass = groove.ch2_sub
    .filter((n: NoteEvent) => theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note) >= 36)
    .map((n: NoteEvent) => {
      const m = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
      return ev(m + (m < 40 ? 12 : 0), n.startTick || 0, Math.min(240, n.durationTicks || 120), 0.42);
    });

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

  const placeHits = (hits: number[] | undefined, channel: string, midi: number, dur: number, vel: number) => {
    (hits || []).forEach((sec) => {
      const tick = Math.round(sec * bpm * 480 / 60);
      if (tick < lastTick) groove[channel].push(ev(midi, tick, dur, vel));
    });
  };

  placeHits(analysis.snareHits, 'ch8_snare', 38, 80, 0.78);
  placeHits(analysis.clapHits, 'ch9_clap', 39, 90, 0.72);
  placeHits(analysis.percHits, 'ch10_percLoop', 45, 70, 0.6);
  placeHits(analysis.hatHits, 'ch12_hhClosed', 42, 36, 0.52);
  placeHits(analysis.openHatHits, 'ch13_hhOpen', 46, 180, 0.55);

  // --- Chords & pads come from real harmonic analysis, not copies of the lead
  const chords = analysis.chords || [];
  chords.forEach((c) => {
    const startTick = Math.round(c.startSec * bpm * 480 / 60);
    const durTicks = Math.max(240, Math.round((c.endSec - c.startSec) * bpm * 480 / 60));
    if (startTick >= lastTick) return;
    c.tones.forEach((m, i) => {
      // Chord stab on the synth channel (all tones share the same tick = real chord)
      groove.ch16_synth.push(ev(m + 12, startTick, Math.min(durTicks, 480), 0.5 - i * 0.04));
      // Sustained pad voicing an octave lower
      groove.ch15_pad.push(ev(m, startTick, durTicks, 0.3 - i * 0.03));
    });
  });

  // Fallback: if no chord was confidently detected keep the old long-note pad
  if (!groove.ch15_pad.length) {
    const longPads = [...groove.ch5_leadB, ...groove.ch4_leadA.filter((n: NoteEvent) => (n.durationTicks || 0) >= 720)].slice(0, 100);
    groove.ch15_pad = longPads.map((n: NoteEvent) => {
      const m = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
      return ev(m > 70 ? m - 12 : m, n.startTick || 0, Math.max(480, n.durationTicks || 480), 0.26);
    });
  }

  /* --- Key-aware pitch repair -------------------------------------------
   * Semitone slips (vibrato pulling a note onto its neighbour) are the most
   * audible transcription error. If the transcription already agrees with the
   * detected key, the few outliers are almost certainly mistakes - snap them.
   * If it does NOT agree, the key estimate is the unreliable part: leave the
   * notes untouched rather than "correcting" a correct melody.
   */
  const MELODIC_FIXABLE = ['ch4_leadA', 'ch5_leadB', 'ch6_arpA'];
  const scaleNotes = new Set(
    theoryEngine.getScaleNotes(key, scale).map((nn) => theoryEngine.getMidiNote(`${nn}4`) % 12)
  );
  if (scaleNotes.size >= 5) {
    MELODIC_FIXABLE.forEach((ch) => {
      const list = (groove[ch] || []) as NoteEvent[];
      if (list.length < 8) return;
      const midis = list.map((nn) => theoryEngine.getMidiNote(Array.isArray(nn.note) ? nn.note[0] : nn.note));
      const inScale = midis.filter((m) => scaleNotes.has(((m % 12) + 12) % 12)).length;
      if (inScale / midis.length < 0.62) return; // key estimate not trustworthy

      groove[ch] = list.map((nn, i) => {
        const m = midis[i];
        if (scaleNotes.has(((m % 12) + 12) % 12)) return nn;
        const down = m - 1, up = m + 1;
        const dIn = scaleNotes.has(((down % 12) + 12) % 12);
        const uIn = scaleNotes.has(((up % 12) + 12) % 12);
        const target = dIn && !uIn ? down : (!dIn && uIn ? up : (dIn && uIn ? (nn.pitchBend || 0) < 0 ? down : up : m));
        if (target === m) return nn;
        return ev(target, nn.startTick || 0, nn.durationTicks || 120, nn.velocity || 0.7, 0);
      });
    });
  }

  // Sort every channel and drop stacked duplicates
  ELITE_16_CHANNELS.forEach((ch) => {
    const list = (groove[ch] || []) as NoteEvent[];
    if (!list.length) return;
    const seen = new Set<string>();
    groove[ch] = list
      .sort((a, b) => (a.startTick || 0) - (b.startTick || 0))
      .filter((n) => {
        const k = `${n.startTick}-${Array.isArray(n.note) ? n.note[0] : n.note}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  });

  groove.analysisMeta = {
    detectedBpm: analysis.sourceBpm || analysis.bpm,
    usedBpm: bpm,
    detectedKey: `${analysis.key} ${analysis.scale}`,
    usedKey: `${key} ${scale}`,
    durationSec: analysis.durationSec,
    channels: ELITE_16_CHANNELS.reduce((acc: Record<string, number>, ch) => {
      const count = (groove[ch] || []).length;
      if (count) acc[ch] = count;
      return acc;
    }, {}),
    detectedStems: analysis.detected,
    chordsFound: (analysis.chords || []).length,
    mode: 'multi-channel transcription',
  };
  return groove as GrooveObject;
}

export interface MelodyOnlyOptions {
  bpm?: number;
  key?: string;
  scale?: string;
  trackName?: string;
  /** 4 = 1/16 grid (default), 8 = 1/32, 16 = 1/64 (closest to the raw performance) */
  gridDiv?: number;
  /** snap out-of-key notes to the detected scale (off by default: 1:1 fidelity) */
  snapToKey?: boolean;
}

/**
 * ONE channel, nothing invented.
 * Produces a single monophonic melody line that follows the source recording -
 * no drums, no bass, no chords, no fabricated arrangement.
 */
export function arrangeMelodyOnly(analysis: AudioStemAnalysis, options: MelodyOnlyOptions = {}): GrooveObject {
  const bpm = options.bpm && options.bpm > 40 ? options.bpm : analysis.bpm;
  const key = options.key || analysis.key;
  const scale = options.scale || analysis.scale;
  const gridDiv = options.gridDiv ?? 4;

  // Rebuild the notes at the requested resolution when we still have the frames
  const sourceBpm = Math.max(80, analysis.sourceBpm || analysis.bpm || bpm);
  let melody: NoteEvent[] = analysis.leadFrames && analysis.leadFrames.length
    ? framesToNotes(analysis.leadFrames, sourceBpm, gridDiv)
    : analysis.lead;

  const tickScale = bpm / sourceBpm;
  melody = melody
    .map((n) => ev(
      theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note),
      Math.round((n.startTick || 0) * tickScale),
      Math.max(24, Math.round((n.durationTicks || 120) * tickScale)),
      Math.min(1, n.velocity || 0.8),
      n.pitchBend || 0
    ))
    .sort((a, b) => (a.startTick || 0) - (b.startTick || 0));

  // strictly monophonic
  for (let i = 0; i < melody.length - 1; i++) {
    const end = (melody[i].startTick || 0) + (melody[i].durationTicks || 0);
    const nextStart = melody[i + 1].startTick || 0;
    if (end > nextStart) melody[i].durationTicks = Math.max(24, nextStart - (melody[i].startTick || 0));
  }

  if (options.snapToKey) {
    const scaleNotes = new Set(
      theoryEngine.getScaleNotes(key, scale).map((nn) => theoryEngine.getMidiNote(`${nn}4`) % 12)
    );
    if (scaleNotes.size >= 5) {
      melody = melody.map((n) => {
        const m = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
        if (scaleNotes.has(((m % 12) + 12) % 12)) return n;
        const down = scaleNotes.has((((m - 1) % 12) + 12) % 12);
        const up = scaleNotes.has((((m + 1) % 12) + 12) % 12);
        const target = down && !up ? m - 1 : (!down && up ? m + 1 : m);
        return target === m ? n : ev(target, n.startTick || 0, n.durationTicks || 120, n.velocity || 0.7, 0);
      });
    }
  }

  const lastTick = melody.reduce((mx, n) => Math.max(mx, (n.startTick || 0) + (n.durationTicks || 0)), 0);
  const audioTicks = Math.round((analysis.durationSec || 0) * bpm * 480 / 60);
  const totalBars = Math.max(4, Math.ceil(Math.max(lastTick, audioTicks) / 1920));

  const groove: any = {
    id: `MELODY-${Date.now()}`,
    name: options.trackName || `Melody · ${key} ${scale}`,
    bpm,
    key,
    scale,
    totalBars,
    meta: { architecture: '1:1 melody transcription', sourceBpm, gridDiv },
  };
  ELITE_16_CHANNELS.forEach((ch) => { groove[ch] = []; });
  groove.ch4_leadA = melody;

  groove.analysisMeta = {
    detectedBpm: analysis.sourceBpm || analysis.bpm,
    usedBpm: bpm,
    detectedKey: `${analysis.key} ${analysis.scale}`,
    usedKey: `${key} ${scale}`,
    durationSec: analysis.durationSec,
    channels: { ch4_leadA: melody.length },
    mode: '1:1 melody',
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
