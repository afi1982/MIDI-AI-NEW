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

const MAX_LIVE = 28;
const LOOKAHEAD = 0.38;

export class AudioService {
  private channelMutes: Record<string, boolean> = {};
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: DynamicsCompressorNode | null = null;
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
  private style: StyleId = 'fullon';
  private noiseBuf: AudioBuffer | null = null;

  public async unlock() {
    await unlockAudio();
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AC({ latencyHint: 'interactive' } as AudioContextOptions);
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.78;
      this.bus = this.ctx.createDynamicsCompressor();
      this.bus.threshold.value = -18;
      this.bus.knee.value = 18;
      this.bus.ratio.value = 4;
      this.bus.attack.value = 0.003;
      this.bus.release.value = 0.12;
      this.master.connect(this.bus);
      this.bus.connect(this.ctx.destination);
      this.noiseBuf = null;
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    return this.ctx.state === 'running';
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
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
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
    while (this.nodes.length > MAX_LIVE) {
      const old = this.nodes.shift();
      if (!old) break;
      try { old.stop(); } catch {}
      try { old.disconnect(); } catch {}
    }
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

  private env(g: GainNode, when: number, peak: number, attack: number, dur: number) {
    const d = Math.max(0.05, dur);
    g.gain.cancelScheduledValues(when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.002, peak), when + Math.max(0.004, attack));
    g.gain.exponentialRampToValueAtTime(0.0001, when + d);
  }

  private fireKick(when: number, vel: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const click = ctx.createOscillator();
    const g = ctx.createGain();
    const cg = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(168, when);
    osc.frequency.exponentialRampToValueAtTime(46, when + 0.09);
    this.env(g, when, Math.max(0.2, vel) * 0.95, 0.004, 0.22);
    click.type = 'square';
    click.frequency.setValueAtTime(90, when);
    this.env(cg, when, 0.12 * vel, 0.001, 0.03);
    osc.connect(g); g.connect(this.dest());
    click.connect(cg); cg.connect(this.dest());
    osc.start(when); osc.stop(when + 0.24);
    click.start(when); click.stop(when + 0.04);
    this.track(osc); this.track(click);
  }

  private fireSub(when: number, freq: number, dur: number, vel: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(Math.max(28, freq), when);
    this.env(g, when, 0.34 * vel, 0.008, Math.max(0.09, dur));
    osc.connect(g); g.connect(this.dest());
    osc.start(when); osc.stop(when + Math.max(0.09, dur) + 0.03);
    this.track(osc);
  }

