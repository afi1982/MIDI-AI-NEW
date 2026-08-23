import { Midi } from '@tonejs/midi';
import { loadMidiFile } from './midiFileService';
import { Mp3Encoder } from '@breezystack/lamejs';
import { inspectAudioBlob, QualityReport } from './qualityGateService';

export interface RenderProfile {
  id: string;
  name: string;
  engine: 'ELECTRONIC' | 'HARDWARE' | 'GENERAL';
}

export interface RenderResult {
  blob: Blob;
  wav: Blob;
  filename: string;
  mime: string;
  duration: number;
  notes: number;
  quality?: QualityReport;
}

type Voice =
  | 'kick' | 'sub' | 'bass' | 'lead' | 'leadB' | 'acid'
  | 'arp' | 'pad' | 'hat' | 'openhat' | 'snare' | 'clap' | 'perc' | 'fx';

type Ev = { t: number; dur: number; midi: number; vel: number; voice: Voice; pan: number };

const SR = 44100;
const CHUNK = 2.4;
const MAX_SEC = 420;
const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const PAN: Record<Voice, number> = {
  kick: 0, sub: 0, bass: -0.08, lead: 0.18, leadB: -0.28, acid: 0.38,
  arp: -0.42, pad: 0, hat: 0.22, openhat: -0.18, snare: 0.04, clap: -0.06, perc: 0.48, fx: -0.35,
};

function classify(name: string, channel: number, midi: number): Voice {
  const n = (name || '').toLowerCase();
  if (/kick|bd\b/.test(n) || midi === 36 && (channel === 9 || /drum/.test(n))) return 'kick';
  if (/sub/.test(n)) return 'sub';
  if (/acid|303/.test(n)) return 'acid';
  if (/lead\s*b|leadb|harmony/.test(n)) return 'leadB';
  if (/lead/.test(n)) return 'lead';
  if (/arp/.test(n)) return 'arp';
  if (/pad|atmos/.test(n)) return 'pad';
  if (/open|hho/.test(n)) return 'openhat';
  if (/hat|hhc|hi-?hat|hh /.test(n)) return 'hat';
  if (/snare|sd\b/.test(n) || midi === 38 && channel === 9) return 'snare';
  if (/clap/.test(n) || midi === 39 && channel === 9) return 'clap';
  if (/perc|tribal|conga|tom/.test(n)) return 'perc';
  if (/synth|fx|riser|impact/.test(n)) return 'fx';
  if (/bass|baseline/.test(n)) return 'bass';
  if (channel === 9) {
    if (midi <= 36) return 'kick';
    if (midi === 38 || midi === 40) return 'snare';
    if (midi === 39) return 'clap';
    if (midi === 42 || midi === 44) return 'hat';
    if (midi === 46) return 'openhat';
    return 'perc';
  }
  if (midi < 40) return 'sub';
  if (midi < 52) return 'bass';
  if (midi > 88) return 'fx';
  return 'lead';
}

function yieldUI() {
  return new Promise<void>((r) => setTimeout(r, 0));
}

class MidiRendererService {
  public async renderToWav(midiFile: File, profile: RenderProfile, onProgress: (p: number) => void): Promise<Blob> {
    const out = await this.renderToAudio(midiFile, profile, onProgress);
    return out.blob;
  }

