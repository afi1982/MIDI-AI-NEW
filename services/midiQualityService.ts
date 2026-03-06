import { GrooveObject, ChannelKey, NoteEvent } from '../types';
import { theoryEngine } from './theoryEngine';
import { ELITE_16_CHANNELS } from './maestroService';

const TICKS_PER_16TH = 120;

type ChannelProfile = {
  quantize: number;
  velocityMin: number;
  velocityMax: number;
  tonal: boolean;
  monophonic: boolean;
  minDuration: number;
};

const DEFAULT_PROFILE: ChannelProfile = {
  quantize: TICKS_PER_16TH,
  velocityMin: 0.45,
  velocityMax: 0.95,
  tonal: true,
  monophonic: false,
  minDuration: 60
};

const CHANNEL_PROFILES: Partial<Record<ChannelKey, ChannelProfile>> = {
  ch1_kick: { quantize: 120, velocityMin: 0.88, velocityMax: 1.0, tonal: false, monophonic: true, minDuration: 90 },
  ch2_sub: { quantize: 120, velocityMin: 0.7, velocityMax: 0.95, tonal: true, monophonic: true, minDuration: 70 },
  ch3_midBass: { quantize: 120, velocityMin: 0.62, velocityMax: 0.9, tonal: true, monophonic: true, minDuration: 70 },
  ch4_leadA: { quantize: 60, velocityMin: 0.45, velocityMax: 0.92, tonal: true, monophonic: true, minDuration: 60 },
  ch5_leadB: { quantize: 60, velocityMin: 0.42, velocityMax: 0.9, tonal: true, monophonic: true, minDuration: 60 },
  ch6_arpA: { quantize: 60, velocityMin: 0.4, velocityMax: 0.85, tonal: true, monophonic: false, minDuration: 45 },
  ch7_arpB: { quantize: 60, velocityMin: 0.4, velocityMax: 0.85, tonal: true, monophonic: false, minDuration: 45 },
  ch8_snare: { quantize: 120, velocityMin: 0.72, velocityMax: 0.98, tonal: false, monophonic: true, minDuration: 80 },
  ch9_clap: { quantize: 120, velocityMin: 0.65, velocityMax: 0.95, tonal: false, monophonic: true, minDuration: 70 },
  ch10_percLoop: { quantize: 60, velocityMin: 0.42, velocityMax: 0.9, tonal: false, monophonic: false, minDuration: 40 },
  ch11_percTribal: { quantize: 60, velocityMin: 0.42, velocityMax: 0.9, tonal: false, monophonic: false, minDuration: 40 },
  ch12_hhClosed: { quantize: 60, velocityMin: 0.35, velocityMax: 0.82, tonal: false, monophonic: true, minDuration: 35 },
  ch13_hhOpen: { quantize: 60, velocityMin: 0.45, velocityMax: 0.86, tonal: false, monophonic: true, minDuration: 60 },
  ch14_acid: { quantize: 60, velocityMin: 0.4, velocityMax: 0.88, tonal: true, monophonic: true, minDuration: 50 },
  ch15_pad: { quantize: 120, velocityMin: 0.35, velocityMax: 0.78, tonal: true, monophonic: false, minDuration: 120 },
  ch16_synth: { quantize: 60, velocityMin: 0.4, velocityMax: 0.88, tonal: true, monophonic: false, minDuration: 60 }
};

const asArray = <T>(value: T | T[] | undefined): T[] => {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
};

const quantizeTick = (tick: number, grid: number) => Math.round(tick / grid) * grid;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toTick = (note: NoteEvent): number => {
  if (typeof note.startTick === 'number') return note.startTick;
  const [bar = '0', beat = '0', sixteenth = '0'] = (note.time || '0:0:0').split(':');
  return (parseInt(bar, 10) * 1920) + (parseInt(beat, 10) * 480) + (parseInt(sixteenth, 10) * 120);
};

