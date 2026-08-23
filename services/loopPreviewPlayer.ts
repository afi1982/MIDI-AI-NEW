import * as Tone from 'tone';
import { ChannelKey, NoteEvent } from '../types';

const SILENCE_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

type Voice = {
  trigger: (note: string, duration: string, time: number, velocity: number) => void;
  dispose: () => void;
};

let voice: Voice | null = null;
let voiceChannel: ChannelKey | null = null;
let part: Tone.Part | null = null;
let unlocked = false;

function noteName(note: NoteEvent['note']): string {
  if (Array.isArray(note)) return note[0];
  return note || 'C4';
}

function noteTime(note: NoteEvent): string {
  if (note.time && typeof note.time === 'string') return note.time;
  const tick = note.startTick || 0;
  const bar = Math.floor(tick / 1920);
  const quarter = Math.floor((tick % 1920) / 480);
  const sixteenth = Math.floor((tick % 480) / 120);
  return `${bar}:${quarter}:${sixteenth}`;
}

async function unlockFromGesture() {
  try {
    const ping = new Audio(SILENCE_WAV);
    ping.setAttribute('playsinline', 'true');
    ping.volume = 0.01;
    await ping.play().catch(() => undefined);
  } catch {}
  await Tone.start();
  if (Tone.context.state !== 'running') await Tone.context.resume();
  unlocked = Tone.context.state === 'running';
  return unlocked;
}

function disposeVoice() {
  if (voice) {
    try { voice.dispose(); } catch {}
    voice = null;
    voiceChannel = null;
  }
}

function makeVoice(channel: ChannelKey): Voice {
  const nodes: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(n: T): T => {
    nodes.push(n);
    return n;
  };

  const kick = () => {
    const synth = track(new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.38, sustain: 0, release: 0.15 },
    }).toDestination());
    synth.volume.value = -2;
    return {
      trigger: (_note: string, _d: string, time: number, vel: number) => {
        synth.triggerAttackRelease('C1', '8n', time, vel);
      },
      dispose: () => nodes.forEach((n) => { try { n.dispose(); } catch {} }),
    };
  };

  const bass = (octave: 'sub' | 'mid') => {
    const synth = track(new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { Q: 2, type: 'lowpass', rolloff: -24 },
      envelope: { attack: 0.005, decay: 0.12, sustain: 0.2, release: 0.08 },
      filterEnvelope: { attack: 0.001, decay: 0.08, sustain: 0.15, baseFrequency: octave === 'sub' ? 80 : 160, octaves: 2.2 },
    }).toDestination());
    synth.volume.value = octave === 'sub' ? -6 : -8;
    return {
      trigger: (note: string, d: string, time: number, vel: number) => {
        synth.triggerAttackRelease(note, d, time, vel);
      },
      dispose: () => nodes.forEach((n) => { try { n.dispose(); } catch {} }),
    };
  };

  const noiseHit = (decay: number, vol: number) => {
    const synth = track(new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay, sustain: 0, release: 0.04 },
    }).toDestination());
    synth.volume.value = vol;
    return {
      trigger: (_n: string, _d: string, time: number, vel: number) => {
        synth.triggerAttackRelease(decay > 0.15 ? '16n' : '32n', time, vel);
      },
      dispose: () => nodes.forEach((n) => { try { n.dispose(); } catch {} }),
    };
  };

  const metal = () => {
    const synth = track(new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.08, release: 0.02 },
      harmonicity: 5.1,
      modulationIndex: 24,
      resonance: 3000,
      octaves: 1.2,
    }).toDestination());
    synth.volume.value = -14;
    return {
      trigger: (_n: string, _d: string, time: number, vel: number) => {
        synth.triggerAttackRelease('32n', time, vel);
      },
      dispose: () => nodes.forEach((n) => { try { n.dispose(); } catch {} }),
    };
  };

  const lead = (kind: 'hero' | 'support' | 'arp' | 'acid' | 'pad' | 'fx') => {
    const type = kind === 'pad' ? 'sine' : kind === 'acid' ? 'sawtooth' : kind === 'arp' ? 'square' : 'sawtooth';
    const env = kind === 'pad'
      ? { attack: 0.2, decay: 0.3, sustain: 0.7, release: 0.8 }
      : kind === 'acid'
        ? { attack: 0.005, decay: 0.08, sustain: 0.15, release: 0.06 }
        : { attack: 0.012, decay: 0.14, sustain: 0.28, release: 0.16 };
    const synth = track(new Tone.PolySynth(Tone.Synth, {
      oscillator: { type },
      envelope: env,
    }).toDestination());
    synth.volume.value = kind === 'pad' ? -10 : kind === 'support' ? -8 : -5;
    return {
      trigger: (note: string, d: string, time: number, vel: number) => {
        const dur = kind === 'pad' ? '2n' : d;
        synth.triggerAttackRelease(note, dur, time, vel);
      },
      dispose: () => nodes.forEach((n) => { try { n.dispose(); } catch {} }),
    };
  };

  if (channel === 'ch1_kick') return kick();
  if (channel === 'ch2_sub') return bass('sub');
  if (channel === 'ch3_midBass') return bass('mid');
  if (channel === 'ch8_snare' || channel === 'ch9_clap') return noiseHit(0.18, -8);
  if (channel === 'ch12_hhClosed') return metal();
  if (channel === 'ch13_hhOpen') return noiseHit(0.22, -12);
  if (channel === 'ch10_percLoop' || channel === 'ch11_percTribal') return noiseHit(0.1, -10);
  if (channel === 'ch4_leadA') return lead('hero');
  if (channel === 'ch5_leadB') return lead('support');
  if (channel.includes('arp')) return lead('arp');
  if (channel === 'ch14_acid') return lead('acid');
  if (channel === 'ch15_pad') return lead('pad');
  return lead('fx');
}

function getVoice(channel: ChannelKey) {
  if (voice && voiceChannel === channel) return voice;
  disposeVoice();
  voice = makeVoice(channel);
  voiceChannel = channel;
  return voice;
}

function clearPart() {
  if (part) {
    try { part.stop(); } catch {}
    try { part.dispose(); } catch {}
    part = null;
  }
}

export const loopPreviewPlayer = {
  async unlock() {
    return unlockFromGesture();
  },

  isUnlocked() {
    return unlocked && Tone.context.state === 'running';
  },

  contextState() {
    return Tone.context.state;
  },

  stop() {
    clearPart();
    try {
      Tone.Transport.stop();
      Tone.Transport.position = 0;
    } catch {}
  },

  async play(notes: NoteEvent[], bpm: number, channel: ChannelKey = 'ch4_leadA') {
    const ok = await unlockFromGesture();
    if (!ok) throw new Error('Audio is locked. Tap Play again.');

    this.stop();
    const current = getVoice(channel);
    Tone.Transport.bpm.value = bpm;

    const events = notes
      .map((n) => ({
        time: noteTime(n),
        note: noteName(n.note),
        velocity: Math.max(0.35, Math.min(1, n.velocity || 0.85)),
        duration: !n.durationTicks ? '16n' : n.durationTicks > 700 ? '2n' : n.durationTicks > 400 ? '4n' : n.durationTicks > 180 ? '8n' : '16n',
      }))
      .filter((e) => !!e.note);

    if (events.length === 0) throw new Error('This loop has no notes to play.');

    part = new Tone.Part((time, value) => {
      try {
        current.trigger(value.note, value.duration, time, value.velocity);
      } catch {}
    }, events);

    part.loop = true;
    part.loopEnd = '4m';
    part.start(0);
    Tone.Transport.start('+0.02');
    return events.length;
  },
};
