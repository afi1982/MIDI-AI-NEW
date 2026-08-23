import * as Tone from 'tone';

const SILENCE_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export async function unlockAudio(): Promise<boolean> {
  try {
    const ping = new Audio(SILENCE_WAV);
    ping.setAttribute('playsinline', 'true');
    ping.volume = 0.01;
    await ping.play().catch(() => undefined);
  } catch {}
  try {
    await Tone.start();
    if (Tone.context.state !== 'running') await Tone.context.resume();
  } catch {}
  return Tone.context.state !== 'closed';
}

const stopHooks: Array<() => void> = [];

export function onAudioReset(hook: () => void) {
  stopHooks.push(hook);
  return () => {
    const i = stopHooks.indexOf(hook);
    if (i >= 0) stopHooks.splice(i, 1);
  };
}

export function resetTransport() {
  stopHooks.forEach((fn) => { try { fn(); } catch {} });
  try { Tone.Transport.cancel(0); } catch {}
  try { Tone.Transport.stop(); } catch {}
  try { Tone.Transport.position = 0; } catch {}
  try { Tone.Transport.seconds = 0; } catch {}
}