  public async renderToAudio(midiFile: File, profile: RenderProfile, onProgress: (p: number) => void): Promise<RenderResult> {
    onProgress(4);
    const { midi } = await loadMidiFile(midiFile);
    const events = this.collect(midi);
    if (!events.length) throw new Error('אין תווים ב-MIDI. בחרו קובץ עם ערוצים מלאים.');

    const last = events.reduce((m, e) => Math.max(m, e.t + e.dur), 0);
    const duration = Math.min(MAX_SEC, Math.max(2, last + 1.4));
    const total = Math.ceil(duration * SR);
    const left = new Float32Array(total);
    const right = new Float32Array(total);
    const kicks = events.filter((e) => e.voice === 'kick').map((e) => e.t);

    onProgress(8);
    let rendered = 0;
    for (let start = 0; start < duration; start += CHUNK) {
      const len = Math.min(CHUNK, duration - start);
      const slice = await this.renderChunk(events, kicks, start, len, profile);
      const L = slice.getChannelData(0);
      const R = slice.numberOfChannels > 1 ? slice.getChannelData(1) : L;
      const offset = Math.floor(start * SR);
      const n = Math.min(L.length, total - offset);
      for (let i = 0; i < n; i++) {
        left[offset + i] += L[i];
        right[offset + i] += R[i];
      }
      rendered += len;
      onProgress(8 + Math.round((rendered / duration) * 70));
      await yieldUI();
    }

    this.master(left, right, profile);
    onProgress(84);
    const wav = this.encodeWav(left, right, SR);
    onProgress(88);
    let blob = wav;
    let mime = 'audio/wav';
    let ext = 'wav';
    try {
      blob = this.encodeMp3(left, right, SR);
      mime = 'audio/mpeg';
      ext = 'mp3';
    } catch (err) {
      console.warn('MP3 encode failed, using WAV', err);
    }
    onProgress(96);
    const quality = await inspectAudioBlob(wav);
    const base = midiFile.name.replace(/\.[^.]+$/, '') || 'MIDI_AI';
    const tag = (profile.id || 'mix').toUpperCase();
    return {
      blob,
      wav,
      filename: `${base}_${tag}.${ext}`,
      mime,
      duration,
      notes: events.length,
      quality,
    };
  }

  private collect(midi: Midi): Ev[] {
    const out: Ev[] = [];
    midi.tracks.forEach((track) => {
      if (!track.notes.length) return;
      const channel = typeof track.channel === 'number' ? track.channel : 0;
      const name = String(track.name || '');
      track.notes.forEach((n) => {
        const voice = classify(name, channel, n.midi);
        out.push({
          t: Math.max(0, n.time),
          dur: Math.max(0.04, n.duration || 0.12),
          midi: n.midi,
          vel: Math.max(0.25, Math.min(1, n.velocity || 0.8)),
          voice,
          pan: PAN[voice],
        });
      });
    });
    return out.sort((a, b) => a.t - b.t);
  }

