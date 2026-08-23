import * as Tone from 'tone';
import { ChannelKey, NoteEvent } from '../types';
import { resetTransport, unlockAudio } from './audioUnlock';

type Voice = {
  trigger: (note: string, duration: number, time: number, velocity: number) => void;
  dispose: () => void;
};

let voice: Voice | null = null;
let part: Tone.Part | null = null;

function noteName(note: NoteEvent['note']): string {
  if (Array.isArray(note)) return note[0];
  return note || 'C4';
}

function disposeVoice() {
  if (voice) {
    try { voice.dispose(); } catch {}
    voice = null;
  }
}

function makeVoice(channel: ChannelKey): Voice {
  const nodes: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(n: T): T => {
    nodes.push(n);
    return n;
  };
  const dest = () => nodes.forEach((n) => { try { n.dispose(); } catch {} });

  if (channel === 'ch1_kick') {
    const synth = track(new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.12 },
    }).toDestination());
    synth.volume.value = -1;
    return {
      trigger: (_n, _d, time, vel) => synth.triggerAttackRelease('C1', 0.22, time, vel),
      dispose: dest,
    };
  }

  if (channel === 'ch2_sub' || channel === 'ch3_midBass') {
    const synth = track(new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.005, decay: 0.12, sustain: 0.18, release: 0.08 },
      filterEnvelope: { attack: 0.001, decay: 0.08, sustain: 0.12, baseFrequency: channel === 'ch2_sub' ? 80 : 180, octaves: 2 },
    }).toDestination());
    synth.volume.value = -6;
    return {
      trigger: (note, d, time, vel) => synth.triggerAttackRelease(note, Math.max(0.06, d), time, vel),
      dispose: dest,
    };
  }

  if (channel.includes('hh') || channel.includes('snare') || channel.includes('clap') || channel.includes('perc')) {
    const synth = track(new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: channel.includes('hh') ? 0.05 : 0.16, sustain: 0, release: 0.03 },
    }).toDestination());
    synth.volume.value = -10;
    return {
      trigger: (_n, d, time, vel) => synth.triggerAttackRelease(Math.min(0.18, Math.max(0.04, d)), time, vel),
      dispose: dest,
    };
  }

  const kind = channel.includes('pad') ? 'pad' : channel.includes('acid') ? 'acid' : 'lead';
  const synth = track(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: kind === 'pad' ? 'sine' : 'sawtooth' },
    envelope: kind === 'pad'
      ? { attack: 0.12, decay: 0.2, sustain: 0.6, release: 0.4 }
      : { attack: 0.008, decay: 0.12, sustain: 0.25, release: 0.12 },
  }).toDestination());
  synth.volume.value = kind === 'pad' ? -8 : -4;
  return {
    trigger: (note, d, time, vel) => synth.triggerAttackRelease(note, kind === 'pad' ? 0.8 : Math.max(0.07, d), time, vel),
    dispose: dest,
  };
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
    return unlockAudio();
  },

  isUnlocked() {
    return Tone.context.state === 'running';
  },

  contextState() {
    return Tone.context.state;
  },

  stop() {
    clearPart();
    disposeVoice();
    resetTransport();
  },

  async play(notes: NoteEvent[], bpm: number, channel: ChannelKey = 'ch4_leadA') {
    await unlockAudio();
    this.stop();
    await unlockAudio();

    const tempo = Math.max(80, Math.min(180, bpm || 145));
    Tone.Transport.bpm.value = tempo;
    const tickToSec = (ticks: number) => (ticks / 480) * (60 / tempo);

    const events = notes
      .map((n) => ({
        time: tickToSec(n.startTick || 0),
        note: noteName(n.note),
        velocity: Math.max(0.4, Math.min(1, n.velocity || 0.85)),
        duration: Math.max(0.05, tickToSec(n.durationTicks || 120)),
      }))
      .filter((e) => !!e.note && Number.isFinite(e.time));

    if (!events.length) throw new Error('אין תווים בלולאה הזו.');

    const current = makeVoice(channel);
    voice = current;

    part = new Tone.Part((time, value) => {
      try { current.trigger(value.note, value.duration, time, value.velocity); } catch {}
    }, events);
    part.loop = true;
    part.loopEnd = 4 * (60 / tempo) * 4;
    part.start(0);
    Tone.Transport.start('+0.05');
    return events.length;
  },
};
