import { ChannelKey, MusicGenre, NoteEvent } from '../types';
import { theoryEngine } from './theoryEngine';

const TICKS_BAR = 1920;
const TICKS_16 = 120;

type Rng = () => number;

const note = (midi: number, bar: number, step: number, durTicks: number, vel: number): NoteEvent => {
  const s = ((step % 16) + 16) % 16;
  return {
    note: theoryEngine.midiToNote(midi),
    time: `${bar}:${Math.floor(s / 4)}:${s % 4}`,
    duration: 'custom',
    durationTicks: Math.max(30, durTicks),
    startTick: bar * TICKS_BAR + s * TICKS_16,
    velocity: Math.max(0.2, Math.min(1, vel)),
  };
};

const makeRng = (seed: number): Rng => {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

const pick = <T,>(rng: Rng, items: T[]): T => items[Math.floor(rng() * items.length) % items.length];
const irand = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

/** Shared 16-step pocket every instrument locks to. */
export interface GrooveKit {
  seed: number;
  pocket: number[];
  kickStyle: number;
  bassStyle: number;
  hatStyle: number;
  snareStyle: number;
  percStyle: number;
  acidStyle: number;
  arpStyle: number;
  leadStyle: number;
  fxStyle: number;
  padStyle: number;
}

export function buildGrooveKit(seed: number): GrooveKit {
  const rng = makeRng(seed);
  const pocket = Array.from({ length: 16 }, (_, i) => {
    const down = i % 4 === 0 ? 1 : 0;
    const off = i % 4 === 2 ? 0.65 : 0;
    const sync = i % 4 === 3 ? 0.45 : 0;
    return Math.min(1, down + off * rng() + sync * rng() + rng() * 0.25);
  });
  pocket[0] = 1;
  pocket[4] = Math.max(pocket[4], 0.85);
  pocket[8] = 1;
  pocket[12] = Math.max(pocket[12], 0.85);
  return {
    seed,
    pocket,
    kickStyle: irand(rng, 0, 7),
    bassStyle: irand(rng, 0, 6),
    hatStyle: irand(rng, 0, 4),
    snareStyle: irand(rng, 0, 3),
    percStyle: irand(rng, 0, 4),
    acidStyle: irand(rng, 0, 7),
    arpStyle: irand(rng, 0, 4),
    leadStyle: irand(rng, 0, 5),
    fxStyle: irand(rng, 0, 5),
    padStyle: irand(rng, 0, 3),
  };
}

function kickHits(bar: number, kit: GrooveKit, complex: boolean, techno: boolean): { step: number; vel: number; dur: number }[] {
  const hits: { step: number; vel: number; dur: number }[] = [
    { step: 0, vel: 1, dur: complex ? 130 : 170 },
    { step: 4, vel: 0.96, dur: complex ? 130 : 170 },
    { step: 8, vel: 1, dur: complex ? 130 : 170 },
    { step: 12, vel: 0.94, dur: complex ? 130 : 170 },
  ];
  if (!complex) {
    if (kit.kickStyle % 2 === 1 && bar === 3) hits.push({ step: 14, vel: 0.4, dur: 45 });
    return hits;
  }

  const add = (step: number, vel: number, dur = 45) => {
    if (!hits.some((h) => h.step === step)) hits.push({ step, vel, dur });
  };

  switch (kit.kickStyle) {
    case 0: // ghosts around the offbeats
      add(6, 0.38);
      if (bar % 2 === 1) add(14, 0.42);
      if (bar === 3) add(15, 0.35, 30);
      break;
    case 1: // gallop into the backbeat
      add(3, 0.5, 40);
      add(11, 0.48, 40);
      if (bar === 3) { add(13, 0.4); add(14, 0.55, 50); }
      break;
    case 2: // techno skip / broken four
      if (techno && bar === 2) {
        return [
          { step: 0, vel: 1, dur: 120 },
          { step: 4, vel: 0.9, dur: 110 },
          { step: 7, vel: 0.7, dur: 50 },
          { step: 10, vel: 0.55, dur: 45 },
          { step: 14, vel: 0.8, dur: 80 },
        ];
      }
      add(10, 0.4);
      if (bar === 3) add(15, 0.45, 30);
      break;
    case 3: // double on 4
      add(13, 0.62, 40);
      if (bar === 3) { add(14, 0.5); add(15, 0.7, 35); }
      break;
    case 4: // psy 16th pickups
      add(15, bar === 0 ? 0.3 : 0.5, 30);
      if (bar >= 2) add(7, 0.36);
      if (bar === 3) { add(13, 0.4); add(14, 0.55); }
      break;
    case 5: // extra offbeat punch
      add(6, 0.55, 55);
      add(14, bar === 3 ? 0.7 : 0.4, 50);
      if (bar === 3) add(11, 0.42);
      break;
    case 6: // half-time lift then fill
      if (bar === 2) {
        return [
          { step: 0, vel: 1, dur: 180 },
          { step: 8, vel: 0.95, dur: 160 },
          { step: 14, vel: 0.45, dur: 40 },
        ];
      }
      if (bar === 3) {
        return [0, 4, 8, 10, 12, 13, 14, 15].map((step, i) => ({
          step,
          vel: 0.55 + i * 0.05,
          dur: step % 4 === 0 ? 90 : 35,
        }));
      }
      add(10, 0.32);
      break;
    default: // dense peak kick
      add(2, 0.3, 35);
      add(6, 0.4);
      add(10, 0.35);
      add(14, 0.5);
      if (bar === 3) add(15, 0.6, 30);
      break;
  }
  return hits.sort((a, b) => a.step - b.step);
}

function bassMap(bar: number, kit: GrooveKit, complex: boolean, techno: boolean): { step: number; oct: number; vel: number; dur: number }[] {
  const out: { step: number; oct: number; vel: number; dur: number }[] = [];
  const push = (step: number, oct: number, vel: number, dur: number) => {
    if (step >= 0 && step < 16) out.push({ step, oct, vel, dur });
  };

  if (!complex) {
    if (techno) {
      [2, 6, 10, 14].forEach((s) => push(s, 0, 0.82, 150));
    } else {
      for (let b = 0; b < 4; b++) {
        push(b * 4 + 1, 0, 0.84, 90);
        push(b * 4 + 3, 0, 0.78, 80);
      }
    }
    if (kit.bassStyle % 2 === 1 && bar === 3) out.pop();
    return out;
  }

  switch (kit.bassStyle) {
    case 0: // classic psy roll, skip last 16th of bar 4
      for (let b = 0; b < 4; b++) {
        push(b * 4 + 1, 0, 0.86, 60);
        push(b * 4 + 2, 0, 0.74, 60);
        if (!(bar === 3 && b === 3)) push(b * 4 + 3, b % 2, 0.9, 50);
      }
      break;
    case 1: // gallop
      for (let b = 0; b < 4; b++) {
        push(b * 4 + 1, 0, 0.88, 55);
        push(b * 4 + 3, 0, 0.7, 40);
        if (b % 2 === 1) push(b * 4 + 2, 1, 0.8, 45);
      }
      if (bar === 3) push(14, 1, 0.92, 40);
      break;
    case 2: // syncopated holes from pocket
      for (let s = 0; s < 16; s++) {
        if (s % 4 === 0) continue;
        if (kit.pocket[s] < 0.35 && s % 4 !== 1) continue;
        push(s, s % 8 === 7 ? 1 : 0, 0.7 + kit.pocket[s] * 0.25, 55);
      }
      break;
    case 3: // techno offbeat + extras
      [2, 3, 6, 10, 11, 14].forEach((s, i) => push(s, s % 4 === 3 ? 1 : 0, i % 2 ? 0.74 : 0.88, 85));
      if (bar === 3) push(15, 0, 0.6, 35);
      break;
    case 4: // goa-ish 16ths with root-octave pump
      for (let s = 1; s < 16; s++) {
        if (s % 4 === 0) continue;
        const skip = bar === 3 && s > 12 && s % 2 === 0;
        if (skip) continue;
        push(s, s % 4 === 3 ? 1 : 0, 0.72 + (s % 4) * 0.05, 48);
      }
      break;
    case 5: // broken roll — rest on beat 3 of bars 1+3
      for (let b = 0; b < 4; b++) {
        if (bar % 2 === 0 && b === 2) continue;
        push(b * 4 + 1, 0, 0.86, 58);
        push(b * 4 + 2, 0, 0.7, 50);
        push(b * 4 + 3, b === 3 ? 1 : 0, 0.9, 46);
      }
      break;
    default: // dense peak
      for (let s = 0; s < 16; s++) {
        if (s % 4 === 0) continue;
        push(s, kit.pocket[s] > 0.7 ? 1 : 0, 0.7 + (s % 3) * 0.08, 42);
      }
      break;
  }
  return out;
}

const ACID_SHAPES: number[][] = [
  [0, -1, 0, 1, 0, -1, 0, 0, 1, -1, 0, 3, 0, -1, 0, 1],
  [0, 0, 1, 0, 3, 0, 1, 0, 0, 3, 1, 0, 4, 0, 1, 0],
  [0, 1, 0, 3, 0, 1, 3, 0, 5, 3, 1, 0, 3, 1, 0, -1],
  [0, -1, 3, 0, -1, 1, 0, 5, 0, -1, 3, 1, 0, -1, 4, 0],
  [0, 0, 0, 1, 0, 0, 3, 0, 0, 1, 0, 4, 0, 3, 1, 0],
  [3, 0, 1, 0, 0, 3, 0, 1, 5, 0, 3, 0, 1, 0, 0, 3],
  [0, 1, 3, 5, 3, 1, 0, -1, 0, 1, 0, 3, 1, 0, -1, -1],
  [0, -1, -1, 0, 3, -1, 1, 0, 0, -1, 5, 3, 1, 0, 3, 0],
];

const LEAD_ARCS: number[][][] = [
  [[0, 8], [3, 8], [5, 8], [0, 8]],
  [[0, 4], [2, 4], [3, 4], [5, 4]],
  [[0, 6], [5, 4], [3, 4], [0, 8]],
  [[2, 8], [0, 4], [7, 4], [5, 8]],
  [[0, 3], [2, 2], [3, 3], [5, 8]],
  [[5, 4], [3, 4], [2, 4], [0, 8]],
];

function writeDegrees(
  dest: NoteEvent[],
  degrees: number[],
  bar: number,
  root: number,
  scale: number[],
  octave: number,
  dur: number,
  vel: number
) {
  degrees.forEach((deg, step) => {
    if (deg < 0) return;
    const oct = Math.floor(deg / scale.length);
    const d = ((deg % scale.length) + scale.length) % scale.length;
    dest.push(note(root + scale[d] + oct * 12 + octave, bar, step, dur, vel));
  });
}

export function composeSeededLoop(
  channel: ChannelKey,
  key: string,
  scaleName: string,
  genre: MusicGenre | string,
  complexity: 'SIMPLE' | 'COMPLEX',
  seed: number
): NoteEvent[] {
  const kit = buildGrooveKit(seed);
  const scale = theoryEngine.getScaleIntervals(scaleName);
  const root = theoryEngine.getMidiNote(`${key}1`);
  const techno = String(genre).includes('Techno') || String(genre).includes('Melodic');
  const goa = String(genre).includes('Goa');
  const complex = complexity === 'COMPLEX';
  const out: NoteEvent[] = [];
  const ch = channel.toUpperCase();

  for (let bar = 0; bar < 4; bar++) {
    if (ch.includes('KICK')) {
      kickHits(bar, kit, complex, techno).forEach((h) => out.push(note(36, bar, h.step, h.dur, h.vel)));
      continue;
    }

    if (ch.includes('SUB') || ch.includes('BASS') || ch.includes('MID')) {
      const bassRoot = ch.includes('MID') ? root + 12 : root;
      bassMap(bar, kit, complex, techno).forEach((h) => {
        out.push(note(bassRoot + h.oct * 12, bar, h.step, h.dur, h.vel));
      });
      continue;
    }

    if (ch.includes('HHCLOSED') || (ch.includes('CLOSED') && ch.includes('HH'))) {
      for (let s = 0; s < 16; s++) {
        if (!complex && s % 2 !== 0) continue;
        if (!complex && kit.hatStyle < 2 && s % 4 !== 2) continue;
        if (complex && kit.hatStyle === 0 && s % 4 === 0) continue;
        const off = s % 4 === 2;
        const extra = complex && kit.pocket[s] > 0.75 ? 0.1 : 0;
        out.push(note(42, bar, s, complex ? 40 : 55, (off ? 0.82 : 0.4 + (s % 4) * 0.06) + extra));
      }
      continue;
    }

    if (ch.includes('HHOPEN') || (ch.includes('OPEN') && ch.includes('HH'))) {
      const steps = complex
        ? (kit.hatStyle % 2 === 0 ? [2, 6, 10, 14] : [2, 5, 10, 13, 14])
        : bar % 2 === 0 ? [6, 14] : [2, 10];
      if (complex && bar === 3) steps.push(15);
      steps.forEach((s) => out.push(note(46, bar, s, 90, 0.68)));
      continue;
    }

    if (ch.includes('SNARE')) {
      if (complex && bar === 3 && kit.snareStyle >= 2) {
        const step = kit.snareStyle === 3 ? 1 : 2;
        for (let s = 8; s < 16; s += step) out.push(note(38, bar, s, 40, 0.5 + (s - 8) / 20));
      } else {
        out.push(note(38, bar, 4, 120, 0.95));
        out.push(note(38, bar, 12, 120, 0.92));
        if (complex && kit.snareStyle === 1 && bar % 2 === 1) out.push(note(38, bar, 15, 35, 0.4));
        if (complex && kit.snareStyle === 2 && bar === 2) out.push(note(38, bar, 11, 40, 0.45));
      }
      continue;
    }

    if (ch.includes('CLAP')) {
      out.push(note(39, bar, 4, 100, 0.72));
      out.push(note(39, bar, 12, 100, 0.7));
      if (complex && kit.snareStyle >= 2 && bar === 3) out.push(note(39, bar, 14, 50, 0.4));
      continue;
    }

    if (ch.includes('PERC')) {
      const tribal = ch.includes('TRIBAL');
      const simpleHits = tribal ? [1, 9] : [3, 10];
      const complexHits = tribal
        ? [[1, 7, 9, 13], [1, 3, 9, 11], [1, 6, 9, 14], [3, 7, 10, 13], [1, 5, 8, 13]][kit.percStyle]
        : [[3, 6, 10, 11, 14], [2, 7, 10, 15], [3, 5, 11, 14], [1, 6, 9, 14], [3, 6, 8, 11, 15]][kit.percStyle];
      const hits = complex ? complexHits : simpleHits;
      hits.forEach((s, i) => out.push(note((tribal ? 62 : 60) + ((kit.percStyle + i) % 4), bar, s, 65, 0.5 + (i % 2) * 0.14)));
      continue;
    }

    if (ch.includes('PAD')) {
      const voicings = [[0, 2, 4], [0, 3, 5], [0, 2, 5], [2, 4, 6]];
      const degs = voicings[kit.padStyle];
      if (!complex) {
        degs.forEach((d, i) => out.push(note(root + 24 + scale[d % scale.length] + (i === 2 ? 12 : 0), bar, 0, TICKS_BAR - 40, 0.48)));
      } else {
        degs.forEach((d, i) => out.push(note(root + 24 + scale[d % scale.length] + (i === 2 ? 12 : 0), bar, 0, bar === 3 ? 960 : TICKS_BAR - 80, 0.5 + bar * 0.04)));
        if (bar === 3) degs.forEach((d) => out.push(note(root + 36 + scale[d % scale.length], bar, 8, 880, 0.42)));
      }
      continue;
    }

    if (ch.includes('ACID')) {
      const shape = ACID_SHAPES[kit.acidStyle].slice();
      if (complex) {
        for (let s = 0; s < 16; s++) {
          if (shape[s] < 0 && kit.pocket[s] > 0.72) shape[s] = (kit.acidStyle + s) % 5;
        }
        if (bar === 2) shape.forEach((d, i) => { if (d >= 0) shape[i] = Math.min(7, d + 1); });
        if (bar === 3) shape[15] = 0;
      } else if (bar % 2 === 1) {
        shape.forEach((d, i) => { if (i % 4 === 2) shape[i] = -1; });
      }
      const oct = goa && bar >= 2 ? 24 : 12;
      writeDegrees(out, shape, bar, root, scale, oct, complex ? 48 : 70, 0.74);
      continue;
    }

    if (ch.includes('ARP')) {
      const simple = [[0, 2, 4, 2], [0, 3, 5, 3], [0, 2, 3, 5], [4, 2, 0, 2], [0, 4, 7, 4]][kit.arpStyle];
      const busy = [[0, 2, 4, 5, 4, 2, 0, 2], [0, 1, 3, 5, 3, 1, 0, 3], [0, 2, 3, 2, 5, 3, 2, 0], [5, 4, 2, 0, 2, 4, 5, 7], [0, 3, 5, 7, 5, 3, 2, 0]][kit.arpStyle];
      const cycle = complex ? busy : simple;
      const step = complex ? 1 : 2;
      for (let s = 0; s < 16; s += step) {
        const deg = cycle[(s / step) % cycle.length];
        const lift = (complex && bar === 2 && s >= 12) || (bar === 3 && s >= 8) ? 12 : 0;
        out.push(note(root + 36 + scale[deg % scale.length] + lift, bar, s, complex ? 65 : 140, 0.5 + s / 32));
      }
      continue;
    }

    if (ch.includes('SYNTH') || channel === 'ch16_synth') {
      const pocketHits = kit.pocket
        .map((v, s) => ({ v, s }))
        .filter((p) => p.v > (complex ? 0.62 : 0.88))
        .map((p) => p.s);
      switch (kit.fxStyle) {
        case 0: { // rising stabs locked to pocket
          const hits = complex ? pocketHits : pocketHits.filter((_, i) => i % 2 === 0);
          hits.forEach((s) => out.push(note(root + 48 + scale[(bar + s) % scale.length], bar, s, complex ? 50 : 160, 0.55 + bar * 0.08)));
          break;
        }
        case 1: // long FX tones that climb each bar
          out.push(note(root + 48 + scale[kit.fxStyle % scale.length] + bar * 2, bar, 0, complex ? 720 : TICKS_BAR - 60, 0.5));
          if (complex && bar === 3) out.push(note(root + 60 + scale[0], bar, 12, 360, 0.7));
          break;
        case 2: // gated 8ths
          for (let s = 0; s < 16; s += complex ? 2 : 4) {
            out.push(note(root + 48 + scale[(s / 2) % scale.length], bar, s, 70, 0.45 + (s / 32)));
          }
          break;
        case 3: // impact + tail
          if (bar === 0 || bar === 2) out.push(note(root + 55, bar, 0, 400, 0.7));
          if (complex) pocketHits.slice(0, 3).forEach((s) => out.push(note(root + 48 + scale[s % scale.length], bar, s, 40, 0.4)));
          if (bar === 3) out.push(note(root + 67, bar, 12, 280, 0.8));
          break;
        case 4: // call-response blips
          [0, 6, complex ? 10 : 8, 14].forEach((s, i) => {
            out.push(note(root + 48 + scale[(kit.fxStyle + i + bar) % scale.length], bar, s, complex ? 55 : 120, 0.58));
          });
          break;
        default: // 4-bar sweep implied by rising short notes
          for (let s = 0; s < 16; s += complex ? 1 : 4) {
            if (complex && kit.pocket[s] < 0.4 && s % 4 !== 0) continue;
            out.push(note(root + 48 + Math.min(19, bar * 5 + Math.floor(s / 4)), bar, s, 40, 0.35 + s / 40));
          }
          break;
      }
      continue;
    }

    // Leads — 4-bar story, seed picks the contour
    const arc = LEAD_ARCS[kit.leadStyle];
    const chapter = arc[bar];
    if (!complex) {
      out.push(note(root + 36 + scale[chapter[0] % scale.length], bar, 0, chapter[1] * TICKS_16 - 8, 0.7));
      const second = (chapter[0] + 2) % scale.length;
      out.push(note(root + 36 + scale[second], bar, 8, 8 * TICKS_16 - 8, 0.76));
    } else {
      const cells = bar === 2 ? [0, 3, 6, 8, 12] : bar === 3 ? [0, 2, 5, 8, 11, 12] : [0, 4, 8, 12];
      cells.forEach((s, i) => {
        const deg = (chapter[0] + i + (bar === 2 ? 2 : 0)) % (scale.length + 2);
        out.push(note(root + 36 + scale[deg % scale.length] + (bar === 2 && i > 2 ? 12 : 0), bar, s, (bar === 0 ? 3 : 2) * TICKS_16, 0.72 + i * 0.04));
      });
    }
  }

  return out;
}