const withTiming = (note: NoteEvent, startTick: number, durationTicks: number): NoteEvent => {
  const bar = Math.floor(startTick / 1920);
  const beat = Math.floor((startTick % 1920) / 480);
  const sixteenth = Math.floor((startTick % 480) / 120);
  return {
    ...note,
    startTick,
    durationTicks,
    time: `${bar}:${beat}:${sixteenth}`
  };
};

const sanitizeNotePitch = (note: NoteEvent, key: string, scale: string): string | string[] => {
  const snapOne = (input: string) => {
    if (!input) return input;
    const snappedMidi = theoryEngine.snapMidiToScale(theoryEngine.getMidiNote(input), key, scale);
    return theoryEngine.midiToNote(snappedMidi);
  };

  if (Array.isArray(note.note)) {
    return note.note.map(n => snapOne(n));
  }

  return snapOne((note.note as string) || 'C4');
};

const removeGhostNotes = (notes: NoteEvent[], minDurationTicks: number) => notes.filter(n => (n.durationTicks ?? 0) >= minDurationTicks);

const enforceMonophonic = (notes: NoteEvent[]): NoteEvent[] => {
  if (notes.length <= 1) return notes;
  const sorted = [...notes].sort((a, b) => toTick(a) - toTick(b));
  const cleaned: NoteEvent[] = [];

  for (const note of sorted) {
    if (!cleaned.length) {
      cleaned.push(note);
      continue;
    }

    const prev = cleaned[cleaned.length - 1];
    const prevStart = toTick(prev);
    const prevDur = prev.durationTicks ?? 120;
    const prevEnd = prevStart + prevDur;
    const currStart = toTick(note);

    if (currStart < prevEnd) {
      const overlap = prevEnd - currStart;
      const trimmedDuration = Math.max(30, prevDur - overlap);
      cleaned[cleaned.length - 1] = withTiming(prev, prevStart, trimmedDuration);
    }

    cleaned.push(note);
  }

  return cleaned;
};

const normalizeChannel = (channel: ChannelKey, notes: NoteEvent[], key: string, scale: string): NoteEvent[] => {
  const profile = CHANNEL_PROFILES[channel] || DEFAULT_PROFILE;

  const normalized = notes.map((note) => {
    const rawStart = toTick(note);
    const startTick = quantizeTick(rawStart, profile.quantize);
    const durationTicks = Math.max(profile.minDuration, quantizeTick(note.durationTicks ?? 120, Math.min(profile.quantize, 120)));
    const velocity = clamp(note.velocity ?? 0.8, profile.velocityMin, profile.velocityMax);
    const pitched = profile.tonal ? sanitizeNotePitch(note, key, scale) : (note.note || 'C3');

    return withTiming({
      ...note,
      velocity,
      note: pitched,
      duration: note.duration || '16n',
      timingOffset: 0
    }, startTick, durationTicks);
  });

  const withoutGhosts = removeGhostNotes(normalized, profile.minDuration);
  const deduped = withoutGhosts.filter((n, index, arr) => {
    if (index === 0) return true;
    const prev = arr[index - 1];
    return !(toTick(prev) === toTick(n) && JSON.stringify(prev.note) === JSON.stringify(n.note));
  });

  return profile.monophonic ? enforceMonophonic(deduped) : deduped;
};

export const midiQualityService = {
  optimizeGroove(groove: GrooveObject, options?: { forceMonophonicLead?: boolean }): GrooveObject {
    const optimized: any = { ...groove };
    const key = groove.key || 'C';
    const scale = groove.scale || 'Minor';

    ELITE_16_CHANNELS.forEach((channel) => {
      const input = asArray((groove as any)[channel]);
      let cleaned = normalizeChannel(channel, input, key, scale);

      if (options?.forceMonophonicLead && (channel === 'ch4_leadA' || channel === 'ch5_leadB')) {
        cleaned = enforceMonophonic(cleaned);
      }

      optimized[channel] = cleaned;
    });

    return optimized as GrooveObject;
  }
};
