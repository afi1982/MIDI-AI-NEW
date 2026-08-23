
import * as Tone from 'tone';
import { NoteEvent, GrooveObject } from '../types';
import { ELITE_16_CHANNELS } from './maestroService';

export class AudioService {
  private samplers: Record<string, any> = {}; 
  private channelGains: Record<string, Tone.Gain> = {};
  private filters: Record<string, Tone.Filter> = {};
  private parts: Record<string, Tone.Part | null> = {}; 
  private masterGain: Tone.Gain | null = null;
  private initialized = false;
  private channelMutes: Record<string, boolean> = {};

  public async ensureInit() {
    if (this.initialized) {
        if (Tone.context.state !== 'running') {
            await Tone.start();
            await Tone.context.resume();
        }
        return;
    }

    await Tone.start();
    Tone.Transport.PPQ = 480;
    
    const limiter = new Tone.Limiter(-1).toDestination();
    const compressor = new Tone.Compressor({
        threshold: -24,
        ratio: 3,
        attack: 0.01,
        release: 0.2
    });

    this.masterGain = new Tone.Gain(0.5); 
    this.masterGain.chain(compressor, limiter);

    ELITE_16_CHANNELS.forEach(key => {
        this.channelMutes[key] = false;
        const filter = new Tone.Filter(20000, "lowpass").connect(this.masterGain!);
        this.filters[key] = filter;
        const gain = new Tone.Gain(0.5).connect(filter); 
        this.channelGains[key] = gain;
        this.samplers[key] = this.createDefaultSynth(key).connect(gain);
        this.parts[key] = null;
    });

    this.initialized = true;
    console.log("🔊 Pro Audio Engine Initialized");
  }

  private createDefaultSynth(key: string) {
    if (key === 'ch1_kick') {
      return new Tone.MembraneSynth({ volume: -6 });
    }
    if (key.includes('sub') || key.includes('bass')) {
      return new Tone.PolySynth(Tone.Synth, { 
        volume: -10, 
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.5, release: 0.1 }
      });
    }
    if (key.includes('hh') || key.includes('snare') || key.includes('clap')) {
      return new Tone.NoiseSynth({ volume: -15 });
    }
    return new Tone.PolySynth(Tone.Synth, { volume: -12, oscillator: { type: 'triangle' } });
  }

  public async loadCustomSample(track: string, file: File) {
    await this.ensureInit();
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
        
        this.disposeChannelSynth(track);

        return new Promise<void>((resolve, reject) => {
            const sampler = new Tone.Sampler({
                urls: { "C4": audioBuffer },
                onload: () => {
                    if (sampler.disposed) return;
                    sampler.connect(this.channelGains[track]);
                    this.samplers[track] = sampler;
                    resolve();
                },
                onerror: (err) => reject(err)
            });
        });
    } catch (e) {
        throw e;
    }
  }

  private disposeChannelSynth(track: string) {
    if (this.samplers[track]) {
        const old = this.samplers[track];
        this.samplers[track] = null; 
        if (old && !old.disposed) {
            try { 
                if (typeof old.releaseAll === 'function') old.releaseAll(); 
                old.dispose();
            } catch(e) {}
        }
    }
  }

  public setBpm(bpm: number) {
      Tone.Transport.bpm.rampTo(bpm, 0.1);
  }

  public setChannelMute(track: string, muted: boolean) {
      this.channelMutes[track] = muted;
      if (this.channelGains[track]) {
          this.channelGains[track].gain.rampTo(muted ? 0 : 0.5, 0.1);
      }
  }

  public async scheduleSequence(groove: GrooveObject) {
      await this.ensureInit();
      this.clearAllParts();

      // Tick-based scheduling ("...i") depends on the transport resolution.
      if (Tone.Transport.PPQ !== 480) Tone.Transport.PPQ = 480;

      let scheduled = 0;

      ELITE_16_CHANNELS.forEach(trackName => {
          const events = (groove as any)[trackName] as NoteEvent[];
          if (!events || !Array.isArray(events) || events.length === 0) return;

          const sortedEvents = [...events].sort((a, b) => (a.startTick || 0) - (b.startTick || 0));

          const part = new Tone.Part((time, event) => {
              const synth = this.samplers[trackName];
              // CRITICAL: Defensive check to prevent triggers on disposed nodes
              if (synth && !synth.disposed && typeof synth.triggerAttackRelease === 'function' && !this.channelMutes[trackName]) {
                  const vel = Math.min(1, Math.max(0.2, event.velocity || 0.7));

                  // Duration resolution: never emit "undefinedi" (that throws and silences the note)
                  let dur: any = "16n";
                  if (event.durationTicks && event.durationTicks > 0) {
                      dur = Math.max(30, event.durationTicks) + "i";
                  } else if (event.duration && event.duration !== 'custom') {
                      dur = event.duration;
                  }

                  const note = Array.isArray(event.note) ? event.note[0] : event.note;

                  try {
                    // NoiseSynth has the signature (duration, time, velocity) - no pitch argument
                    if (synth instanceof Tone.NoiseSynth) {
                        synth.triggerAttackRelease(dur, time, vel);
                    } else {
                        // Using time parameter is crucial for scheduled precision
                        synth.triggerAttackRelease(note, dur, time, vel);
                    }
                  } catch (e) {
                      console.warn(`[AudioEngine] trigger failed on ${trackName}`, e, event);
                  }
              }
          }, sortedEvents.map(e => ({ ...e, time: (e.startTick || 0) + "i" })));

          part.start(0);
          this.parts[trackName] = part;
          scheduled += sortedEvents.length;
      });

      console.log(`🎹 Scheduled ${scheduled} notes across ${Object.values(this.parts).filter(Boolean).length} channels`);
  }

  public play() {
      Tone.Transport.start();
  }

  public stop() {
      Tone.Transport.stop();
  }

  private clearAllParts() {
      ELITE_16_CHANNELS.forEach(k => {
          if (this.parts[k]) {
              const part = this.parts[k];
              this.parts[k] = null; 
              if (part && !part.disposed) {
                  try {
                    part.stop();
                    part.dispose();
                  } catch(e) {}
              }
          }
      });
  }
}

export const audioService = new AudioService();