  private fireBass(when: number, freq: number, dur: number, vel: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(Math.max(36, freq), when);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.style === 'techno' || this.style === 'melodic' ? 520 : 780, when);
    filter.Q.value = 1.4;
    this.env(g, when, 0.22 * vel, 0.006, Math.max(0.07, dur * 0.9));
    osc.connect(filter); filter.connect(g); g.connect(this.dest());
    osc.start(when); osc.stop(when + Math.max(0.08, dur) + 0.03);
    this.track(osc);
  }

  private fireLead(when: number, freq: number, dur: number, vel: number, twin: boolean) {
    const ctx = this.ctx!;
    const d = Math.max(0.08, dur);
    const bright = this.style === 'goa' || this.style === 'fullon';
    const soft = this.style === 'melodic';
    const peak = (twin ? 0.16 : 0.2) * vel * (soft ? 0.85 : 1);
    const make = (detune: number, type: OscillatorType) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(80, freq), when);
      osc.detune.setValueAtTime(detune, when);
      filter.type = 'lowpass';
      filter.Q.value = soft ? 0.7 : 1.8;
      filter.frequency.setValueAtTime(bright ? 4200 : 2400, when);
      this.env(g, when, peak, soft ? 0.04 : 0.012, d);
      osc.connect(filter); filter.connect(g); g.connect(this.dest());
      osc.start(when); osc.stop(when + d + 0.04);
      this.track(osc);
    };
    if (twin) {
      make(-9, 'sawtooth');
      make(11, 'square');
    } else {
      make(0, this.style === 'power' ? 'square' : 'sawtooth');
    }
  }

  private fireAcid(when: number, freq: number, dur: number, vel: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const d = Math.max(0.06, Math.min(0.28, dur));
    const goa = this.style === 'goa';
    const techno = this.style === 'techno' || this.style === 'melodic';
    osc.type = techno ? 'square' : 'sawtooth';
    const startF = Math.max(50, freq * (goa ? 0.55 : 0.72));
    osc.frequency.setValueAtTime(startF, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(55, freq), when + 0.028);
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(goa ? 16 : techno ? 7 : 12, when);
    const open = goa ? 2400 : techno ? 900 : 1600;
    const close = goa ? 420 : techno ? 220 : 260;
    filter.frequency.setValueAtTime(open + vel * 400, when);
    filter.frequency.exponentialRampToValueAtTime(close, when + d * 0.85);
    this.env(g, when, 0.2 * vel, 0.004, d);
    osc.connect(filter); filter.connect(g); g.connect(this.dest());
    osc.start(when); osc.stop(when + d + 0.04);
    this.track(osc);
  }

  private fireArp(when: number, freq: number, dur: number, vel: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(Math.max(90, freq), when);
    this.env(g, when, 0.11 * vel, 0.004, Math.min(0.16, Math.max(0.05, dur)));
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
    this.env(g, when, 0.09 * vel, 0.08, Math.max(0.3, dur));
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
    osc.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 1.6), when + Math.max(0.12, dur * 0.8));
    this.env(g, when, 0.1 * vel, 0.02, Math.max(0.12, dur));
    osc.connect(g); g.connect(this.dest());
    osc.start(when); osc.stop(when + Math.max(0.14, dur) + 0.03);
    this.track(osc);
  }

  private fireNoise(when: number, dur: number, gain: number, hpHz: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = this.noise();
    src.loop = true;
    filter.type = 'highpass';
    filter.frequency.value = hpHz;
    this.env(g, when, Math.max(0.002, gain), 0.002, Math.max(0.03, dur));
    src.connect(filter); filter.connect(g); g.connect(this.dest());
    src.start(when); src.stop(when + Math.max(0.03, dur) + 0.02);
    this.track(src);
  }

  private emit(ev: Queued, when: number) {
    if (!this.ctx || when < this.ctx.currentTime - 0.03) return;
    switch (ev.voice) {
      case 'kick': this.fireKick(when, ev.vel); break;
      case 'sub': this.fireSub(when, ev.freq, ev.dur, ev.vel); break;
      case 'bass': this.fireBass(when, ev.freq, ev.dur, ev.vel); break;
      case 'lead': this.fireLead(when, ev.freq, ev.dur, ev.vel, true); break;
      case 'leadB': this.fireLead(when, ev.freq, ev.dur, ev.vel, false); break;
      case 'acid': this.fireAcid(when, ev.freq, ev.dur, ev.vel); break;
      case 'arp': this.fireArp(when, ev.freq, ev.dur, ev.vel); break;
      case 'pad': this.firePad(when, ev.freq, ev.dur, ev.vel); break;
      case 'fx': this.fireFx(when, ev.freq, ev.dur, ev.vel); break;
      case 'hat': this.fireNoise(when, 0.032, 0.07 * ev.vel, 6000); break;
      case 'drum': this.fireNoise(when, 0.1, 0.16 * ev.vel, 900); break;
      default: this.fireNoise(when, 0.06, 0.1 * ev.vel, 1800); break;
    }
  }

  private enqueueLoop() {
    if (this.mode !== 'loop' || !this.loopPattern.length) return;
    if (this.cursor > 48) {
      this.queue = this.queue.slice(this.cursor);
      this.cursor = 0;
    }
    const horizon = this.getSeconds() + 1.0;
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
    while (this.cursor < this.queue.length && this.queue[this.cursor].t <= horizon && fired < 18) {
      const ev = this.queue[this.cursor++];
      this.emit(ev, this.startedAt + (ev.t - this.offset));
      fired++;
    }
    if (this.mode === 'song' && this.cursor >= this.queue.length && nowSong > (this.queue[this.queue.length - 1]?.t || 0) + 0.35) {
      this.offset = nowSong;
      this.playing = false;
      if (this.timer) { window.clearInterval(this.timer); this.timer = null; }
      this.mode = 'off';
    }
  }

  private startClock() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 30);
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
      freq: midiHz(midi),
      dur: Math.max(0.05, ((n.durationTicks || 160) / 480) * (60 / bpm)),
      vel: Math.max(0.35, Math.min(1, n.velocity || 0.85)),
    };
  }

  public async playLoop(notes: NoteEvent[], bpm: number, channel: string, genre?: string) {
    const ok = await this.unlock();
    if (!ok || !this.ctx) throw new Error('האודיו נעול. לחצו Play שוב.');
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
    this.startedAt = this.ctx.currentTime + 0.03;
    this.playing = true;
    this.startClock();
    return this.loopPattern.length;
  }

  public async playGroove(groove: GrooveObject, fromSec = 0) {
    const ok = await this.unlock();
    if (!ok || !this.ctx) throw new Error('האודיו נעול. לחצו Play שוב.');
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
    this.startedAt = this.ctx.currentTime + 0.03;
    this.playing = true;
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
