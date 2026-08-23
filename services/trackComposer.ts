import { ArrangementSegment, ChannelKey, EnergyLevel, GrooveObject, MusicGenre, NoteEvent, SectionType } from '../types';
import { theoryEngine } from './theoryEngine';

const ELITE_16_CHANNELS: ChannelKey[] = [
  'ch1_kick', 'ch2_sub', 'ch3_midBass', 'ch4_leadA', 'ch5_leadB',
  'ch6_arpA', 'ch7_arpB', 'ch8_snare', 'ch9_clap', 'ch10_percLoop',
  'ch11_percTribal', 'ch12_hhClosed', 'ch13_hhOpen', 'ch14_acid', 'ch15_pad', 'ch16_synth'
];

const TICKS_BAR = 1920;
const TICKS_16 = 120;

type Phrase = number[]; // 16 scale-degree steps, -1 = rest

interface SectionPlan {
  type: SectionType;
  startBar: number;
  bars: number;
  energy: EnergyLevel;
  layers: ChannelKey[];
  leadMode: 'off' | 'hint' | 'theme' | 'peak' | 'break';
}

const note = (midi: number, bar: number, step: number, durTicks: number, vel: number): NoteEvent => {
  const s = ((step % 16) + 16) % 16;
  return {
    note: theoryEngine.midiToNote(midi),
    time: `${bar}:${Math.floor(s / 4)}:${s % 4}`,
    duration: 'custom',
    durationTicks: Math.max(40, durTicks),
    startTick: bar * TICKS_BAR + s * TICKS_16,
    velocity: Math.max(0.2, Math.min(1, vel)),
  };
};

const invertPhrase = (p: Phrase): Phrase => p.map((d) => (d < 0 ? -1 : Math.max(0, 7 - d)));

const sequencePhrase = (p: Phrase, shift: number): Phrase =>
  p.map((d) => (d < 0 ? -1 : Math.max(0, d + shift)));

function musicalLeadPhrases(): { A: Phrase; B: Phrase; C: Phrase } {
  const A: Phrase = [0, -1, 2, -1, 3, 2, -1, 0, 5, -1, 3, -1, 2, -1, 0, -1];
  const B: Phrase = [0, -1, 3, -1, 5, 3, -1, 2, 7, -1, 5, -1, 3, 2, 0, -1];
  const C: Phrase = [7, -1, 5, -1, 3, 5, -1, 2, 3, -1, 2, -1, 0, -1, -1, -1];
  return { A, B, C };
}

function goaLeadPhrases(): { A: Phrase; B: Phrase; C: Phrase } {
  return {
    A: [0, 1, 3, 1, 0, -1, 3, 5, 3, 1, 0, 1, 3, -1, 0, -1],
    B: [5, 3, 5, 7, 5, 3, 1, 0, 1, 3, 5, 3, 1, 0, -1, -1],
    C: [0, 1, 0, 3, 0, 5, 3, 1, 0, -1, 7, 5, 3, 1, 0, -1],
  };
}

function technoLeadPhrases(): { A: Phrase; B: Phrase; C: Phrase } {
  return {
    A: [0, -1, -1, -1, 0, -1, 3, -1, 0, -1, -1, -1, 5, -1, 3, -1],
    B: [0, -1, -1, 2, -1, -1, 0, -1, 3, -1, -1, -1, 2, -1, 0, -1],
    C: [7, -1, -1, -1, 5, -1, -1, -1, 3, -1, -1, -1, 0, -1, -1, -1],
  };
}

function phrasesForGenre(genre: string) {
  if (genre.includes('Goa')) return goaLeadPhrases();
  if (genre.includes('Techno') || genre.includes('Melodic')) return technoLeadPhrases();
  return musicalLeadPhrases();
}

function snapTo8(n: number) {
  return Math.max(64, Math.round(n / 8) * 8);
}

