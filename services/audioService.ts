import { NoteEvent, GrooveObject } from '../types';
import { ELITE_16_CHANNELS } from './maestroService';
import { theoryEngine } from './theoryEngine';
import { unlockAudio } from './audioUnlock';

const midiHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

type Queued = { t: number; kind: 'kick' | 'bass' | 'drum' | 'lead' | 'hat'; freq: number; dur: number; vel: number };

export class AudioService {
  private channelMutes: Record<string, boolean> = {};
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioScheduledSourceNode[] = [];
  private queue: Queued[] = [];
  private cursor = 0;
  private playing = false;
  private startedAt = 0;
  private offset = 0;
  private timer: number | null = null;
  private loopPattern: Queued[] = [];
  private loopLen = 0;
  private nextLoopAt = 0;
  private mode: 'off' | 'loop' | 'song' = 'off';

  public async unlock() {
    await unlockAudio();
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    return this.ctx.state === 'running';
  }

  public async ensureInit() { await this.unlock(); }
  public setBpm(_bpm: number) {}
  public setChannelMute(track: string, muted: boolean) { this.channelMutes[track] = muted; }
  public async loadCustomSample(_t: string, _f: File) { await this.unlock(); }

  public countNotes(groove: GrooveObject) {
    return ELITE_16_CHANNELS.reduce((s, ch) => s + (((groove as any)[ch] || []) as NoteEvent[]).length, 0);
  }

  public isPlaying() { return this.playing; }

  public getSeconds() {
    if (!this.playing || !this.ctx) return this.offset;
    return this.offset + Math.max(0, this.ctx.currentTime - this.startedAt);
  }

  private killSources() {
    this.nodes.forEach((n) => { try { n.stop(); } catch {} try { n.disconnect(); } catch {} });
    this.nodes = [];
  }

  private stopClock() {
    if (this.timer) { window.clearInterval(this.timer); this.timer = null; }
    this.playing = false;
    this.mode = 'off';
    this.queue = [];
    this.cursor = 0;
    this.loopPattern = [];
  }

  public stop() {
    this.offset = this.getSeconds();
    this.killSources();
    this.stopClock();
  }

  private dest() {
    return this.master || this.ctx!.destination;
  }

