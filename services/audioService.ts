import { NoteEvent, GrooveObject } from '../types';
import { ELITE_16_CHANNELS } from './maestroService';
import { theoryEngine } from './theoryEngine';
import { unlockAudio } from './audioUnlock';

const midiHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

type Voice =
  | 'kick' | 'sub' | 'bass' | 'lead' | 'leadB' | 'acid'
  | 'arp' | 'pad' | 'hat' | 'drum' | 'perc' | 'fx';

type StyleId = 'goa' | 'fullon' | 'power' | 'melodic' | 'techno';

type Queued = { t: number; voice: Voice; freq: number; dur: number; vel: number };

const LOOKAHEAD = 0.4;

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
  private raf = 0;
  private loopPattern: Queued[] = [];
  private loopLen = 0;
  private nextLoopAt = 0;
  private mode: 'off' | 'loop' | 'song' = 'off';
  private style: StyleId = 'fullon';
  private noiseBuf: AudioBuffer | null = null;

  /** Must run inside the tap — no await before this. */
  public arm() {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return false;
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.95;
      this.master.connect(this.ctx.destination);
      this.noiseBuf = null;
    }
    if (this.ctx.state === 'suspended') {
      try { void this.ctx.resume(); } catch {}
    }
    return true;
  }

  public async unlock() {
    this.arm();
    try { await unlockAudio(); } catch {}
    if (this.ctx && this.ctx.state !== 'running') {
      try { await this.ctx.resume(); } catch {}
    }
    return !!this.ctx;
  }

  public async ensureInit() { await this.unlock(); }
  public setBpm(_bpm: number) {}
  public setChannelMute(track: string, muted: boolean) { this.channelMutes[track] = muted; }
  public async loadCustomSample(_t: string, _f: File) { await this.unlock(); }
  public getMode() { return this.mode; }

  public countNotes(groove: GrooveObject) {
    return ELITE_16_CHANNELS.reduce((s, ch) => s + (((groove as any)[ch] || []) as NoteEvent[]).length, 0);
  }

  public isPlaying() { return this.playing; }

  public getSeconds() {
    if (!this.playing || !this.ctx) return this.offset;
    return this.offset + Math.max(0, this.ctx.currentTime - this.startedAt);
  }

  private dest() {
    return this.master || this.ctx!.destination;
  }

  private noise() {
    if (this.noiseBuf && this.ctx && this.noiseBuf.sampleRate === this.ctx.sampleRate) return this.noiseBuf;
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    return buf;
  }

  private track(node: AudioScheduledSourceNode) {
    this.nodes.push(node);
    node.onended = () => {
      const i = this.nodes.indexOf(node);
      if (i >= 0) this.nodes.splice(i, 1);
      try { node.disconnect(); } catch {}
    };
  }

  private killSources() {
    this.nodes.forEach((n) => { try { n.stop(); } catch {} try { n.disconnect(); } catch {} });
    this.nodes = [];
  }

  private stopClock() {
    if (this.timer) { window.clearInterval(this.timer); this.timer = null; }
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
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

  private env(g: GainNode, when: number, peak: number, attack: number, dur: number) {
    const d = Math.max(0.05, dur);
    const a = Math.max(0.004, attack);
    try { g.gain.cancelScheduledValues(when); } catch {}
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(Math.max(0.01, peak), when + a);
    g.gain.linearRampToValueAtTime(0, when + d);
  }

  private fireKick(when: number, vel: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    const startF = this.style === 'techno' ? 210 : this.style === 'goa' ? 175 : this.style === 'power' ? 130 : this.style === 'melodic' ? 118 : 160;
    const endF = this.style === 'power' ? 40 : this.style === 'melodic' ? 52 : 47;
    const body = this.style === 'melodic' ? 0.32 : this.style === 'power' ? 0.28 : 0.22;
    osc.frequency.setValueAtTime(startF, when);
    osc.frequency.linearRampToValueAtTime(endF, when + (this.style === 'techno' ? 0.07 : 0.1));
    this.env(g, when, Math.max(0.25, vel) * 0.95, 0.004, body);
    osc.connect(g); g.connect(this.dest());
    osc.start(when); osc.stop(when + body + 0.03);
    this.track(osc);
  }

  private fireSub(when: number, freq: number, dur: number, vel: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(Math.max(28, freq), when);
    this.env(g, when, 0.4 * vel, 0.008, Math.max(0.09, dur));
    osc.connect(g); g.connect(this.dest());
    osc.start(when); osc.stop(when + Math.max(0.09, dur) + 0.03);
    this.track(osc);
  }

  private fireBass(when: number, freq: number, dur: number, vel: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = this.style === 'power' || this.style === 'techno' ? 'square' : this.style === 'melodic' ? 'sine' : 'sawtooth';
    const d = this.style === 'goa' ? Math.min(0.09, dur) : this.style === 'melodic' ? Math.max(0.18, dur) : Math.max(0.07, dur * 0.9);
    osc.frequency.setValueAtTime(Math.max(36, freq), when);
    this.env(g, when, (this.style === 'power' ? 0.3 : 0.24) * vel, 0.006, d);
    osc.connect(g); g.connect(this.dest());
    osc.start(when); osc.stop(when + d + 0.03);
    this.track(osc);
  }

  private fireLead(when: number, freq: number, dur: number, vel: number, twin: boolean) {
    const ctx = this.ctx!;
    const d = this.style === 'goa' ? Math.min(0.12, Math.max(0.05, dur))
      : this.style === 'techno' ? Math.min(0.14, Math.max(0.06, dur))
      : this.style === 'melodic' ? Math.max(0.22, dur)
      : Math.max(0.08, dur);
    const peak = (twin ? 0.18 : 0.22) * vel;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = this.style === 'goa' ? 'square' : this.style === 'melodic' ? 'triangle' : this.style === 'power' ? 'sawtooth' : twin ? 'sawtooth' : 'square';
    const f0 = Math.max(80, this.style === 'power' ? freq * 0.75 : freq);
    osc.frequency.setValueAtTime(f0, when);
    this.env(g, when, peak, this.style === 'melodic' ? 0.04 : 0.01, d);
    osc.connect(g); g.connect(this.dest());
    osc.start(when); osc.stop(when + d + 0.04);
    this.track(osc);
  }

  private fireAcid(when: number, freq: number, dur: number, vel: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const d = Math.max(0.06, Math.min(0.28, dur));
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(Math.max(55, freq * 0.7), when);
    osc.frequency.linearRampToValueAtTime(Math.max(55, freq), when + 0.03);
    this.env(g, when, 0.22 * vel, 0.004, d);
    osc.connect(g); g.connect(this.dest());
    osc.start(when); osc.stop(when + d + 0.04);
    this.track(osc);
  }

  private fireArp(when: number, freq: number, dur: number, vel: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(Math.max(90, freq), when);
    this.env(g, when, 0.13 * vel, 0.004, Math.min(0.16, Math.max(0.05, dur)));
    osc.connect(g); g.connect(this.dest());
    osc.start(when); osc.stop(when + Math.min(0.18, dur) + 0.03);
    this.track(osc);
  }

  private firePad(when: number, freq: number, dur: number, vel: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(Math.max(80, freq), when);
    this.env(g, when, 0.1 * vel, 0.06, Math.max(0.3, dur));
    osc.connect(g); g.connect(this.dest());
    osc.start(when); osc.stop(when + Math.max(0.3, dur) + 0.04);
    this.track(osc);
  }

  private fireFx(when: number, freq: number, dur: number, vel: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(Math.max(200, freq), when);
    this.env(g, when, 0.12 * vel, 0.02, Math.max(0.12, dur));
    osc.connect(g); g.connect(this.dest());
    osc.start(when); osc.stop(when + Math.max(0.14, dur) + 0.03);
    this.track(osc);
  }

  private fireNoise(when: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = this.noise();
    this.env(g, when, Math.max(0.01, gain), 0.002, Math.max(0.03, dur));
    src.connect(g); g.connect(this.dest());
    src.start(when); src.stop(when + Math.max(0.03, dur) + 0.02);
    this.track(src);
  }

  private emit(ev: Queued, when: number) {
    if (!this.ctx) return;
    const t = Math.max(when, this.ctx.currentTime);
    try {
      switch (ev.voice) {
        case 'kick': this.fireKick(t, ev.vel); break;
        case 'sub': this.fireSub(t, ev.freq, ev.dur, ev.vel); break;
        case 'bass': this.fireBass(t, ev.freq, ev.dur, ev.vel); break;
        case 'lead': this.fireLead(t, ev.freq, ev.dur, ev.vel, true); break;
        case 'leadB': this.fireLead(t, ev.freq, ev.dur, ev.vel, false); break;
        case 'acid': this.fireAcid(t, ev.freq, ev.dur, ev.vel); break;
        case 'arp': this.fireArp(t, ev.freq, ev.dur, ev.vel); break;
        case 'pad': this.firePad(t, ev.freq, ev.dur, ev.vel); break;
        case 'fx': this.fireFx(t, ev.freq, ev.dur, ev.vel); break;
        case 'hat': this.fireNoise(t, 0.035, 0.09 * ev.vel); break;
        case 'drum': this.fireNoise(t, 0.1, 0.18 * ev.vel); break;
        default: this.fireNoise(t, 0.06, 0.12 * ev.vel); break;
      }
    } catch {}
  }

  private enqueueLoop() {
    if (this.mode !== 'loop' || !this.loopPattern.length) return;
    if (this.cursor > 64) {
      this.queue = this.queue.slice(this.cursor);
      this.cursor = 0;
    }
    const horizon = this.getSeconds() + 1.1;
    while (this.nextLoopAt < horizon) {
      this.loopPattern.forEach((ev) => this.queue.push({ ...ev, t: this.nextLoopAt + ev.t }));
      this.nextLoopAt += this.loopLen;
    }
  }

  private tick() {
    if (!this.playing || !this.ctx) return;
    if (this.ctx.state !== 'running') void this.ctx.resume();
    if (this.mode === 'loop') this.enqueueLoop();
    const nowSong = this.getSeconds();
    const horizon = nowSong + LOOKAHEAD;
    let fired = 0;
    while (this.cursor < this.queue.length && this.queue[this.cursor].t <= horizon && fired < 24) {
      const ev = this.queue[this.cursor++];
      this.emit(ev, this.startedAt + (ev.t - this.offset));
      fired++;
    }
    if (this.mode === 'song' && this.cursor >= this.queue.length && nowSong > (this.queue[this.queue.length - 1]?.t || 0) + 0.35) {
      this.offset = nowSong;
      this.playing = false;
      if (this.timer) { window.clearInterval(this.timer); this.timer = null; }
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
      this.mode = 'off';
    }
  }

  private startClock() {
    if (this.timer) window.clearInterval(this.timer);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.timer = window.setInterval(() => this.tick(), 25);
    const loop = () => {
      this.tick();
      if (this.playing) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.tick();
  }

  private noteVoice(ch: string): Voice {
    const c = ch.toLowerCase();
    if (c.includes('kick')) return 'kick';
    if (c.includes('sub')) return 'sub';
    if (c.includes('bass') || c.includes('mid')) return 'bass';
    if (c.includes('acid')) return 'acid';
    if (c.includes('leadb') || c.includes('lead_b') || c === 'ch5_leadb') return 'leadB';
    if (c.includes('lead')) return 'lead';
    if (c.includes('arp')) return 'arp';
    if (c.includes('pad')) return 'pad';
    if (c.includes('hh') || c.includes('hat')) return 'hat';
    if (c.includes('snare') || c.includes('clap')) return 'drum';
    if (c.includes('perc')) return 'perc';
    return 'fx';
  }

  public styleOf(genre?: string): StyleId {
    const g = String(genre || '');
    if (g.includes('Goa')) return 'goa';
    if (g.includes('Power')) return 'power';
    if (g.includes('Melodic')) return 'melodic';
    if (g.includes('Techno')) return 'techno';
    return 'fullon';
  }

  private toQueued(n: NoteEvent, bpm: number, ch: string): Queued {
    const midi = theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note || 'C4');
    return {
      t: ((n.startTick || 0) / 480) * (60 / bpm),
      voice: this.noteVoice(ch),
      freq: midiHz(Number.isFinite(midi) ? midi : 60),
      dur: Math.max(0.05, ((n.durationTicks || 160) / 480) * (60 / bpm)),
      vel: Math.max(0.4, Math.min(1, n.velocity || 0.85)),
    };
  }

  public async playLoop(notes: NoteEvent[], bpm: number, channel: string, genre?: string) {
    this.arm();
    await this.unlock();
    if (!this.ctx) throw new Error('האודיו נעול. לחצו Play שוב.');
    this.killSources();
    this.stopClock();
    this.style = this.styleOf(genre);
    const tempo = Math.max(80, Math.min(180, bpm || 145));
    this.loopLen = 16 * (60 / tempo);
    this.loopPattern = notes.map((n) => this.toQueued(n, tempo, channel));
    if (!this.loopPattern.length) throw new Error('אין תווים בלולאה.');
    this.mode = 'loop';
    this.queue = [];
    this.cursor = 0;
    this.offset = 0;
    this.nextLoopAt = 0;
    this.startedAt = this.ctx.currentTime;
    this.playing = true;
    this.fireKick(this.ctx.currentTime, 0.55);
    this.startClock();
    return this.loopPattern.length;
  }

  public async playGroove(groove: GrooveObject, fromSec = 0) {
    this.arm();
    await this.unlock();
    if (!this.ctx) throw new Error('האודיו נעול. לחצו Play שוב.');
    this.killSources();
    this.stopClock();
    this.style = this.styleOf(groove.genre as string);
    const bpm = groove.bpm || 145;
    const events: Queued[] = [];
    ELITE_16_CHANNELS.forEach((ch) => {
      if (this.channelMutes[ch]) return;
      const notes = ((groove as any)[ch] || []) as NoteEvent[];
      notes.forEach((n) => events.push(this.toQueued(n, bpm, ch)));
    });
    events.sort((a, b) => a.t - b.t);
    const thinned = events.length > 2800
      ? events.filter((e, i) => e.voice === 'kick' || e.voice === 'sub' || e.voice === 'bass' || e.voice === 'lead' || e.voice === 'acid' || i % 2 === 0)
      : events;
    if (!thinned.length) throw new Error('אין תווים להשמעה.');
    this.mode = 'song';
    this.queue = thinned;
    this.offset = Math.max(0, fromSec);
    this.cursor = this.queue.findIndex((e) => e.t >= this.offset - 0.001);
    if (this.cursor < 0) this.cursor = this.queue.length;
    this.startedAt = this.ctx.currentTime;
    this.playing = true;
    this.fireKick(this.ctx.currentTime, 0.55);
    this.startClock();
    return thinned.length;
  }

  public async seek(seconds: number) {
    const grooveTime = Math.max(0, seconds);
    if (this.mode !== 'song' || !this.queue.length) {
      this.offset = grooveTime;
      return;
    }
    this.killSources();
    this.offset = grooveTime;
    this.cursor = this.queue.findIndex((e) => e.t >= grooveTime - 0.001);
    if (this.cursor < 0) this.cursor = this.queue.length;
    if (this.ctx) this.startedAt = this.ctx.currentTime;
    if (this.playing) {
      if (!this.timer) this.startClock();
      else this.tick();
    }
  }

  public async scheduleSequence(groove: GrooveObject) {
    return this.playGroove(groove, 0);
  }

  public async play(_from = 0) { return this.unlock(); }
}

export const audioService = new AudioService();
