import { NoteEvent, GrooveObject } from '../types';
import { ELITE_16_CHANNELS } from './maestroService';
import { theoryEngine } from './theoryEngine';
import { unlockAudio } from './audioUnlock';

const midiHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export class AudioService {
  private channelMutes: Record<string, boolean> = {};
  private nodes: AudioScheduledSourceNode[] = [];
  private ctx: AudioContext | null = null;
  private startedAt = 0;
  private playing = false;
  private playTimer: number | null = null;

  public async unlock() {
    await unlockAudio();
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.ctx || this.ctx.state === 'closed') this.ctx = new AC();
    if (this.ctx.state !== 'running') await this.ctx.resume();
    return this.ctx.state === 'running';
  }

  public async ensureInit() {
    await this.unlock();
  }

  public setBpm(_bpm: number) {}

  public setChannelMute(track: string, muted: boolean) {
    this.channelMutes[track] = muted;
  }

  public async loadCustomSample(_track: string, _file: File) {
    await this.unlock();
  }

  public countNotes(groove: GrooveObject) {
    return ELITE_16_CHANNELS.reduce((s, ch) => s + (((groove as any)[ch] || []) as NoteEvent[]).length, 0);
  }

  public isPlaying() {
    return this.playing;
  }

  public getSeconds() {
    if (!this.playing || !this.ctx) return 0;
    return Math.max(0, this.ctx.currentTime - this.startedAt);
  }

  private stopNodes() {
    this.nodes.forEach((n) => {
      try { n.stop(); } catch {}
      try { n.disconnect(); } catch {}
    });
    this.nodes = [];
    if (this.playTimer) {
      window.clearTimeout(this.playTimer);
      this.playTimer = null;
    }
    this.playing = false;
  }

  private tone(ctx: AudioContext, when: number, freq: number, dur: number, gain: number, type: OscillatorType) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.04, dur));
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + Math.max(0.05, dur) + 0.03);
    this.nodes.push(osc);
  }

  private kick(ctx: AudioContext, when: number, vel: number) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, when);
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.12);
    g.gain.setValueAtTime(Math.max(0.2, vel) * 0.9, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + 0.25);
    this.nodes.push(osc);
  }

  private noise(ctx: AudioContext, when: number, dur: number, gain: number) {
    const len = Math.max(64, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(g);
    g.connect(ctx.destination);
    src.start(when);
    src.stop(when + dur + 0.02);
    this.nodes.push(src);
  }

  public async scheduleSequence(groove: GrooveObject) {
    return this.playGroove(groove, 0);
  }

  public async play(_fromSec = 0) {
    return this.unlock();
  }

  public async playGroove(groove: GrooveObject, _fromSec = 0) {
    const ok = await this.unlock();
    if (!ok || !this.ctx) throw new Error('האודיו נעול. לחצו Play שוב.');
    this.stopNodes();

    const ctx = this.ctx;
    const bpm = groove.bpm || 145;
    const now = ctx.currentTime + 0.06;
    const tickSec = (ticks: number) => (ticks / 480) * (60 / bpm);
    const previewBars = 16;
    const maxTick = previewBars * 1920;
    let scheduled = 0;

    // Immediate confirmation click so the phone always makes a sound
    this.kick(ctx, now, 1);

    const take = (ch: string, cap: number) =>
      ((((groove as any)[ch] || []) as NoteEvent[])
        .filter((n) => (n.startTick || 0) < maxTick)
        .slice(0, cap));

    take('ch1_kick', 80).forEach((n) => {
      if (this.channelMutes.ch1_kick) return;
      this.kick(ctx, now + tickSec(n.startTick || 0), n.velocity || 0.9);
      scheduled++;
    });

    take('ch2_sub', 80).forEach((n) => {
      if (this.channelMutes.ch2_sub) return;
      const midi = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
      this.tone(ctx, now + tickSec(n.startTick || 0), midiHz(midi), Math.max(0.08, tickSec(n.durationTicks || 120)), 0.22, 'sawtooth');
      scheduled++;
    });

    take('ch3_midBass', 60).forEach((n) => {
      if (this.channelMutes.ch3_midBass) return;
      const midi = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
      this.tone(ctx, now + tickSec(n.startTick || 0), midiHz(midi), Math.max(0.07, tickSec(n.durationTicks || 120)), 0.16, 'sawtooth');
      scheduled++;
    });

    take('ch8_snare', 40).concat(take('ch9_clap', 20)).forEach((n) => {
      this.noise(ctx, now + tickSec(n.startTick || 0), 0.12, 0.18);
      scheduled++;
    });

    take('ch12_hhClosed', 80).forEach((n) => {
      if (this.channelMutes.ch12_hhClosed) return;
      this.noise(ctx, now + tickSec(n.startTick || 0), 0.04, 0.08);
      scheduled++;
    });

    take('ch4_leadA', 120).forEach((n) => {
      if (this.channelMutes.ch4_leadA) return;
      const midi = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
      this.tone(ctx, now + tickSec(n.startTick || 0), midiHz(midi), Math.max(0.1, tickSec(n.durationTicks || 160)), 0.18, 'triangle');
      scheduled++;
    });

    this.startedAt = now;
    this.playing = true;
    const length = previewBars * 4 * (60 / bpm);
    this.playTimer = window.setTimeout(() => { this.playing = false; }, length * 1000 + 200);

    return Math.max(1, scheduled);
  }

  public stop() {
    this.stopNodes();
  }

  public getSecondsSafe() {
    return this.getSeconds();
  }
}

export const audioService = new AudioService();
