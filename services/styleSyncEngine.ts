import { ChannelKey, EnergyLevel, MusicGenre, NoteEvent } from '../types';
import { theoryEngine } from './theoryEngine';

const TICKS_BAR = 1920;
const TICKS_16 = 120;

export type StyleId = 'goa' | 'fullon' | 'power' | 'melodic' | 'techno';

export interface GrooveSession {
  seed: number;
  style: StyleId;
  key: string;
  scaleName: string;
  scale: number[];
  root: number;
  complex: boolean;
  chords: number[][];
  kickMask: number[];
}

type Hit = { step: number; deg: number; oct: number; dur: number; vel: number };

const note = (midi: number, bar: number, step: number, durTicks: number, vel: number): NoteEvent => {
  const s = ((step % 16) + 16) % 16;
  return {
    note: theoryEngine.midiToNote(midi),
    time: `${bar}:${Math.floor(s / 4)}:${s % 4}`,
    duration: 'custom',
    durationTicks: Math.max(24, durTicks),
    startTick: bar * TICKS_BAR + s * TICKS_16,
    velocity: Math.max(0.2, Math.min(1, vel)),
  };
};

const makeRng = (seed: number) => {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

const irand = (rng: () => number, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

export function styleOf(genre: string): StyleId {
  const g = String(genre || '');
  if (g.includes('Goa')) return 'goa';
  if (g.includes('Power')) return 'power';
  if (g.includes('Melodic')) return 'melodic';
  if (g.includes('Techno')) return 'techno';
  return 'fullon';
}

export const STYLE_BPM: Record<StyleId, number> = {
  goa: 148,
  fullon: 145,
  power: 142,
  melodic: 126,
  techno: 132,
};

const PROGRESSIONS: Record<StyleId, number[][][]> = {
  goa: [
    [[0, 1, 4], [0, 1, 4], [0, 3, 5], [0, 3, 5], [1, 3, 5], [1, 3, 5], [0, 1, 4], [0, 4, 6]],
    [[0, 2, 4], [0, 2, 4], [3, 5, 0], [3, 5, 0], [1, 4, 6], [1, 4, 6], [0, 2, 4], [0, 3, 5]],
  ],
  fullon: [
    [[0, 2, 4], [0, 2, 4], [0, 2, 5], [0, 2, 4], [3, 5, 0], [3, 5, 0], [0, 2, 4], [0, 4, 6]],
    [[0, 3, 5], [0, 3, 5], [0, 2, 4], [0, 2, 4], [5, 0, 2], [5, 0, 2], [0, 3, 5], [3, 5, 7]],
  ],
  power: [
    [[0, 2, 4], [0, 2, 4], [0, 3, 5], [0, 2, 4], [3, 5, 0], [3, 5, 0], [0, 2, 4], [0, 4, 6]],
    [[0, 3, 5], [0, 3, 5], [0, 2, 4], [0, 2, 4], [1, 4, 6], [1, 4, 6], [0, 3, 5], [3, 5, 7]],
  ],
  melodic: [
    [[0, 2, 4], [0, 2, 4], [5, 0, 2], [5, 0, 2], [3, 5, 0], [3, 5, 0], [4, 6, 1], [0, 2, 4]],
    [[0, 3, 5], [0, 3, 5], [4, 0, 2], [4, 0, 2], [2, 4, 6], [2, 4, 6], [5, 0, 3], [0, 3, 5]],
  ],
  techno: [
    [[0, 0, 4], [0, 0, 4], [0, 0, 4], [0, 0, 4], [0, 3, 0], [0, 3, 0], [0, 0, 4], [0, 4, 0]],
    [[0, 4, 0], [0, 4, 0], [0, 4, 0], [0, 4, 0], [3, 0, 3], [3, 0, 3], [0, 4, 0], [0, 0, 4]],
  ],
};

type PhraseNote = { step: number; deg: number; dur: number; vel: number; oct?: number };

const PSY_HOOKS: PhraseNote[][][] = [
  [
    [{ step: 0, deg: 0, dur: 6, vel: 0.78 }, { step: 6, deg: 2, dur: 2, vel: 0.82 }, { step: 8, deg: 3, dur: 4, vel: 0.88 }, { step: 12, deg: 5, dur: 4, vel: 0.92 }],
    [{ step: 0, deg: 0, dur: 4, vel: 0.74 }, { step: 4, deg: 3, dur: 4, vel: 0.84 }, { step: 8, deg: 2, dur: 2, vel: 0.76 }, { step: 12, deg: 0, dur: 4, vel: 0.86 }],
    [{ step: 0, deg: 5, dur: 3, vel: 0.9 }, { step: 4, deg: 7, dur: 4, vel: 0.96 }, { step: 8, deg: 5, dur: 2, vel: 0.86 }, { step: 12, deg: 3, dur: 4, vel: 0.8 }],
    [{ step: 0, deg: 7, dur: 2, vel: 0.9 }, { step: 3, deg: 5, dur: 2, vel: 0.84 }, { step: 6, deg: 3, dur: 2, vel: 0.78 }, { step: 8, deg: 2, dur: 2, vel: 0.74 }, { step: 12, deg: 0, dur: 4, vel: 0.9 }],
  ],
  [
    [{ step: 0, deg: 0, dur: 8, vel: 0.8 }, { step: 8, deg: 5, dur: 4, vel: 0.88 }, { step: 12, deg: 3, dur: 4, vel: 0.82 }],
    [{ step: 0, deg: 2, dur: 4, vel: 0.76 }, { step: 4, deg: 3, dur: 4, vel: 0.82 }, { step: 8, deg: 5, dur: 8, vel: 0.9 }],
    [{ step: 0, deg: 7, dur: 6, vel: 0.94 }, { step: 8, deg: 5, dur: 4, vel: 0.86 }, { step: 12, deg: 3, dur: 4, vel: 0.8 }],
    [{ step: 0, deg: 5, dur: 2, vel: 0.84 }, { step: 4, deg: 3, dur: 4, vel: 0.8 }, { step: 8, deg: 2, dur: 2, vel: 0.74 }, { step: 12, deg: 0, dur: 4, vel: 0.88 }],
  ],
  [
    [{ step: 2, deg: 0, dur: 4, vel: 0.76 }, { step: 6, deg: 2, dur: 2, vel: 0.8 }, { step: 8, deg: 3, dur: 8, vel: 0.9 }],
    [{ step: 0, deg: 3, dur: 4, vel: 0.8 }, { step: 4, deg: 5, dur: 4, vel: 0.86 }, { step: 10, deg: 3, dur: 2, vel: 0.78 }, { step: 12, deg: 2, dur: 4, vel: 0.82 }],
    [{ step: 0, deg: 5, dur: 4, vel: 0.88 }, { step: 4, deg: 7, dur: 4, vel: 0.94 }, { step: 8, deg: 8, dur: 4, vel: 0.96 }, { step: 12, deg: 7, dur: 4, vel: 0.9 }],
    [{ step: 0, deg: 5, dur: 4, vel: 0.84 }, { step: 6, deg: 3, dur: 2, vel: 0.76 }, { step: 8, deg: 2, dur: 4, vel: 0.74 }, { step: 12, deg: 0, dur: 4, vel: 0.88 }],
  ],
];

const POWER_HOOKS: PhraseNote[][][] = [
  [
    [{ step: 0, deg: 0, dur: 3, vel: 0.88 }, { step: 4, deg: 2, dur: 3, vel: 0.9 }, { step: 8, deg: 3, dur: 3, vel: 0.86 }, { step: 12, deg: 5, dur: 4, vel: 0.94 }],
    [{ step: 0, deg: 1, dur: 2, vel: 0.84 }, { step: 4, deg: 7, dur: 4, vel: 0.95 }, { step: 10, deg: 5, dur: 2, vel: 0.86 }, { step: 12, deg: 3, dur: 4, vel: 0.88 }],
    [{ step: 0, deg: 5, dur: 3, vel: 0.92 }, { step: 4, deg: 7, dur: 3, vel: 0.96 }, { step: 8, deg: 6, dur: 2, vel: 0.88 }, { step: 12, deg: 8, dur: 4, vel: 0.98 }],
    [{ step: 0, deg: 7, dur: 2, vel: 0.9 }, { step: 4, deg: 5, dur: 2, vel: 0.84 }, { step: 8, deg: 2, dur: 2, vel: 0.8 }, { step: 12, deg: 0, dur: 4, vel: 0.92 }],
  ],
  [
    [{ step: 0, deg: 0, dur: 4, vel: 0.86 }, { step: 6, deg: 2, dur: 2, vel: 0.82 }, { step: 8, deg: 4, dur: 4, vel: 0.9 }, { step: 12, deg: 5, dur: 4, vel: 0.93 }],
    [{ step: 0, deg: 5, dur: 4, vel: 0.88 }, { step: 4, deg: 3, dur: 4, vel: 0.84 }, { step: 8, deg: 1, dur: 4, vel: 0.8 }, { step: 12, deg: 0, dur: 4, vel: 0.9 }],
    [{ step: 0, deg: 7, dur: 4, vel: 0.95 }, { step: 6, deg: 5, dur: 2, vel: 0.86 }, { step: 8, deg: 7, dur: 4, vel: 0.94 }, { step: 12, deg: 9, dur: 4, vel: 0.98 }],
    [{ step: 0, deg: 5, dur: 3, vel: 0.86 }, { step: 4, deg: 3, dur: 3, vel: 0.8 }, { step: 8, deg: 2, dur: 4, vel: 0.78 }, { step: 12, deg: 0, dur: 4, vel: 0.9 }],
  ],
];

const GOA_CELLS: number[][] = [
  [0, 1, 3, 1, 0, 3, 5, 3],
  [0, 1, 0, 3, 5, 3, 1, 0],
  [3, 1, 0, 1, 3, 5, 7, 5],
  [0, 3, 5, 7, 5, 3, 1, 0],
  [1, 0, 3, 1, 5, 3, 1, 0],
  [0, 1, 3, 5, 3, 1, 0, 1],
];

function degMidi(session: GrooveSession, bar: number, deg: number, octaveAdd: number) {
  const chord = session.chords[bar % session.chords.length];
  const shifted = deg + chord[0];
  const octave = Math.floor(shifted / session.scale.length);
  const d = ((shifted % session.scale.length) + session.scale.length) % session.scale.length;
  return session.root + session.scale[d] + octave * 12 + octaveAdd;
}

export function makeSession(
  seed: number,
  genre: MusicGenre | string,
  key: string,
  scaleName: string,
  complex: boolean
): GrooveSession {
  const rng = makeRng(seed);
  const style = styleOf(String(genre));
  const banks = PROGRESSIONS[style];
  const chords = banks[Math.floor(rng() * banks.length)];
  return {
    seed,
    style,
    key,
    scaleName,
    scale: theoryEngine.getScaleIntervals(scaleName),
    root: theoryEngine.getMidiNote(`${key}1`),
    complex,
    chords,
    kickMask: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  };
}

function kickSteps(session: GrooveSession, bar: number): number[] {
  const { style, complex } = session;
  const steps = [0, 4, 8, 12];
  if (style === 'goa') {
    if (complex && bar % 4 === 3) steps.push(15);
    if (complex && bar % 2 === 1) steps.push(7);
  } else if (style === 'fullon') {
    if (complex && bar === 3) steps.push(14);
  } else if (style === 'power') {
    if (complex) steps.push(6, 14);
    if (bar === 3) steps.push(13, 15);
  } else if (style === 'melodic') {
    if (bar % 8 === 7) return [0, 4, 8];
  } else if (style === 'techno') {
    if (complex && bar === 2) return [0, 4, 7, 10, 14];
    if (bar === 3 && complex) return [0, 4, 8, 10, 12, 14, 15];
  }
  return [...new Set(steps)].sort((a, b) => a - b);
}

function isKickStep(session: GrooveSession, bar: number, step: number) {
  return kickSteps(session, bar).includes(step);
}

function bassHits(session: GrooveSession, bar: number): Hit[] {
  const { style, complex } = session;
  const out: Hit[] = [];
  const push = (step: number, deg: number, oct: number, dur: number, vel: number) => {
    if (step < 0 || step > 15) return;
    if (isKickStep(session, bar, step)) return;
    out.push({ step, deg, oct, dur, vel });
  };

  if (style === 'goa') {
    for (let s = 0; s < 16; s++) {
      if (s % 4 === 0) continue;
      if (!complex && s % 2 === 0) continue;
      push(s, 0, s % 4 === 3 ? 1 : 0, complex ? 42 : 58, 0.78 + (s % 4) * 0.04);
    }
  } else if (style === 'fullon') {
    for (let b = 0; b < 4; b++) {
      push(b * 4 + 1, 0, 0, complex ? 70 : 95, 0.86);
      push(b * 4 + 3, 0, complex && b % 2 ? 1 : 0, complex ? 55 : 80, 0.8);
      if (complex) push(b * 4 + 2, 0, 0, 50, 0.7);
    }
  } else if (style === 'power') {
    for (let b = 0; b < 4; b++) {
      push(b * 4 + 1, 0, 0, 50, 0.92);
      if (complex) push(b * 4 + 3, 4, 0, 40, 0.84);
    }
    if (bar === 3) push(14, 0, 1, 35, 0.9);
  } else if (style === 'melodic') {
    const longs = complex ? [2, 6, 10, 14] : [2, 10];
    longs.forEach((s, i) => push(s, i === 2 ? 3 : 0, 0, complex ? 280 : 400, 0.8));
  } else {
    const steps = complex ? [2, 3, 6, 10, 11, 14] : [2, 6, 10, 14];
    steps.forEach((s, i) => push(s, 0, s % 4 === 3 ? 1 : 0, complex ? 70 : 150, i % 2 ? 0.74 : 0.9));
  }
  return out;
}

function midBassHits(session: GrooveSession, bar: number): Hit[] {
  const { style, complex } = session;
  const out: Hit[] = [];
  const push = (step: number, deg: number, oct: number, dur: number, vel: number) => {
    if (step < 0 || step > 15 || isKickStep(session, bar, step)) return;
    out.push({ step, deg, oct, dur, vel });
  };
  if (style === 'goa') {
    for (let s = 1; s < 16; s += 2) push(s, s % 8 === 7 ? 2 : 0, 0, 48, 0.62);
  } else if (style === 'fullon') {
    for (let b = 0; b < 4; b++) push(b * 4 + 3, b % 2 ? 2 : 0, 0, 70, 0.68);
  } else if (style === 'power') {
    [3, 11].forEach((s) => push(s, 0, 0, 36, 0.8));
    if (complex && bar === 3) push(15, 4, 0, 30, 0.75);
  } else if (style === 'melodic') {
    push(2, 2, 0, 700, 0.55);
    if (complex) push(10, 4, 0, 500, 0.5);
  } else {
    [6, 14].forEach((s) => push(s, 0, 0, 90, 0.6));
  }
  return out;
}

function hatClosedSteps(session: GrooveSession, bar: number): number[] {
  const { style, complex } = session;
  if (style === 'goa') return Array.from({ length: 16 }, (_, i) => i).filter((s) => complex || s % 2 === 0);
  if (style === 'fullon') return [2, 6, 10, 14];
  if (style === 'power') return complex ? [2, 6, 10, 14] : [6, 14];
  if (style === 'melodic') return [2, 10];
  return complex ? Array.from({ length: 16 }, (_, i) => i).filter((s) => s % 4 !== 0) : [2, 6, 10, 14];
}

function openHatSteps(session: GrooveSession, bar: number): number[] {
  const { style, complex } = session;
  if (style === 'goa') return complex ? [6, 14] : [14];
  if (style === 'fullon') return bar % 2 === 0 ? [6, 14] : [14];
  if (style === 'power') return bar === 3 ? [14] : [];
  if (style === 'melodic') return [10];
  return complex ? [6, 14] : [14];
}

function phraseToHits(bars: PhraseNote[][], localBar: number, lift: number, oct: number): Hit[] {
  const line = bars[((localBar % bars.length) + bars.length) % bars.length];
  return line.map((n) => ({
    step: n.step,
    deg: n.deg + lift,
    oct: (n.oct || 0) + oct,
    dur: Math.max(80, n.dur * TICKS_16 - 16),
    vel: n.vel,
  }));
}

function leadHits(session: GrooveSession, bar: number): Hit[] {
  const { style, complex, seed } = session;
  const rng = makeRng((seed >>> 0) ^ 0x51ed);
  const cycle = Math.floor(bar / 8) % 3;
  const local = bar % 4;
  const lift = cycle === 1 ? 2 : 0;
  const oct = cycle === 2 ? 1 : 0;

  if (style === 'goa') {
    const cell = GOA_CELLS[((seed >>> 0) + local + cycle) % GOA_CELLS.length];
    const n = complex ? 16 : 8;
    const out: Hit[] = [];
    for (let i = 0; i < n; i++) {
      const step = complex ? i : i * 2;
      const isAnchor = step % 8 === 0;
      out.push({
        step,
        deg: cell[i % cell.length] + lift + (local === 2 && i >= n / 2 ? 2 : 0),
        oct: oct + (local === 3 && i >= n / 2 ? 1 : 0),
        dur: isAnchor ? (complex ? 140 : 200) : complex ? 58 : 90,
        vel: isAnchor ? 0.9 : 0.62 + (i % 4) * 0.06,
      });
    }
    return out;
  }

  if (style === 'techno') {
    const degs = [0, 0, 3, 0];
    const steps = complex ? (local === 3 ? [0, 6, 12] : [0, 6, 14]) : [0];
    return steps.map((step, i) => ({
      step,
      deg: degs[i % degs.length] + lift,
      oct,
      dur: complex ? 160 : 480,
      vel: 0.82 + i * 0.04,
    }));
  }

  if (style === 'melodic') {
    const degs = [0, 2, 4, 5, 3, 0];
    const parts = complex
      ? (local % 2 === 0 ? [[0, 8], [8, 8]] : [[0, 6], [8, 8]])
      : [[0, 16]];
    return parts.map(([step, len], i) => ({
      step,
      deg: degs[(i + local + cycle) % degs.length] + lift,
      oct: oct + (local === 2 ? 1 : 0),
      dur: len * TICKS_16 - 24,
      vel: 0.72 + i * 0.08,
    }));
  }

  const bank = style === 'power' ? POWER_HOOKS : PSY_HOOKS;
  const phrase = bank[(seed >>> 0) % bank.length];
  const degShift = (seed >>> 5) % 3;
  const invert = ((seed >>> 8) & 1) === 1;
  const hits = phraseToHits(phrase, local, lift + degShift, oct).map((h) => ({
    ...h,
    deg: invert ? Math.max(0, 7 - (h.deg - lift - degShift)) + lift + degShift : h.deg,
  }));
  if (!complex) return hits.filter((h, i) => i % 2 === 0 || h.dur >= 360);
  return hits;
}

function acidDegrees(session: GrooveSession, bar: number): number[] {
  const { style, complex, seed } = session;
  const rng = makeRng((seed >>> 0) ^ 0xa31c ^ (bar + 3) * 97);
  const empty = new Array(16).fill(-1);
  if (style === 'goa') {
    return Array.from({ length: 16 }, (_, i) => {
      if (i % 4 === 0) return -1;
      if (!complex && rng() < 0.2) return -1;
      return (i + bar) % 6;
    });
  }
  if (style === 'power') {
    return Array.from({ length: 16 }, (_, i) => (i % 4 === 3 ? (i > 8 ? 4 : 0) : -1));
  }
  if (style === 'melodic') {
    const line = empty.slice();
    line[2] = 0;
    line[10] = 3;
    return line;
  }
  if (style === 'techno') {
    const line = empty.slice();
    [6, 14].forEach((s, i) => { line[s] = i ? 3 : 0; });
    if (complex && bar % 2 === 1) line[10] = 0;
    return line;
  }
  const base = [-1, 0, -1, 1, -1, 0, -1, 0, -1, 1, -1, 3, -1, 0, -1, 1];
  const rot = irand(rng, 0, 7);
  return base.map((d, i) => {
    const src = base[(i + rot) % 16];
    if (src < 0) return -1;
    if (!complex && rng() < 0.3) return -1;
    if (complex && rng() < 0.12) return -1;
    return (src + irand(rng, 0, 2)) % 6;
  });
}

function arpHits(session: GrooveSession, bar: number): Hit[] {
  const { style, complex } = session;
  const chord = session.chords[bar % session.chords.length];
  const out: Hit[] = [];
  if (style === 'power' || style === 'techno') return out;
  if (style === 'melodic') {
    [0, 8].forEach((s, i) => {
      out.push({ step: s, deg: chord[i % chord.length], oct: 0, dur: 8 * TICKS_16 - 40, vel: 0.42 });
    });
    return out;
  }
  if (style === 'fullon') {
    for (let s = 2; s < 16; s += 2) {
      out.push({ step: s, deg: chord[(s / 2) % chord.length], oct: bar % 4 === 2 && s >= 12 ? 1 : 0, dur: 140, vel: 0.48 });
    }
    return out;
  }
  const step = complex ? 1 : 2;
  for (let s = 0; s < 16; s += step) {
    if (s % 4 === 0) continue;
    out.push({
      step: s,
      deg: chord[(s / step) % chord.length],
      oct: bar % 4 === 3 && s >= 12 ? 1 : 0,
      dur: step === 1 ? 55 : 110,
      vel: 0.46 + s / 40,
    });
  }
  return out;
}

function writeHit(dest: NoteEvent[], session: GrooveSession, bar: number, hit: Hit, register: number) {
  dest.push(note(degMidi(session, bar, hit.deg, register + hit.oct * 12), bar, hit.step, hit.dur, hit.vel));
}

export function writeStyleBar(
  session: GrooveSession,
  bar: number,
  dest: Record<string, NoteEvent[]>,
  layers: Set<ChannelKey>,
  energy: EnergyLevel
) {
  const style = session.style;
  const kicks = kickSteps(session, bar);
  if (layers.has('ch1_kick')) {
    const kickDur = style === 'melodic' ? 220 : style === 'power' ? 160 : style === 'techno' ? 120 : style === 'goa' ? 130 : 145;
    kicks.forEach((s) => dest.ch1_kick.push(note(36, bar, s, kickDur, s % 4 === 0 ? 1 : 0.88)));
  }

  if (layers.has('ch2_sub')) {
    bassHits(session, bar).forEach((h) => writeHit(dest.ch2_sub, session, bar, h, 0));
  }
  if (layers.has('ch3_midBass')) {
    midBassHits(session, bar).forEach((h) => writeHit(dest.ch3_midBass, session, bar, h, 12));
  }

  if (layers.has('ch12_hhClosed') && energy >= EnergyLevel.LOW) {
    hatClosedSteps(session, bar).forEach((s) => {
      dest.ch12_hhClosed.push(note(42, bar, s, 40, s % 4 === 2 ? 0.8 : 0.4));
    });
  }
  if (layers.has('ch13_hhOpen') && energy >= EnergyLevel.MED) {
    openHatSteps(session, bar).forEach((s) => dest.ch13_hhOpen.push(note(46, bar, s, 90, 0.68)));
  }

  if (layers.has('ch8_snare') && energy >= EnergyLevel.MED) {
    if (style === 'techno' || style === 'melodic') {
      [4, 12].forEach((s) => dest.ch8_snare.push(note(38, bar, s, 120, 0.92)));
      if (session.complex && bar % 4 === 3 && style === 'techno') {
        for (let s = 8; s < 16; s += 2) dest.ch8_snare.push(note(38, bar, s, 40, 0.5 + (s - 8) / 20));
      }
    } else if (style === 'power' && bar % 4 === 3) {
      dest.ch8_snare.push(note(38, bar, 12, 80, 0.7));
    }
  }
  if (layers.has('ch9_clap') && energy >= EnergyLevel.HIGH) {
    if (style === 'techno') [4, 12].forEach((s) => dest.ch9_clap.push(note(39, bar, s, 100, 0.7)));
    else if (style === 'power') dest.ch9_clap.push(note(39, bar, 12, 90, 0.65));
  }

  if (layers.has('ch10_percLoop') && energy >= EnergyLevel.MED && style !== 'melodic') {
    const hits = style === 'goa' ? [3, 6, 11, 14] : style === 'techno' ? [3, 11] : style === 'power' ? [3, 14] : [3, 11];
    hits.forEach((s, i) => dest.ch10_percLoop.push(note(63 + (i % 3), bar, s, 55, 0.48)));
  }
  if (layers.has('ch11_percTribal') && energy >= EnergyLevel.HIGH && (style === 'goa' || style === 'fullon')) {
    const hits = style === 'goa' ? [1, 7, 9, 13] : [1, 9];
    hits.forEach((s, i) => dest.ch11_percTribal.push(note(64 + (i % 2), bar, s, 60, 0.46)));
  }

  if (layers.has('ch15_pad')) {
    const chord = session.chords[bar % session.chords.length];
    if (style === 'techno') {
      if (bar % 8 === 0) dest.ch15_pad.push(note(degMidi(session, bar, 0, 24), bar, 0, 360, 0.3));
    } else {
      const hold = style === 'melodic' ? TICKS_BAR - 16 : style === 'power' ? 720 : TICKS_BAR - 30;
      chord.forEach((d, i) => dest.ch15_pad.push(note(degMidi(session, bar, d, 24 + (i === 2 ? 12 : 0)), bar, 0, hold, 0.38 + i * 0.04)));
    }
  }

  if (layers.has('ch4_leadA') && energy >= EnergyLevel.MED) {
    leadHits(session, bar).forEach((h) => {
      const midi = degMidi(session, bar, h.deg, 36 + h.oct * 12);
      const parked = midi < 60 ? midi + 12 : midi > 86 ? midi - 12 : midi;
      dest.ch4_leadA.push(note(parked, bar, h.step, h.dur, h.vel));
    });
  }
  if (layers.has('ch5_leadB') && energy >= EnergyLevel.HIGH && session.style !== 'techno') {
    leadHits(session, bar).filter((h) => h.dur >= (style === 'goa' ? 120 : 240)).forEach((h) => {
      const midi = degMidi(session, bar, h.deg + 2, 36 + h.oct * 12);
      dest.ch5_leadB.push(note(midi < 62 ? midi + 12 : midi, bar, h.step, h.dur + 40, h.vel * 0.7));
    });
  }

  if (layers.has('ch6_arpA') && energy >= EnergyLevel.HIGH) {
    arpHits(session, bar).forEach((h) => writeHit(dest.ch6_arpA, session, bar, h, 36));
  }
  if (layers.has('ch7_arpB') && energy >= EnergyLevel.PEAK && session.style !== 'power' && session.style !== 'techno') {
    arpHits(session, bar).forEach((h) => writeHit(dest.ch7_arpB, session, bar, { ...h, oct: h.oct + 1 }, 36));
  }

  if (layers.has('ch14_acid') && energy >= EnergyLevel.HIGH) {
    const register = session.style === 'goa' ? (bar >= 2 ? 24 : 12) : session.style === 'power' ? 0 : 12;
    const dur = session.style === 'goa' ? 42 : session.style === 'melodic' ? 160 : session.style === 'techno' ? 40 : 55;
    acidDegrees(session, bar).forEach((deg, step) => {
      if (deg < 0 || isKickStep(session, bar, step)) return;
      dest.ch14_acid.push(note(degMidi(session, bar, deg, register), bar, step, dur, session.style === 'power' ? 0.88 : 0.74));
    });
  }

  if (layers.has('ch16_synth') && energy >= EnergyLevel.HIGH) {
    const phraseEnd = bar % 8 === 7 || bar % 8 === 6;
    if (style === 'melodic' && bar % 4 === 0) {
      dest.ch16_synth.push(note(degMidi(session, bar, 4, 48), bar, 0, TICKS_BAR - 60, 0.38));
    } else if (style === 'techno' && phraseEnd) {
      dest.ch16_synth.push(note(degMidi(session, bar, 0, 48), bar, 12, 280, 0.55));
    } else if (phraseEnd && (style === 'goa' || style === 'fullon' || style === 'power')) {
      dest.ch16_synth.push(note(degMidi(session, bar, 7, 48), bar, 8, 800, 0.5));
      dest.ch16_synth.push(note(degMidi(session, bar, 8, 48), bar, 12, 400, 0.62));
    }
  }
}

export function applyPumpLock(dest: Record<string, NoteEvent[]>, session: GrooveSession, fromBar: number, bars: number) {
  const pumped = new Set(['ch2_sub', 'ch3_midBass', 'ch14_acid']);
  pumped.forEach((ch) => {
    const notes = dest[ch];
    if (!notes) return;
    dest[ch] = notes.filter((n) => {
      const bar = Math.floor((n.startTick || 0) / TICKS_BAR);
      if (bar < fromBar || bar >= fromBar + bars) return true;
      const step = Math.round(((n.startTick || 0) % TICKS_BAR) / TICKS_16);
      if (!isKickStep(session, bar, step)) return true;
      return false;
    });
    dest[ch].forEach((n) => {
      const bar = Math.floor((n.startTick || 0) / TICKS_BAR);
      const step = Math.round(((n.startTick || 0) % TICKS_BAR) / TICKS_16);
      const nextKick = kickSteps(session, bar).find((k) => k > step);
      if (nextKick == null) return;
      const maxDur = (nextKick - step) * TICKS_16 - 8;
      if ((n.durationTicks || 0) > maxDur) n.durationTicks = Math.max(24, maxDur);
    });
  });
}

export function emptyDest(): Record<string, NoteEvent[]> {
  return {
    ch1_kick: [], ch2_sub: [], ch3_midBass: [], ch4_leadA: [], ch5_leadB: [],
    ch6_arpA: [], ch7_arpB: [], ch8_snare: [], ch9_clap: [], ch10_percLoop: [],
    ch11_percTribal: [], ch12_hhClosed: [], ch13_hhOpen: [], ch14_acid: [], ch15_pad: [], ch16_synth: [],
  };
}

export function composeSeededLoop(
  channel: ChannelKey,
  key: string,
  scaleName: string,
  genre: MusicGenre | string,
  complexity: 'SIMPLE' | 'COMPLEX',
  seed: number
): NoteEvent[] {
  const session = makeSession(seed, genre, key, scaleName, complexity === 'COMPLEX');
  const dest = emptyDest();
  const layers = new Set<ChannelKey>([
    'ch1_kick', 'ch2_sub', 'ch3_midBass', 'ch4_leadA', 'ch5_leadB',
    'ch6_arpA', 'ch7_arpB', 'ch8_snare', 'ch9_clap', 'ch10_percLoop',
    'ch11_percTribal', 'ch12_hhClosed', 'ch13_hhOpen', 'ch14_acid', 'ch15_pad', 'ch16_synth',
  ]);
  for (let bar = 0; bar < 4; bar++) writeStyleBar(session, bar, dest, layers, EnergyLevel.PEAK);
  applyPumpLock(dest, session, 0, 4);
  return dest[channel] || [];
}

export function bassOnKickCount(dest: Record<string, NoteEvent[]>, session: GrooveSession, bars = 4) {
  let hits = 0;
  (dest.ch2_sub || []).forEach((n) => {
    const bar = Math.floor((n.startTick || 0) / TICKS_BAR);
    if (bar >= bars) return;
    const step = Math.round(((n.startTick || 0) % TICKS_BAR) / TICKS_16);
    if (isKickStep(session, bar, step)) hits++;
  });
  return hits;
}
