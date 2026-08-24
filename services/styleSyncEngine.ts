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
    [[0, 4, 0], [0, 4, 0], [0, 4, 1], [0, 4, 0], [1, 4, 0], [1, 4, 0], [0, 4, 0], [4, 0, 4]],
    [[0, 3, 0], [0, 3, 0], [0, 4, 0], [0, 4, 0], [3, 0, 4], [3, 0, 4], [0, 3, 0], [0, 4, 0]],
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

const LEAD_CONTOURS: Record<StyleId, number[][]> = {
  goa: [[0, 1, 3, 1], [0, 1, 3, 5], [3, 1, 0, 1], [0, 3, 5, 7], [1, 0, 3, 1], [5, 3, 1, 0]],
  fullon: [[0, 2, 3, 5], [0, 3, 2, 0], [5, 3, 2, 0], [0, 7, 5, 3], [3, 5, 0, 2], [0, 2, 4, 7]],
  power: [[0, 4, 0, 4], [0, 0, 4, 0], [4, 0, 4, 1], [0, 4, 1, 0]],
  melodic: [[0, 2, 4, 5], [4, 2, 0, 2], [0, 3, 5, 3], [5, 4, 2, 0], [0, 2, 7, 5]],
  techno: [[0, 0, 0, 3], [0, -1, 0, -1], [0, 4, 0, 0], [3, 0, 0, 0]],
};

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

function hatClosedSteps(session: GrooveSession, bar: number): number[] {
  const { style, complex } = session;
  if (style === 'goa') return Array.from({ length: 16 }, (_, i) => i).filter((s) => complex || s % 2 === 0);
  if (style === 'fullon') return complex ? [0, 2, 4, 6, 8, 10, 12, 14] : [2, 6, 10, 14];
  if (style === 'power') return complex ? [2, 6, 8, 10, 14] : [6, 14];
  if (style === 'melodic') return complex ? [2, 6, 10, 14] : [2, 10];
  return complex ? Array.from({ length: 16 }, (_, i) => i) : [2, 6, 10, 14];
}

function openHatSteps(session: GrooveSession, bar: number): number[] {
  const { style, complex } = session;
  if (style === 'goa') return [2, 6, 10, 14];
  if (style === 'fullon') return bar % 2 === 0 ? [6, 14] : [2, 10];
  if (style === 'power') return bar === 3 ? [14, 15] : [14];
  if (style === 'melodic') return [2, 10];
  return complex ? [2, 6, 10, 14] : [6, 14];
}

function leadHits(session: GrooveSession, bar: number): Hit[] {
  const { style, complex, seed } = session;
  const rng = makeRng((seed >>> 0) ^ ((bar + 1) * 7919));
  const bank = LEAD_CONTOURS[style];
  const contour = bank[Math.floor(rng() * bank.length)];
  const out: Hit[] = [];

  if (style === 'goa') {
    const n = complex ? 16 : 8;
    for (let i = 0; i < n; i++) {
      const step = complex ? i : i * 2;
      out.push({
        step,
        deg: contour[i % contour.length] + (bar >= 2 && i >= n / 2 ? 2 : 0),
        oct: bar >= 2 && i >= 8 ? 1 : 0,
        dur: complex ? 55 : 90,
        vel: 0.62 + (i % 4) * 0.06,
      });
    }
    return out;
  }

  if (style === 'techno') {
    const steps = complex ? [0, 6, bar === 3 ? 12 : 14] : [0];
    steps.forEach((step, i) => out.push({
      step,
      deg: contour[i % contour.length],
      oct: 0,
      dur: complex ? 90 : 360,
      vel: 0.8,
    }));
    return out;
  }

  if (style === 'melodic') {
    const parts = complex
      ? [[0, 8], [8, 8]]
      : [[0, 16]];
    parts.forEach(([step, len], i) => out.push({
      step,
      deg: contour[(i + bar) % contour.length],
      oct: bar === 2 ? 1 : 0,
      dur: len * TICKS_16 - 20,
      vel: 0.72 + i * 0.08,
    }));
    return out;
  }

  if (style === 'power') {
    const steps = complex ? [0, 4, 8, 12] : [0, 8];
    steps.forEach((step, i) => out.push({
      step,
      deg: contour[i % contour.length],
      oct: bar === 2 ? 1 : 0,
      dur: complex ? 80 : 200,
      vel: 0.88,
    }));
    return out;
  }

  const rhythmBank = complex
    ? [
        [[0, 4], [4, 4], [8, 3], [12, 4]],
        [[0, 3], [4, 4], [8, 2], [11, 5]],
        [[0, 6], [8, 4], [12, 4]],
        [[0, 2], [3, 3], [8, 4], [12, 4]],
        [[2, 4], [8, 4], [14, 2]],
        [[0, 8], [10, 2], [13, 3]],
      ]
    : [[[0, 8], [8, 8]], [[0, 16]], [[0, 4], [8, 8]]];
  const rhythms = rhythmBank[irand(rng, 0, rhythmBank.length - 1)];
  const lift = irand(rng, 0, 3);
  return rhythms.map(([step, len], i) => ({
    step,
    deg: contour[(i + bar + lift) % contour.length] + (bar === 2 ? 2 : 0),
    oct: bar === 2 && rng() > 0.45 ? 1 : 0,
    dur: len * TICKS_16 - 12,
    vel: 0.74 + i * 0.04,
  }));
}

