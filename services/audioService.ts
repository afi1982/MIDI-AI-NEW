import * as Tone from 'tone';
import { NoteEvent, GrooveObject } from '../types';
import { ELITE_16_CHANNELS } from './maestroService';
import { resetTransport, unlockAudio } from './audioUnlock';

type Voice = {
  hit: (note: string, dur: number, time: number, vel: number) => void;
  dispose: () => void;
};

export class AudioService {
  private voices: Voice[] = [];
  private part: Tone.Part | null = null;
  private channelMutes: Record<string, boolean> = {};

  public async unlock() {
    return unlockAudio();
  }

  public async ensureInit() {
    await unlockAudio();
  }

  public setBpm(bpm: number) {
    Tone.Transport.bpm.value = Math.max(60, Math.min(200, bpm || 145));
  }

  public setChannelMute(track: string, muted: boolean) {
    this.channelMutes[track] = muted;
  }

  public async loadCustomSample(_track: string, _file: File) {
    await unlockAudio();
  }

  private disposeVoices() {
    this.voices.forEach((v) => { try { v.dispose(); } catch {} });
    this.voices = [];
  }

  private clearPart() {
    if (this.part) {
      try { this.part.stop(); } catch {}
      try { this.part.dispose(); } catch {}
      this.part = null;
    }
  }

  private makeVoices() {
    this.disposeVoices();
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.1 },
    }).toDestination();
    kick.volume.value = -2;

    const bass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.005, decay: 0.12, sustain: 0.2, release: 0.08 },
      filterEnvelope: { attack: 0.001, decay: 0.07, sustain: 0.12, baseFrequency: 90, octaves: 2 },
    }).toDestination();
    bass.volume.value = -7;

    const drums = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.03 },
    }).toDestination();
    drums.volume.value = -11;

    const lead = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.14, sustain: 0.28, release: 0.12 },
    }).toDestination();
    lead.volume.value = -5;

    const kickV: Voice = {
      hit: (_n, _d, time, vel) => kick.triggerAttackRelease('C1', 0.2, time, vel),
      dispose: () => { try { kick.dispose(); } catch {} },
    };
    const bassV: Voice = {
      hit: (n, d, time, vel) => bass.triggerAttackRelease(n, Math.max(0.06, d), time, vel),
      dispose: () => { try { bass.dispose(); } catch {} },
    };
    const drumV: Voice = {
      hit: (_n, d, time, vel) => drums.triggerAttackRelease(Math.min(0.16, Math.max(0.04, d)), time, vel),
      dispose: () => { try { drums.dispose(); } catch {} },
    };
    const leadV: Voice = {
      hit: (n, d, time, vel) => lead.triggerAttackRelease(n, Math.max(0.07, d), time, vel),
      dispose: () => { try { lead.dispose(); } catch {} },
    };
    this.voices = [kickV, bassV, drumV, leadV];
    return { kickV, bassV, drumV, leadV };
  }

  private voiceFor(track: string, bank: ReturnType<AudioService['makeVoices']>) {
    if (track === 'ch1_kick') return bank.kickV;
    if (track.includes('sub') || track.includes('bass')) return bank.bassV;
    if (track.includes('hh') || track.includes('snare') || track.includes('clap') || track.includes('perc')) return bank.drumV;
    return bank.leadV;
  }

  public countNotes(groove: GrooveObject) {
    return ELITE_16_CHANNELS.reduce((s, ch) => s + (((groove as any)[ch] || []) as NoteEvent[]).length, 0);
  }

  public async scheduleSequence(groove: GrooveObject) {
    return this.armGroove(groove);
  }

  public async armGroove(groove: GrooveObject) {
    await unlockAudio();
    this.clearPart();
    this.disposeVoices();
    const bpm = groove.bpm || 145;
    this.setBpm(bpm);
    const tickToSec = (ticks: number) => (ticks / 480) * (60 / bpm);
    const bank = this.makeVoices();
    const events: { time: number; track: string; note: string; dur: number; vel: number }[] = [];

    ELITE_16_CHANNELS.forEach((track) => {
      const notes = ((groove as any)[track] as NoteEvent[]) || [];
      notes.slice(0, 2500).forEach((n) => {
        const note = Array.isArray(n.note) ? n.note[0] : n.note;
        if (!note) return;
        events.push({
          time: tickToSec(n.startTick || 0),
          track,
          note,
          dur: Math.max(0.05, tickToSec(n.durationTicks || 120)),
          vel: Math.max(0.35, Math.min(1, n.velocity || 0.8)),
        });
      });
    });

    if (!events.length) throw new Error('אין תווים להשמעה. ייבאו MIDI או פתחו את התוצאה מהמשימות.');

    this.part = new Tone.Part((time, ev) => {
      if (this.channelMutes[ev.track]) return;
      try { this.voiceFor(ev.track, bank).hit(ev.note, ev.dur, time, ev.vel); } catch {}
    }, events);
    this.part.start(0);
    return events.length;
  }

  public async play(fromSec = 0) {
    await unlockAudio();
    try { Tone.Transport.stop(); } catch {}
    Tone.Transport.seconds = Math.max(0, fromSec);
    Tone.Transport.start('+0.05');
  }

  public async playGroove(groove: GrooveObject, fromSec = 0) {
    const count = await this.armGroove(groove);
    await this.play(fromSec);
    return count;
  }

  public stop() {
    this.clearPart();
    this.disposeVoices();
    resetTransport();
  }
}

export const audioService = new AudioService();
