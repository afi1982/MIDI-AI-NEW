import { ArrangementSegment, ChannelKey, EnergyLevel, GrooveObject, MusicGenre, NoteEvent, SectionType } from '../types';
import { composeSeededLoop, makeSession, STYLE_BPM, applyPumpLock, emptyDest, writeStyleBar, styleOf } from './styleSyncEngine';

const ELITE_16_CHANNELS: ChannelKey[] = [
  'ch1_kick', 'ch2_sub', 'ch3_midBass', 'ch4_leadA', 'ch5_leadB',
  'ch6_arpA', 'ch7_arpB', 'ch8_snare', 'ch9_clap', 'ch10_percLoop',
  'ch11_percTribal', 'ch12_hhClosed', 'ch13_hhOpen', 'ch14_acid', 'ch15_pad', 'ch16_synth'
];

interface SectionPlan {
  type: SectionType;
  startBar: number;
  bars: number;
  energy: EnergyLevel;
  layers: ChannelKey[];
}

function snapTo8(n: number) {
  return Math.max(64, Math.round(n / 8) * 8);
}

function planForm(totalBars: number, selected: ChannelKey[], style: string): SectionPlan[] {
  const bars = snapTo8(totalBars);
  const has = (ch: ChannelKey) => selected.includes(ch);
  const techno = style === 'techno' || style === 'melodic';

  const intro: ChannelKey[] = (techno
    ? ['ch1_kick', 'ch12_hhClosed', 'ch15_pad']
    : ['ch1_kick', 'ch15_pad', 'ch12_hhClosed', 'ch10_percLoop']).filter(has) as ChannelKey[];
  const groove: ChannelKey[] = ['ch1_kick', 'ch2_sub', 'ch3_midBass', 'ch12_hhClosed', 'ch13_hhOpen', 'ch8_snare', 'ch9_clap', 'ch10_percLoop'].filter(has) as ChannelKey[];
  const build: ChannelKey[] = [...groove, 'ch6_arpA', 'ch14_acid', 'ch15_pad', 'ch11_percTribal'].filter(has) as ChannelKey[];
  const drop: ChannelKey[] = [...build, 'ch4_leadA', 'ch5_leadB', 'ch7_arpB', 'ch16_synth'].filter(has) as ChannelKey[];
  const brk: ChannelKey[] = (techno
    ? ['ch15_pad', 'ch4_leadA', 'ch16_synth']
    : ['ch15_pad', 'ch4_leadA', 'ch6_arpA', 'ch16_synth', 'ch13_hhOpen']).filter(has) as ChannelKey[];
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

  return [
    { type: SectionType.INTRO, startBar: 0, bars: introBars, energy: EnergyLevel.LOW, layers: intro },
    { type: SectionType.MELODY_INTRO, startBar: introBars, bars: grooveBars, energy: EnergyLevel.MED, layers: groove },
    { type: SectionType.BUILDUP, startBar: introBars + grooveBars, bars: build1, energy: EnergyLevel.HIGH, layers: build },
    { type: SectionType.DROP, startBar: introBars + grooveBars + build1, bars: drop1, energy: EnergyLevel.PEAK, layers: drop },
    { type: SectionType.BREAKDOWN, startBar: introBars + grooveBars + build1 + drop1, bars: breakBars, energy: EnergyLevel.LOW, layers: brk },
    { type: SectionType.BUILDUP, startBar: introBars + grooveBars + build1 + drop1 + breakBars, bars: build2, energy: EnergyLevel.HIGH, layers: build },
    { type: SectionType.DROP, startBar: introBars + grooveBars + build1 + drop1 + breakBars + build2, bars: drop2, energy: EnergyLevel.PEAK, layers: drop },
    { type: SectionType.OUTRO, startBar: introBars + grooveBars + build1 + drop1 + breakBars + build2 + drop2, bars: outroBars, energy: EnergyLevel.LOW, layers: outro },
  ];
}

export function composeProfessionalTrack(
  params: { bpm?: number; key?: string; scale?: string; genre?: MusicGenre | string; trackName?: string },
  trackLengthMinutes: number,
  selectedChannels: ChannelKey[]
): GrooveObject {
  const genre = (params.genre as string) || MusicGenre.PSYTRANCE_FULLON;
  const style = styleOf(genre);
  const bpm = params.bpm || STYLE_BPM[style];
  const key = params.key || 'F#';
  const scaleName = params.scale || 'Phrygian';
  const selected = selectedChannels.length ? selectedChannels : [...ELITE_16_CHANNELS];
  const rawBars = Math.ceil((trackLengthMinutes * bpm) / 4);
  const sections = planForm(rawBars, selected, style);
  const totalBars = sections[sections.length - 1].startBar + sections[sections.length - 1].bars;
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9) ^ bpm * 97) >>> 0;
  const session = makeSession(seed, genre, key, scaleName, true);
  const dest = emptyDest();

  for (const section of sections) {
    const layers = new Set(section.layers);
    for (let i = 0; i < section.bars; i++) {
      writeStyleBar(session, section.startBar + i, dest, layers, section.energy);
    }
    applyPumpLock(dest, session, section.startBar, section.bars);
  }

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
      architecture: 'Style-synced pump arrangement',
      style,
      seed,
      engineEnhanced: true,
      fidelityRate: 100,
    },
    ...dest,
  };
  return groove as GrooveObject;
}

export function composeMusicalLoop(
  channel: ChannelKey,
  _bpm: number,
  key: string,
  scaleName: string,
  genre: MusicGenre | string,
  complexity: 'SIMPLE' | 'COMPLEX',
  seed = 1
): NoteEvent[] {
  return composeSeededLoop(channel, key, scaleName, genre, complexity, seed);
}
