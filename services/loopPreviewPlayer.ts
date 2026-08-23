import * as Tone from 'tone';
import { NoteEvent } from '../types';

const SILENCE_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let synth: Tone.PolySynth | null = null;
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
    ping.muted = false;
    ping.volume = 0.01;
    await ping.play().catch(() => undefined);
  } catch {}

  await Tone.start();
  if (Tone.context.state !== 'running') {
    await Tone.context.resume();
  }
  unlocked = Tone.context.state === 'running';
  return unlocked;
}

function getSynth() {
  if (synth && !synth.disposed) return synth;
  synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.12, sustain: 0.25, release: 0.18 },
  });
  synth.volume.value = -4;
  synth.toDestination();
  return synth;
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

  async play(notes: NoteEvent[], bpm: number) {
    const ok = await unlockFromGesture();
    if (!ok) {
      throw new Error('Audio is locked. Tap Play again.');
    }

    this.stop();

    const voice = getSynth();
    Tone.Transport.bpm.value = bpm;

    const events = notes
      .map((n) => ({
        time: noteTime(n),
        note: noteName(n.note),
        velocity: Math.max(0.4, Math.min(1, n.velocity || 0.85)),
      }))
      .filter((e) => !!e.note);

    if (events.length === 0) {
      throw new Error('This loop has no notes to play.');
    }

    part = new Tone.Part((time, value) => {
      try {
        voice.triggerAttackRelease(value.note, '16n', time, value.velocity);
      } catch {}
    }, events);

    part.loop = true;
    part.loopEnd = '4m';
    part.start(0);
    Tone.Transport.start('+0.02');
    return events.length;
  },
};
