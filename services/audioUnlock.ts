const SILENCE_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

/** HTML audio ping only — never create a second AudioContext (Tone). */
export async function unlockAudio(): Promise<boolean> {
  try {
    const ping = new Audio(SILENCE_WAV);
    ping.setAttribute('playsinline', 'true');
    ping.muted = false;
    ping.volume = 0.02;
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