function planForm(totalBars: number, selected: ChannelKey[]): SectionPlan[] {
  const bars = snapTo8(totalBars);
  const has = (ch: ChannelKey) => selected.includes(ch);

  const rhythm: ChannelKey[] = ['ch1_kick', 'ch2_sub', 'ch3_midBass', 'ch12_hhClosed', 'ch13_hhOpen', 'ch10_percLoop'].filter(has) as ChannelKey[];
  const groove: ChannelKey[] = [...rhythm, 'ch8_snare', 'ch9_clap', 'ch11_percTribal'].filter(has) as ChannelKey[];
  const build: ChannelKey[] = [...groove, 'ch6_arpA', 'ch14_acid', 'ch15_pad'].filter(has) as ChannelKey[];
  const drop: ChannelKey[] = [...build, 'ch4_leadA', 'ch5_leadB', 'ch7_arpB', 'ch16_synth'].filter(has) as ChannelKey[];
  const brk: ChannelKey[] = ['ch15_pad', 'ch4_leadA', 'ch6_arpA', 'ch16_synth', 'ch13_hhOpen'].filter(has) as ChannelKey[];
  const intro: ChannelKey[] = ['ch1_kick', 'ch15_pad', 'ch12_hhClosed', 'ch10_percLoop'].filter(has) as ChannelKey[];
  const outro: ChannelKey[] = ['ch1_kick', 'ch2_sub', 'ch12_hhClosed', 'ch15_pad'].filter(has) as ChannelKey[];

  const introBars = Math.min(32, Math.max(16, Math.round(bars * 0.14 / 8) * 8));
  const grooveBars = Math.min(32, Math.max(16, Math.round(bars * 0.14 / 8) * 8));
  const build1 = 16;
  const drop1 = Math.min(48, Math.max(32, Math.round(bars * 0.22 / 8) * 8));
  const breakBars = 16;
  const build2 = 16;
  const drop2 = Math.min(40, Math.max(24, Math.round(bars * 0.16 / 8) * 8));
  const used = introBars + grooveBars + build1 + drop1 + breakBars + build2 + drop2;
  const outroBars = Math.max(16, bars - used);

  const sections: SectionPlan[] = [
    { type: SectionType.INTRO, startBar: 0, bars: introBars, energy: EnergyLevel.LOW, layers: intro, leadMode: 'off' },
    { type: SectionType.MELODY_INTRO, startBar: introBars, bars: grooveBars, energy: EnergyLevel.MED, layers: groove, leadMode: 'hint' },
    { type: SectionType.BUILDUP, startBar: introBars + grooveBars, bars: build1, energy: EnergyLevel.HIGH, layers: build, leadMode: 'hint' },
    { type: SectionType.DROP, startBar: introBars + grooveBars + build1, bars: drop1, energy: EnergyLevel.PEAK, layers: drop, leadMode: 'theme' },
    { type: SectionType.BREAKDOWN, startBar: introBars + grooveBars + build1 + drop1, bars: breakBars, energy: EnergyLevel.LOW, layers: brk, leadMode: 'break' },
    { type: SectionType.BUILDUP, startBar: introBars + grooveBars + build1 + drop1 + breakBars, bars: build2, energy: EnergyLevel.HIGH, layers: build, leadMode: 'hint' },
    { type: SectionType.DROP, startBar: introBars + grooveBars + build1 + drop1 + breakBars + build2, bars: drop2, energy: EnergyLevel.PEAK, layers: drop, leadMode: 'peak' },
    { type: SectionType.OUTRO, startBar: introBars + grooveBars + build1 + drop1 + breakBars + build2 + drop2, bars: outroBars, energy: EnergyLevel.LOW, layers: outro, leadMode: 'off' },
  ];
  return sections;
}

function writePhrase(
  dest: NoteEvent[],
  phrase: Phrase,
  bar: number,
  rootMidi: number,
  scale: number[],
  octaveAdd: number,
  dur: number,
  vel: number
) {
  phrase.forEach((deg, step) => {
    if (deg < 0) return;
    const octave = Math.floor(deg / scale.length);
    const degree = ((deg % scale.length) + scale.length) % scale.length;
    const midi = rootMidi + scale[degree] + octave * 12 + octaveAdd;
    dest.push(note(midi, bar, step, dur, vel));
  });
}

function kickPattern(bar: number, energy: EnergyLevel, lastBarsOfBuild: boolean): NoteEvent[] {
  const out: NoteEvent[] = [];
  const kickMidi = 24; // C1
  for (let s = 0; s < 16; s += 4) {
    out.push(note(kickMidi, bar, s, 140, energy >= EnergyLevel.PEAK ? 1 : 0.92));
  }
  if (lastBarsOfBuild) {
    out.push(note(kickMidi, bar, 14, 60, 0.55));
  }
  return out;
}

