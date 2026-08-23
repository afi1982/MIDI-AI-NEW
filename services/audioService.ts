import * as Tone from 'tone';
import { NoteEvent, GrooveObject } from '../types';
import { ELITE_16_CHANNELS } from './maestroService';
import { loopPreviewPlayer } from './loopPreviewPlayer';

const SILENCE_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export class AudioService {
  private samplers: Record<string, any> = {};
  private channelGains: Record<string, Tone.Gain> = {};
  private filters: Record<string, Tone.Filter> = {};
  private parts: Record<string, Tone.Part | null> = {};
  private masterGain: Tone.Gain | null = null;
  private initialized = false;
  private channelMutes: Record<string, boolean> = {};

  public async unlock() {
    try {
      const ping = new Audio(SILENCE_WAV);
      ping.setAttribute('playsinline', 'true');
      ping.volume = 0.01;
      await ping.play().catch(() => undefined);
    } catch {}
    try { await loopPreviewPlayer.unlock(); } catch {}
    await Tone.start();
    if (Tone.context.state !== 'running') await Tone.context.resume();
    return Tone.context.state === 'running';
  }

  public async ensureInit() {
    const ok = await this.unlock();
    if (!ok) throw new Error('Audio is locked. Tap Play again.');
    if (this.initialized) return;

    Tone.Transport.PPQ = 480;

    const limiter = new Tone.Limiter(-1).toDestination();
    const compressor = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.01, release: 0.2 });
    this.masterGain = new Tone.Gain(0.7);
    this.masterGain.chain(compressor, limiter);

    ELITE_16_CHANNELS.forEach((key) => {
      this.channelMutes[key] = false;
      const filter = new Tone.Filter(18000, 'lowpass').connect(this.masterGain!);
      this.filters[key] = filter;
      const gain = new Tone.Gain(0.7).connect(filter);
      this.channelGains[key] = gain;
      this.samplers[key] = this.createDefaultSynth(key).connect(gain);
      this.parts[key] = null;
    });

    this.initialized = true;
  }

  private createDefaultSynth(key: string) {
    if (key === 'ch1_kick') {
      return new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.38, sustain: 0, release: 0.12 },
        volume: -4,
      });
    }
    if (key.includes('sub') || key.includes('bass')) {
      return new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.005, decay: 0.14, sustain: 0.2, release: 0.08 },
        filterEnvelope: { attack: 0.001, decay: 0.08, sustain: 0.15, baseFrequency: key.includes('sub') ? 80 : 160, octaves: 2.2 },
        volume: -8,
      });
    }
    if (key.includes('hh') || key.includes('snare') || key.includes('clap') || key.includes('perc')) {
      return new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: key.includes('hh') ? 0.06 : 0.16, sustain: 0, release: 0.04 },
        volume: -12,
      });
    }
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: key.includes('pad') ? 'sine' : 'sawtooth' },
      envelope: key.includes('pad')
        ? { attack: 0.18, decay: 0.3, sustain: 0.65, release: 0.6 }
        : { attack: 0.01, decay: 0.14, sustain: 0.28, release: 0.14 },
      volume: -7,
    });
  }

  public async loadCustomSample(track: string, file: File) {
    await this.ensureInit();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
    this.disposeChannelSynth(track);
    return new Promise<void>((resolve, reject) => {
      const sampler = new Tone.Sampler({
        urls: { C4: audioBuffer },
        onload: () => {
          if (sampler.disposed) return;
          sampler.connect(this.channelGains[track]);
          this.samplers[track] = sampler;
          resolve();
        },
        onerror: (err) => reject(err),
      });
    });
  }

  private disposeChannelSynth(track: string) {
    if (this.samplers[track]) {
      const old = this.samplers[track];
      this.samplers[track] = null;
      if (old && !old.disposed) {
        try {
          if (typeof old.releaseAll === 'function') old.releaseAll();
          old.dispose();
        } catch {}
      }
    }
  }

  public setBpm(bpm: number) {
    Tone.Transport.bpm.value = Math.max(60, Math.min(200, bpm || 145));
  }

  public setChannelMute(track: string, muted: boolean) {
    this.channelMutes[track] = muted;
    if (this.channelGains[track]) this.channelGains[track].gain.rampTo(muted ? 0 : 0.7, 0.08);
  }

  public async scheduleSequence(groove: GrooveObject) {
    await this.ensureInit();
    this.clearAllParts();
    const bpm = groove.bpm || 145;
    this.setBpm(bpm);
    const tickToSec = (ticks: number) => (ticks / 480) * (60 / bpm);
    let scheduled = 0;

    ELITE_16_CHANNELS.forEach((trackName) => {
      const events = ((groove as any)[trackName] as NoteEvent[]) || [];
      if (!events.length) return;
      const synth = this.samplers[trackName];
      if (!synth) return;
      const isNoise = typeof synth.noise !== 'undefined' || synth.name === 'NoiseSynth' || synth.name === 'MetalSynth';
      const isKick = trackName === 'ch1_kick';

      const mapped = events.slice(0, 4000).map((e) => ({
        time: tickToSec(e.startTick || 0),
        note: Array.isArray(e.note) ? e.note[0] : (e.note || 'C4'),
        dur: Math.max(0.04, tickToSec(e.durationTicks || 120)),
        vel: Math.max(0.3, Math.min(1, e.velocity || 0.8)),
      })).filter((e) => Number.isFinite(e.time) && e.note);

      if (!mapped.length) return;
      scheduled += mapped.length;

      const part = new Tone.Part((time, event) => {
        if (!synth || synth.disposed || this.channelMutes[trackName]) return;
        try {
          if (isKick) synth.triggerAttackRelease('C1', Math.min(0.28, event.dur), time, event.vel);
          else if (isNoise) synth.triggerAttackRelease(Math.min(0.2, event.dur), time, event.vel);
          else synth.triggerAttackRelease(event.note, event.dur, time, event.vel);
        } catch {}
      }, mapped);

      part.start(0);
      this.parts[trackName] = part;
    });

    if (!scheduled) throw new Error('אין תווים להשמעה בקובץ הזה.');
    return scheduled;
  }

  public async play(fromSec = 0) {
    await this.ensureInit();
    try { Tone.Transport.stop(); } catch {}
    Tone.Transport.seconds = Math.max(0, fromSec);
    Tone.Transport.start('+0.04');
  }

  public stop() {
    try { Tone.Transport.stop(); } catch {}
    Tone.Transport.position = 0;
    ELITE_16_CHANNELS.forEach((k) => {
      const synth = this.samplers[k];
      try { if (synth && typeof synth.releaseAll === 'function') synth.releaseAll(); } catch {}
    });
  }

  private clearAllParts() {
    ELITE_16_CHANNELS.forEach((k) => {
      if (this.parts[k]) {
        const part = this.parts[k];
        this.parts[k] = null;
        if (part && !part.disposed) {
          try { part.stop(); part.dispose(); } catch {}
        }
      }
    });
  }
}

export const audioService = new AudioService();
