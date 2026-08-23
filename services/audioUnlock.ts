const SILENCE_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

/**
 * Unlock Web Audio on phones without starting a second (Tone.js) AudioContext.
 * Two live contexts on Android Chrome steal the speaker and the next Play is silent.
 */
export async function unlockAudio(): Promise<boolean> {
  try {
    const ping = new Audio(SILENCE_WAV);
    ping.setAttribute('playsinline', 'true');
    ping.muted = false;
    ping.volume = 0.01;
    await ping.play().catch(() => undefined);
  } catch {}
  return true;
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
}