function psyBass(bar: number, root: number, octave: number, vary: boolean): NoteEvent[] {
  const out: NoteEvent[] = [];
  const base = root + octave * 12;
  for (let beat = 0; beat < 4; beat++) {
    const s0 = beat * 4;
    // Kick occupies slot 0. Classic rolling 16ths: _ x x X
    out.push(note(base, bar, s0 + 1, 70, 0.86));
    if (!(vary && beat === 3)) out.push(note(base, bar, s0 + 2, 70, 0.8));
    out.push(note(base + (vary && beat % 2 === 1 ? 12 : 0), bar, s0 + 3, 55, 0.9));
  }
  return out;
}

function technoBass(bar: number, root: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  const base = root + 12;
  [2, 6, 10, 14].forEach((s, i) => out.push(note(base, bar, s, 160, i % 2 === 0 ? 0.88 : 0.78)));
  return out;
}

function hatsClosed(bar: number, energy: EnergyLevel): NoteEvent[] {
  const out: NoteEvent[] = [];
  const midi = 42;
  const dense = energy >= EnergyLevel.HIGH;
  for (let s = 0; s < 16; s++) {
    if (!dense && s % 2 !== 0) continue;
    const off = s % 4 === 2;
    out.push(note(midi, bar, s, 50, off ? 0.78 : 0.48 + (s % 4) * 0.04));
  }
  return out;
}

function hatsOpen(bar: number): NoteEvent[] {
  return [2, 6, 10, 14].map((s) => note(46, bar, s, 90, 0.7));
}

function snareBackbeat(bar: number): NoteEvent[] {
  return [4, 12].map((s) => note(38, bar, s, 120, 0.95));
}

function snareRoll(bar: number, intensity: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  const step = intensity > 0.7 ? 1 : 2;
  for (let s = 0; s < 16; s += step) {
    out.push(note(38, bar, s, step === 1 ? 50 : 80, 0.55 + (s / 16) * 0.4));
  }
  return out;
}

function percLoop(bar: number, seed: number): NoteEvent[] {
  const hits = [3, 6, 10, 11, 14];
  return hits.map((s, i) => note(60 + ((seed + i) % 5), bar, s, 70, 0.55 + (i % 2) * 0.12));
}

function tribalPerc(bar: number): NoteEvent[] {
  return [1, 7, 9, 13].map((s, i) => note(62 + (i % 3), bar, s, 65, 0.5));
}

function padChord(bar: number, root: number, scale: number[], energy: EnergyLevel): NoteEvent[] {
  const degrees = [0, 2, 4];
  return degrees.map((d, i) =>
    note(root + 24 + scale[d % scale.length] + (i === 2 ? 12 : 0), bar, 0, TICKS_BAR - 40, energy === EnergyLevel.LOW ? 0.45 : 0.58)
  );
}

function arpPattern(bar: number, root: number, scale: number[], phrase: Phrase): NoteEvent[] {
  const out: NoteEvent[] = [];
  const cycle = [0, 2, 4, 2];
  for (let s = 0; s < 16; s += 2) {
    const deg = cycle[(s / 2) % cycle.length];
    const lift = phrase[s] >= 5 ? 12 : 0;
    out.push(note(root + 36 + scale[deg % scale.length] + lift, bar, s, 90, 0.62));
  }
  return out;
}

function acidLine(bar: number, root: number, scale: number[], peak: boolean): NoteEvent[] {
  const out: NoteEvent[] = [];
  const shape = peak
    ? [0, 0, 1, 0, 3, 0, 1, 0, 0, 3, 1, 0, 4, 0, 1, 0]
    : [0, -1, 0, 1, 0, -1, 0, 0, 1, -1, 0, 3, 0, -1, 0, 1];
  shape.forEach((deg, s) => {
    if (deg < 0) return;
    out.push(note(root + 12 + scale[deg % scale.length], bar, s, 55, 0.72));
  });
  return out;
}

function clap(bar: number): NoteEvent[] {
  return [4, 12].map((s) => note(39, bar, s, 100, 0.7));
}