  private async renderChunk(events: Ev[], kicks: number[], start: number, len: number, profile: RenderProfile) {
    const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(len * SR)), SR);
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.004;
    comp.release.value = 0.16;
    master.connect(comp);
    comp.connect(ctx.destination);

    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = profile.engine === 'HARDWARE' ? 0.33 : 0.22;
    const delayGain = ctx.createGain();
    delayGain.gain.value = profile.engine === 'ELECTRONIC' ? 0.16 : 0.12;
    delay.connect(delayGain);
    delayGain.connect(master);

    const inWin = events.filter((e) => e.t + e.dur > start && e.t < start + len);
    inWin.forEach((e) => {
      const when = Math.max(0, e.t - start);
      const remain = Math.min(e.t + e.dur, start + len) - Math.max(e.t, start);
      if (remain < 0.012) return;
      const duck = (e.voice === 'sub' || e.voice === 'bass' || e.voice === 'pad')
        ? this.duck(e.t, kicks)
        : 1;
      this.voice(ctx, master, delay, e, when, remain, duck, profile, e.t < start);
    });

    return ctx.startRendering();
  }

  private duck(t: number, kicks: number[]) {
    let g = 1;
    for (let i = 0; i < kicks.length; i++) {
      const dt = t - kicks[i];
      if (dt >= 0 && dt < 0.14) g = Math.min(g, 0.22 + (dt / 0.14) * 0.78);
    }
    return g;
  }

  private connectPan(ctx: OfflineAudioContext, dest: AudioNode, pan: number) {
    if (typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(dest);
      return p as AudioNode;
    }
    return dest;
  }

  private env(g: GainNode, when: number, peak: number, attack: number, dur: number) {
    const d = Math.max(0.04, dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0015, peak), when + Math.max(0.003, attack));
    g.gain.exponentialRampToValueAtTime(0.0001, when + d);
  }

  private voice(
    ctx: OfflineAudioContext,
    master: AudioNode,
    delay: DelayNode,
    e: Ev,
    when: number,
    dur: number,
    duck: number,
    profile: RenderProfile,
    tail: boolean
  ) {
    const dest = this.connectPan(ctx, master, e.pan);
    const fat = profile.engine === 'ELECTRONIC';
    const retro = profile.engine === 'HARDWARE';
    const v = e.vel * duck;

    if (e.voice === 'kick') {
      const osc = ctx.createOscillator();
      const click = ctx.createOscillator();
      const g = ctx.createGain();
      const cg = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(tail ? 52 : 170, when);
      osc.frequency.exponentialRampToValueAtTime(46, when + 0.1);
      this.env(g, when, (fat ? 1 : 0.85) * v, 0.003, 0.24);
      click.type = 'square';
      click.frequency.value = 88;
      this.env(cg, when, 0.14 * v, 0.001, 0.028);
      osc.connect(g); g.connect(dest);
      click.connect(cg); cg.connect(dest);
      osc.start(when); osc.stop(when + 0.26);
      click.start(when); click.stop(when + 0.04);
      return;
    }

    if (e.voice === 'sub') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = Math.max(28, midiHz(e.midi));
      this.env(g, when, 0.42 * v, tail ? 0.02 : 0.008, Math.max(0.08, dur));
      osc.connect(g); g.connect(dest);
      osc.start(when); osc.stop(when + dur + 0.03);
      return;
    }

    if (e.voice === 'bass') {
      const osc = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = Math.max(36, midiHz(e.midi));
      f.type = 'lowpass';
      f.frequency.setValueAtTime(fat ? 920 : 640, when);
      f.frequency.exponentialRampToValueAtTime(280, when + Math.min(0.18, dur));
      f.Q.value = 1.6;
      this.env(g, when, 0.26 * v, 0.005, Math.max(0.07, dur * 0.92));
      osc.connect(f); f.connect(g); g.connect(dest);
      osc.start(when); osc.stop(when + dur + 0.03);
      return;
    }

    if (e.voice === 'acid') {
      const osc = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = retro ? 'square' : 'sawtooth';
      const hz = Math.max(55, midiHz(e.midi));
      osc.frequency.setValueAtTime(hz * 0.68, when);
      osc.frequency.exponentialRampToValueAtTime(hz, when + 0.03);
      f.type = 'lowpass';
      f.Q.value = fat ? 14 : 9;
      f.frequency.setValueAtTime(1800 + v * 800, when);
      f.frequency.exponentialRampToValueAtTime(260, when + Math.min(0.22, dur));
      this.env(g, when, 0.2 * v, 0.004, Math.min(0.26, dur));
      osc.connect(f); f.connect(g); g.connect(dest);
      g.connect(delay);
      osc.start(when); osc.stop(when + Math.min(0.3, dur) + 0.03);
      return;
    }

    if (e.voice === 'lead' || e.voice === 'leadB') {
      const twin = e.voice === 'lead';
      const peak = (twin ? 0.15 : 0.13) * v * (fat ? 1.1 : 1);
      const mk = (detune: number, type: OscillatorType) => {
        const osc = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = retro ? 'square' : type;
        osc.frequency.value = Math.max(80, midiHz(e.midi));
        osc.detune.value = detune;
        f.type = 'lowpass';
        f.Q.value = 1.4;
        f.frequency.value = fat ? 4600 : retro ? 2600 : 3400;
        this.env(g, when, peak, tail ? 0.05 : 0.012, Math.max(0.08, dur));
        osc.connect(f); f.connect(g); g.connect(dest);
        if (twin) g.connect(delay);
        osc.start(when); osc.stop(when + dur + 0.04);
      };
      if (twin) { mk(-10, 'sawtooth'); mk(12, 'square'); }
      else mk(0, 'sawtooth');
      return;
    }

    if (e.voice === 'arp') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = Math.max(90, midiHz(e.midi));
      this.env(g, when, 0.1 * v, 0.004, Math.min(0.14, dur));
      osc.connect(g); g.connect(dest);
      osc.start(when); osc.stop(when + Math.min(0.16, dur) + 0.02);
      return;
    }

    if (e.voice === 'pad') {
      const a = ctx.createOscillator();
      const b = ctx.createOscillator();
      const g = ctx.createGain();
      a.type = 'triangle';
      b.type = 'sine';
      a.frequency.value = Math.max(80, midiHz(e.midi));
      b.frequency.value = Math.max(80, midiHz(e.midi));
      b.detune.value = 7;
      this.env(g, when, 0.08 * v, tail ? 0.02 : 0.12, Math.max(0.35, dur));
      a.connect(g); b.connect(g); g.connect(dest);
      a.start(when); b.start(when);
      a.stop(when + dur + 0.05); b.stop(when + dur + 0.05);
      return;
    }

    if (e.voice === 'hat' || e.voice === 'openhat' || e.voice === 'snare' || e.voice === 'clap' || e.voice === 'perc') {
      const src = ctx.createBufferSource();
      src.buffer = this.noise(ctx, Math.max(0.04, dur + 0.02));
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      if (e.voice === 'hat') { f.type = 'highpass'; f.frequency.value = 6500; this.env(g, when, 0.07 * v, 0.001, 0.035); }
      else if (e.voice === 'openhat') { f.type = 'highpass'; f.frequency.value = 5000; this.env(g, when, 0.08 * v, 0.002, 0.16); }
      else if (e.voice === 'snare') { f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8; this.env(g, when, 0.22 * v, 0.002, 0.14); }
      else if (e.voice === 'clap') { f.type = 'bandpass'; f.frequency.value = 1400; this.env(g, when, 0.18 * v, 0.004, 0.12); }
      else { f.type = 'bandpass'; f.frequency.value = 900; this.env(g, when, 0.12 * v, 0.002, 0.07); }
      src.connect(f); f.connect(g); g.connect(dest);
      src.start(when); src.stop(when + 0.22);
      return;
    }

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(Math.max(200, midiHz(e.midi)), when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(400, midiHz(e.midi) * 1.5), when + Math.max(0.12, dur * 0.7));
    this.env(g, when, 0.09 * v, 0.02, Math.max(0.12, dur));
    osc.connect(g); g.connect(dest);
    osc.start(when); osc.stop(when + dur + 0.03);
  }

  private noise(ctx: OfflineAudioContext, seconds: number) {
    const n = Math.max(64, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private master(left: Float32Array, right: Float32Array, profile: RenderProfile) {
    const drive = profile.engine === 'ELECTRONIC' ? 1.35 : profile.engine === 'HARDWARE' ? 1.05 : 1.18;
    let peak = 0.0001;
    for (let i = 0; i < left.length; i++) {
      left[i] = Math.tanh(left[i] * drive);
      right[i] = Math.tanh(right[i] * drive);
      const a = Math.max(Math.abs(left[i]), Math.abs(right[i]));
      if (a > peak) peak = a;
    }
    const gain = peak > 0.001 ? 0.92 / peak : 1;
    for (let i = 0; i < left.length; i++) {
      left[i] = Math.max(-0.98, Math.min(0.98, left[i] * gain));
      right[i] = Math.max(-0.98, Math.min(0.98, right[i] * gain));
    }
  }

  private encodeWav(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
    const length = left.length * 2 * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    let o = 0;
    const str = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o++, s.charCodeAt(i)); };
    str('RIFF');
    view.setUint32(o, length - 8, true); o += 4;
    str('WAVE'); str('fmt ');
    view.setUint32(o, 16, true); o += 4;
    view.setUint16(o, 1, true); o += 2;
    view.setUint16(o, 2, true); o += 2;
    view.setUint32(o, sampleRate, true); o += 4;
    view.setUint32(o, sampleRate * 4, true); o += 4;
    view.setUint16(o, 4, true); o += 2;
    view.setUint16(o, 16, true); o += 2;
    str('data');
    view.setUint32(o, length - o - 4, true); o += 4;
    for (let i = 0; i < left.length; i++) {
      view.setInt16(o, Math.max(-1, Math.min(1, left[i])) * 0x7fff, true); o += 2;
      view.setInt16(o, Math.max(-1, Math.min(1, right[i])) * 0x7fff, true); o += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  private encodeMp3(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
    const enc = new Mp3Encoder(2, sampleRate, 192);
    const block = 1152;
    const parts: Uint8Array[] = [];
    const to16 = (src: Float32Array, from: number) => {
      const out = new Int16Array(block);
      for (let i = 0; i < block; i++) {
        const s = src[from + i] || 0;
        out[i] = Math.max(-1, Math.min(1, s)) * 0x7fff;
      }
      return out;
    };
    for (let i = 0; i < left.length; i += block) {
      const buf = enc.encodeBuffer(to16(left, i), to16(right, i));
      if (buf.length) parts.push(buf);
    }
    const last = enc.flush();
    if (last.length) parts.push(last);
    if (!parts.length) throw new Error('mp3 empty');
    const bytes = parts.map((p) => new Uint8Array(p.buffer, p.byteOffset, p.byteLength));
    return new Blob(bytes, { type: 'audio/mpeg' });
  }
}

export const midiRendererService = new MidiRendererService();
