import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';

export interface RenderProfile {
    id: string;
    name: string;
    engine: 'ELECTRONIC' | 'HARDWARE' | 'GENERAL';
}

function isDrumTrack(track: any) {
    const name = String(track.name || '').toLowerCase();
    return track.channel === 9 || track.instrument?.percussion || /kick|snare|clap|hat|hh|perc|drum/.test(name);
}

function isKickNote(midi: number, name: string) {
    return midi <= 36 || /kick/.test(name);
}

function isHatNote(midi: number, name: string) {
    return midi === 42 || midi === 44 || midi === 46 || /hh|hat/.test(name);
}

class MidiRendererService {
    public async renderToWav(midiFile: File, profile: RenderProfile, onProgress: (p: number) => void): Promise<Blob> {
        const arrayBuffer = await midiFile.arrayBuffer();
        const midi = new Midi(arrayBuffer);
        const bpm = midi.header.tempos[0]?.bpm || 140;
        const durationSeconds = Math.max(2, midi.duration + 2);

        let interval: ReturnType<typeof setInterval> | undefined;

        const buffer = await Tone.Offline(async (context) => {
            context.transport.bpm.value = bpm;
            const limiter = new Tone.Limiter(-1.2).toDestination();
            const master = new Tone.Compressor({ threshold: -16, ratio: 3, attack: 0.01, release: 0.18 }).connect(limiter);
            const reverb = new Tone.Reverb({ decay: 2.2, wet: 0.12 }).connect(master);
            await reverb.generate();

            midi.tracks.forEach((track) => {
                if (!track.notes.length) return;
                const name = String(track.name || '');
                const drums = isDrumTrack(track);
                const bass = !drums && track.notes.every((n) => n.midi < 52);
                const pad = /pad|atmos/.test(name.toLowerCase());

                if (drums) {
                    const kick = new Tone.MembraneSynth({
                        pitchDecay: 0.05, octaves: 5,
                        envelope: { attack: 0.001, decay: 0.36, sustain: 0, release: 0.12 },
                    }).connect(master);
                    kick.volume.value = -3;
                    const snare = new Tone.NoiseSynth({
                        envelope: { attack: 0.001, decay: 0.16, sustain: 0 },
                    }).connect(master);
                    snare.volume.value = -10;
                    const hat = new Tone.MetalSynth({
                        envelope: { attack: 0.001, decay: 0.07, release: 0.02 },
                        harmonicity: 5.1, modulationIndex: 20, resonance: 2800, octaves: 1.1,
                    }).connect(master);
                    hat.volume.value = -18;

                    track.notes.forEach((note) => {
                        if (isKickNote(note.midi, name)) kick.triggerAttackRelease('C1', '8n', note.time, note.velocity);
                        else if (isHatNote(note.midi, name)) hat.triggerAttackRelease('32n', note.time, note.velocity);
                        else snare.triggerAttackRelease('16n', note.time, note.velocity);
                    });
                    return;
                }

                if (bass) {
                    const synth = new Tone.PolySynth(Tone.Synth, {
                        oscillator: { type: 'sawtooth' },
                        envelope: { attack: 0.004, decay: 0.14, sustain: 0.18, release: 0.08 },
                    }).connect(master);
                    synth.volume.value = -7;
                    track.notes.forEach((note) => synth.triggerAttackRelease(note.name, Math.max(0.05, note.duration), note.time, note.velocity));
                    return;
                }

                const dest = pad ? reverb : master;
                const synth = new Tone.PolySynth(Tone.Synth, {
                    oscillator: { type: profile.engine === 'HARDWARE' ? 'square' : pad ? 'sine' : 'fatsawtooth' },
                    envelope: pad
                        ? { attack: 0.18, decay: 0.3, sustain: 0.65, release: 0.9 }
                        : { attack: 0.012, decay: 0.12, sustain: 0.32, release: 0.28 },
                }).connect(dest);
                synth.volume.value = pad ? -12 : -8;
                track.notes.forEach((note) => synth.triggerAttackRelease(note.name, Math.max(0.05, note.duration), note.time, note.velocity));
            });

            let last = 0;
            interval = setInterval(() => {
                const p = Math.min(90, Math.round((context.currentTime / durationSeconds) * 90));
                if (p > last) { onProgress(p); last = p; }
            }, 80);
        }, durationSeconds);

        if (interval) clearInterval(interval);
        onProgress(100);
        return this.encodeWav(buffer.get());
    }

    private encodeWav(buffer: AudioBuffer): Blob {
        const numOfChan = buffer.numberOfChannels;
        const length = buffer.length * numOfChan * 2 + 44;
        const bufferData = new ArrayBuffer(length);
        const view = new DataView(bufferData);
        const channels: Float32Array[] = [];
        let offset = 0;

        const writeString = (s: string) => {
            for (let j = 0; j < s.length; j++) view.setUint8(offset + j, s.charCodeAt(j));
            offset += s.length;
        };

        writeString('RIFF');
        view.setUint32(offset, length - 8, true); offset += 4;
        writeString('WAVE');
        writeString('fmt ');
        view.setUint32(offset, 16, true); offset += 4;
        view.setUint16(offset, 1, true); offset += 2;
        view.setUint16(offset, numOfChan, true); offset += 2;
        view.setUint32(offset, buffer.sampleRate, true); offset += 4;
        view.setUint32(offset, buffer.sampleRate * 2 * numOfChan, true); offset += 4;
        view.setUint16(offset, numOfChan * 2, true); offset += 2;
        view.setUint16(offset, 16, true); offset += 2;
        writeString('data');
        view.setUint32(offset, length - offset - 4, true); offset += 4;

        for (let i = 0; i < numOfChan; i++) channels.push(buffer.getChannelData(i));
        for (let i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < numOfChan; channel++) {
                let sample = Math.max(-1, Math.min(1, channels[channel][i]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, sample, true);
                offset += 2;
            }
        }
        return new Blob([view], { type: 'audio/wav' });
    }
}

export const midiRendererService = new MidiRendererService();