export function composeProfessionalTrack(
  params: { bpm?: number; key?: string; scale?: string; genre?: MusicGenre | string; trackName?: string },
  trackLengthMinutes: number,
  selectedChannels: ChannelKey[]
): GrooveObject {
  const bpm = params.bpm || 145;
  const key = params.key || 'F#';
  const scaleName = params.scale || 'Phrygian';
  const genre = (params.genre as string) || MusicGenre.PSYTRANCE_FULLON;
  const selected = selectedChannels.length ? selectedChannels : [...ELITE_16_CHANNELS];
  const rawBars = Math.ceil((trackLengthMinutes * bpm) / 4);
  const sections = planForm(rawBars, selected);
  const totalBars = sections[sections.length - 1].startBar + sections[sections.length - 1].bars;

  const scale = theoryEngine.getScaleIntervals(scaleName);
  const root = theoryEngine.getMidiNote(`${key}1`);
  const phrases = phrasesForGenre(genre);
  const isTechno = genre.includes('Techno') || genre.includes('Melodic');

  const groove: any = {
    id: `GEN-${Date.now()}`,
    name: params.trackName || `${genre} · ${key} ${scaleName}`,
    bpm,
    key,
    scale: scaleName,
    genre,
    totalBars,
    structureMap: sections.map((s) => ({
      type: s.type,
      startBar: s.startBar,
      durationBars: s.bars,
      energy: s.energy,
      activeInstruments: s.layers,
    })) as ArrangementSegment[],
    meta: {
      architecture: 'Phrase Arrangement V2',
      engineEnhanced: true,
      fidelityRate: 100,
    },
  };
  ELITE_16_CHANNELS.forEach((ch) => { groove[ch] = [] as NoteEvent[]; });

  const themeCycle = [phrases.A, phrases.A, phrases.B, phrases.A];
  const peakCycle = [phrases.B, sequencePhrase(phrases.B, 1), phrases.C, phrases.A];
  const breakCycle = [phrases.C, invertPhrase(phrases.A)];

  for (const section of sections) {
    for (let i = 0; i < section.bars; i++) {
      const bar = section.startBar + i;
      const phraseIndex = Math.floor(i / 2) % 4;
      const inLastFour = i >= section.bars - 4;
      const inLastTwo = i >= section.bars - 2;
      const layers = new Set(section.layers);

      if (layers.has('ch1_kick')) {
        groove.ch1_kick.push(...kickPattern(bar, section.energy, section.type === SectionType.BUILDUP && inLastFour));
      }
      if (layers.has('ch2_sub')) {
        groove.ch2_sub.push(...(isTechno ? technoBass(bar, root) : psyBass(bar, root, 0, i % 4 === 3)));
      }
      if (layers.has('ch3_midBass')) {
        groove.ch3_midBass.push(...(isTechno ? technoBass(bar, root + 12) : psyBass(bar, root, 1, i % 8 === 7)));
      }
      if (layers.has('ch12_hhClosed')) groove.ch12_hhClosed.push(...hatsClosed(bar, section.energy));
      if (layers.has('ch13_hhOpen') && section.energy >= EnergyLevel.MED) groove.ch13_hhOpen.push(...hatsOpen(bar));
      if (layers.has('ch8_snare')) {
        if (section.type === SectionType.BUILDUP && inLastFour) {
          groove.ch8_snare.push(...snareRoll(bar, inLastTwo ? 1 : 0.5));
        } else if (section.energy >= EnergyLevel.MED) {
          groove.ch8_snare.push(...snareBackbeat(bar));
        }
      }
      if (layers.has('ch9_clap') && section.energy >= EnergyLevel.MED) groove.ch9_clap.push(...clap(bar));
      if (layers.has('ch10_percLoop') && section.energy >= EnergyLevel.MED) groove.ch10_percLoop.push(...percLoop(bar, i));
      if (layers.has('ch11_percTribal') && section.energy >= EnergyLevel.HIGH) groove.ch11_percTribal.push(...tribalPerc(bar));
      if (layers.has('ch15_pad')) groove.ch15_pad.push(...padChord(bar, root, scale, section.energy));

      let leadPhrase: Phrase | null = null;
      if (section.leadMode === 'theme') leadPhrase = themeCycle[phraseIndex];
      if (section.leadMode === 'peak') leadPhrase = peakCycle[phraseIndex];
      if (section.leadMode === 'break') leadPhrase = breakCycle[i % 2];
      if (section.leadMode === 'hint' && i % 8 >= 4) leadPhrase = phrases.A;

      if (leadPhrase && layers.has('ch4_leadA')) {
        const legato = section.leadMode === 'break';
        writePhrase(groove.ch4_leadA, leadPhrase, bar, root, scale, 36, legato ? 220 : 130, section.leadMode === 'peak' ? 0.92 : 0.82);
      }
      if (leadPhrase && layers.has('ch5_leadB') && (section.leadMode === 'theme' || section.leadMode === 'peak')) {
        const harmony = leadPhrase.map((d) => (d < 0 ? -1 : d + 2));
        writePhrase(groove.ch5_leadB, harmony, bar, root, scale, 36, 110, 0.62);
      }
      if (layers.has('ch6_arpA') && section.energy >= EnergyLevel.HIGH) {
        groove.ch6_arpA.push(...arpPattern(bar, root, scale, leadPhrase || phrases.A));
      }
      if (layers.has('ch7_arpB') && section.leadMode === 'peak') {
        groove.ch7_arpB.push(...arpPattern(bar, root + 7, scale, phrases.B));
      }
      if (layers.has('ch14_acid') && (section.energy >= EnergyLevel.HIGH || section.leadMode === 'peak')) {
        groove.ch14_acid.push(...acidLine(bar, root, scale, section.leadMode === 'peak'));
      }
      if (layers.has('ch16_synth') && (section.leadMode === 'break' || section.leadMode === 'peak')) {
        writePhrase(groove.ch16_synth, phrases.C, bar, root, scale, 48, 80, 0.55);
      }
    }
  }

  return groove as GrooveObject;
}