function acidDegrees(session: GrooveSession, bar: number): number[] {
  const { style, complex, seed } = session;
  const rng = makeRng((seed >>> 0) ^ 0xa31c ^ (bar + 3) * 97);
  const empty = new Array(16).fill(-1);
  if (style === 'goa') {
    return Array.from({ length: 16 }, (_, i) => {
      if (!complex && rng() < 0.2) return -1;
      return (i + bar) % 6;
    });
  }
  if (style === 'power') {
    return Array.from({ length: 16 }, (_, i) => (i % 4 === 3 ? 4 : i % 2 === 0 ? 0 : -1));
  }
  if (style === 'melodic') {
    const line = empty.slice();
    [0, 8].forEach((s, i) => { line[s] = i ? 3 : 0; });
    if (complex) line[4] = 2;
    return line;
  }
  if (style === 'techno') {
    const line = empty.slice();
    [2, 6, 10, 14].forEach((s, i) => { line[s] = i === 3 ? 3 : 0; });
    if (complex) line[11] = 0;
    return line;
  }
  const base = [0, -1, 0, 1, 0, -1, 0, 0, 1, -1, 0, 3, 0, -1, 0, 1];
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
  if (style === 'power') return out;
  if (style === 'techno' && !complex) return out;
  if (style === 'melodic') {
    const step = complex ? 4 : 8;
    for (let s = 0; s < 16; s += step) {
      out.push({ step: s, deg: chord[(s / step) % chord.length], oct: 0, dur: step * TICKS_16 - 30, vel: 0.48 });
    }
    return out;
  }
  const step = style === 'goa' || (style === 'fullon' && complex) ? 1 : 2;
  for (let s = 0; s < 16; s += step) {
    out.push({
      step: s,
      deg: chord[(s / step) % chord.length],
      oct: bar >= 2 && s >= 12 ? 1 : 0,
      dur: step === 1 ? 60 : 130,
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
  const kicks = kickSteps(session, bar);
  if (layers.has('ch1_kick')) {
    kicks.forEach((s) => dest.ch1_kick.push(note(36, bar, s, session.style === 'melodic' ? 200 : 140, s % 4 === 0 ? 1 : 0.88)));
  }

  if (layers.has('ch2_sub')) {
    bassHits(session, bar).forEach((h) => writeHit(dest.ch2_sub, session, bar, h, 0));
  }
  if (layers.has('ch3_midBass')) {
    bassHits(session, bar).forEach((h) => writeHit(dest.ch3_midBass, session, bar, { ...h, oct: h.oct }, 12));
  }

  if (layers.has('ch12_hhClosed') && energy >= EnergyLevel.LOW) {
    hatClosedSteps(session, bar).forEach((s) => {
      dest.ch12_hhClosed.push(note(42, bar, s, 40, s % 4 === 2 ? 0.8 : 0.4));
    });
  }
  if (layers.has('ch13_hhOpen') && energy >= EnergyLevel.MED) {
    openHatSteps(session, bar).forEach((s) => dest.ch13_hhOpen.push(note(46, bar, s, 90, 0.68)));
  }

  const wantBackbeat = session.style === 'techno' || session.style === 'melodic' || session.style === 'power';
  if (layers.has('ch8_snare') && wantBackbeat && energy >= EnergyLevel.MED) {
    [4, 12].forEach((s) => dest.ch8_snare.push(note(38, bar, s, 120, 0.92)));
    if (session.complex && bar % 4 === 3 && session.style === 'techno') {
      for (let s = 8; s < 16; s += 2) dest.ch8_snare.push(note(38, bar, s, 40, 0.5 + (s - 8) / 20));
    }
  }
  if (layers.has('ch9_clap') && (session.style === 'fullon' || session.style === 'power' || session.style === 'techno') && energy >= EnergyLevel.MED) {
    [4, 12].forEach((s) => dest.ch9_clap.push(note(39, bar, s, 100, 0.7)));
  }

  if (layers.has('ch10_percLoop') && energy >= EnergyLevel.MED && session.style !== 'melodic') {
    const hits = session.style === 'goa' ? [3, 6, 10, 11, 14] : session.style === 'techno' ? [3, 11] : [3, 10, 14];
    hits.forEach((s, i) => dest.ch10_percLoop.push(note(60 + i, bar, s, 65, 0.55)));
  }
  if (layers.has('ch11_percTribal') && energy >= EnergyLevel.HIGH && (session.style === 'goa' || session.style === 'fullon')) {
    [1, 7, 9, 13].forEach((s, i) => dest.ch11_percTribal.push(note(62 + (i % 3), bar, s, 65, 0.5)));
  }

  if (layers.has('ch15_pad') && session.style !== 'techno') {
    const chord = session.chords[bar % session.chords.length];
    const hold = session.style === 'melodic' ? TICKS_BAR - 20 : session.style === 'power' ? 480 : TICKS_BAR - 40;
    chord.forEach((d, i) => dest.ch15_pad.push(note(degMidi(session, bar, d, 24 + (i === 2 ? 12 : 0)), bar, 0, hold, 0.42 + i * 0.04)));
  } else if (layers.has('ch15_pad') && session.style === 'techno' && bar % 4 === 0) {
    dest.ch15_pad.push(note(degMidi(session, bar, 0, 24), bar, 0, 360, 0.35));
  }

  if (layers.has('ch4_leadA') && energy >= EnergyLevel.MED) {
    leadHits(session, bar).forEach((h) => {
      const register = session.style === 'power' ? 24 : session.style === 'goa' ? 36 : 36;
      writeHit(dest.ch4_leadA, session, bar, h, register);
    });
  }
  if (layers.has('ch5_leadB') && energy >= EnergyLevel.HIGH && session.style !== 'techno') {
    leadHits(session, bar).forEach((h) => {
      if (h.step % 4 === 0) return;
      writeHit(dest.ch5_leadB, session, bar, { ...h, deg: h.deg + 2, vel: h.vel * 0.75 }, 36);
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

  if (layers.has('ch16_synth') && (energy >= EnergyLevel.PEAK || (session.style === 'melodic' && energy >= EnergyLevel.HIGH))) {
    const step = session.style === 'techno' ? 8 : session.style === 'melodic' ? 0 : 4;
    if (session.style === 'melodic') {
      dest.ch16_synth.push(note(degMidi(session, bar, 4, 48), bar, 0, TICKS_BAR - 80, 0.4));
    } else {
      for (let s = 0; s < 16; s += step || 4) {
        dest.ch16_synth.push(note(degMidi(session, bar, 0, 48), bar, s, 50, 0.45));
      }
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