  private fireKick(when: number, vel: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(48, when + 0.11);
    g.gain.setValueAtTime(Math.max(0.15, vel) * 0.85, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
    osc.connect(g); g.connect(this.dest());
    osc.start(when); osc.stop(when + 0.22);
    this.nodes.push(osc);
  }

  private fireTone(when: number, freq: number, dur: number, gain: number, type: OscillatorType) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, freq), when);
    const d = Math.max(0.05, dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.002, gain), when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + d);
    osc.connect(g); g.connect(this.dest());
    osc.start(when); osc.stop(when + d + 0.03);
    this.nodes.push(osc);
  }

  private fireNoise(when: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const len = Math.max(64, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(Math.max(0.002, gain), when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(g); g.connect(this.dest());
    src.start(when); src.stop(when + dur + 0.02);
    this.nodes.push(src);
  }

  private emit(ev: Queued, when: number) {
    if (when < (this.ctx?.currentTime || 0) - 0.02) return;
    if (ev.kind === 'kick') this.fireKick(when, ev.vel);
    else if (ev.kind === 'drum') this.fireNoise(when, 0.11, 0.16 * ev.vel);
    else if (ev.kind === 'hat') this.fireNoise(when, 0.035, 0.08 * ev.vel);
    else if (ev.kind === 'bass') this.fireTone(when, ev.freq, ev.dur, 0.2 * ev.vel, 'sawtooth');
    else this.fireTone(when, ev.freq, ev.dur, 0.2 * ev.vel, 'triangle');
  }

  private enqueueLoop() {
    if (this.mode !== 'loop' || !this.loopPattern.length) return;
    const horizon = this.getSeconds() + 1.2;
    while (this.nextLoopAt < horizon) {
      this.loopPattern.forEach((ev) => {
        this.queue.push({ ...ev, t: this.nextLoopAt + ev.t });
      });
      this.nextLoopAt += this.loopLen;
    }
    this.queue.sort((a, b) => a.t - b.t);
  }

  private tick() {
    if (!this.playing || !this.ctx) return;
    if (this.ctx.state !== 'running') void this.ctx.resume();
    if (this.mode === 'loop') this.enqueueLoop();
    const nowSong = this.getSeconds();
    const horizon = nowSong + 0.45;
    while (this.cursor < this.queue.length && this.queue[this.cursor].t <= horizon) {
      const ev = this.queue[this.cursor++];
      this.emit(ev, this.startedAt + (ev.t - this.offset));
    }
    if (this.mode === 'song' && this.cursor >= this.queue.length && nowSong > (this.queue[this.queue.length - 1]?.t || 0) + 0.4) {
      this.playing = false;
      this.stopClock();
    }
  }

  private startClock() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 40);
    this.tick();
  }

  private noteKind(ch: string): Queued['kind'] {
    if (ch.includes('kick')) return 'kick';
    if (ch.includes('sub') || ch.includes('bass')) return 'bass';
    if (ch.includes('hh') || ch.includes('hat')) return 'hat';
    if (ch.includes('snare') || ch.includes('clap') || ch.includes('perc')) return 'drum';
    return 'lead';
  }

  private toQueued(n: NoteEvent, bpm: number, ch: string): Queued {
    const midi = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note || 'C4');
    return {
      t: ((n.startTick || 0) / 480) * (60 / bpm),
      kind: this.noteKind(ch),
      freq: midiHz(midi),
      dur: Math.max(0.06, ((n.durationTicks || 160) / 480) * (60 / bpm)),
      vel: Math.max(0.35, Math.min(1, n.velocity || 0.85)),
    };
  }

  public async playLoop(notes: NoteEvent[], bpm: number, channel: string) {
    const ok = await this.unlock();
    if (!ok || !this.ctx) throw new Error('האודיו נעול. לחצו Play שוב.');
    this.killSources();
    this.stopClock();
    const tempo = Math.max(80, Math.min(180, bpm || 145));
    this.loopLen = 16 * (60 / tempo); // 4 bars
    this.loopPattern = notes.map((n) => this.toQueued(n, tempo, channel));
    if (!this.loopPattern.length) throw new Error('אין תווים בלולאה.');
    this.mode = 'loop';
    this.queue = [];
    this.cursor = 0;
    this.offset = 0;
    this.nextLoopAt = 0;
    this.startedAt = this.ctx.currentTime + 0.04;
    this.playing = true;
    this.fireKick(this.startedAt, 0.7);
    this.startClock();
    return this.loopPattern.length;
  }

  public async playGroove(groove: GrooveObject, fromSec = 0) {
    const ok = await this.unlock();
    if (!ok || !this.ctx) throw new Error('האודיו נעול. לחצו Play שוב.');
    this.killSources();
    this.stopClock();
    const bpm = groove.bpm || 145;
    const events: Queued[] = [];
    ELITE_16_CHANNELS.forEach((ch) => {
      if (this.channelMutes[ch]) return;
      const notes = ((groove as any)[ch] || []) as NoteEvent[];
      notes.forEach((n) => events.push(this.toQueued(n, bpm, ch)));
    });
    events.sort((a, b) => a.t - b.t);
    if (!events.length) throw new Error('אין תווים להשמעה.');
    this.mode = 'song';
    this.queue = events;
    this.offset = Math.max(0, fromSec);
    this.cursor = this.queue.findIndex((e) => e.t >= this.offset);
    if (this.cursor < 0) this.cursor = this.queue.length;
    this.startedAt = this.ctx.currentTime + 0.04;
    this.playing = true;
    this.fireKick(this.startedAt, 0.7);
    this.startClock();
    return events.length;
  }

  public async seek(seconds: number) {
    if (this.mode !== 'song' || !this.queue.length) {
      this.offset = seconds;
      return;
    }
    const grooveTime = Math.max(0, seconds);
    this.killSources();
    this.offset = grooveTime;
    this.cursor = this.queue.findIndex((e) => e.t >= grooveTime);
    if (this.cursor < 0) this.cursor = this.queue.length;
    if (this.ctx) this.startedAt = this.ctx.currentTime;
    this.playing = true;
    if (!this.timer) this.startClock();
  }

  public async scheduleSequence(groove: GrooveObject) {
    return this.playGroove(groove, 0);
  }

  public async play(_from = 0) { return this.unlock(); }
}

export const audioService = new AudioService();