export function composeMusicalLoop(
  channel: ChannelKey,
  bpm: number,
  key: string,
  scaleName: string,
  genre: MusicGenre | string,
  complexity: 'SIMPLE' | 'COMPLEX'
): NoteEvent[] {
  const scale = theoryEngine.getScaleIntervals(scaleName);
  const root = theoryEngine.getMidiNote(`${key}1`);
  const phrases = phrasesForGenre(String(genre));
  const isTechno = String(genre).includes('Techno') || String(genre).includes('Melodic');
  const out: NoteEvent[] = [];
  const r = channel.toUpperCase();

  for (let bar = 0; bar < 4; bar++) {
    if (r.includes('KICK')) out.push(...kickPattern(bar, EnergyLevel.PEAK, false));
    else if (r.includes('SUB')) out.push(...(isTechno ? technoBass(bar, root) : psyBass(bar, root, 0, bar === 3)));
    else if (r.includes('BASS') || r.includes('MID')) out.push(...(isTechno ? technoBass(bar, root + 12) : psyBass(bar, root, 1, bar === 3)));
    else if (r.includes('HHCLOSED') || r.includes('CLOSED')) out.push(...hatsClosed(bar, complexity === 'COMPLEX' ? EnergyLevel.HIGH : EnergyLevel.MED));
    else if (r.includes('HHOPEN') || r.includes('OPEN')) out.push(...hatsOpen(bar));
    else if (r.includes('SNARE')) out.push(...snareBackbeat(bar));
    else if (r.includes('CLAP')) out.push(...clap(bar));
    else if (r.includes('PERC') && r.includes('TRIBAL')) out.push(...tribalPerc(bar));
    else if (r.includes('PERC')) out.push(...percLoop(bar, bar));
    else if (r.includes('PAD')) out.push(...padChord(bar, root, scale, EnergyLevel.MED));
    else if (r.includes('ACID')) out.push(...acidLine(bar, root, scale, complexity === 'COMPLEX'));
    else if (r.includes('ARP')) out.push(...arpPattern(bar, root, scale, phrases.A));
    else {
      const cycle = [phrases.A, phrases.A, phrases.B, phrases.C];
      writePhrase(out, cycle[bar], bar, root, scale, r.includes('LEADB') ? 36 : 36, complexity === 'SIMPLE' ? 200 : 130, 0.85);
      if (r.includes('LEADB')) {
        writePhrase(out, cycle[bar].map((d) => (d < 0 ? -1 : d + 2)), bar, root, scale, 36, 110, 0.6);
      }
    }
  }
  return out;
}
