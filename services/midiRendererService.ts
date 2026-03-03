
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';

export interface RenderProfile {
    id: string;
    name: string;
    engine: 'ELECTRONIC' | 'HARDWARE' | 'GENERAL';
}

class MidiRendererService {
    /**
     * Renders a MIDI file to a professional high-quality WAV Blob.
     * Uses faster-than-realtime OfflineAudioContext.
     */
    public async renderToWav(midiFile: File, profile: RenderProfile, onProgress: (p: number) => void): Promise<Blob> {
        const arrayBuffer = await midiFile.arrayBuffer();
        const midi = new Midi(arrayBuffer);
        const bpm = midi.header.tempos[0]?.bpm || 140;
        const durationSeconds = midi.duration + 2.5;

        let interval: any;

        const buffer = await Tone.Offline(async (context) => {
            context.transport.bpm.value = bpm;
            const masterLimiter = new Tone.Limiter(-1).toDestination();
            const masterCompressor = new Tone.Compressor({
                threshold: -18,
                ratio: 3.5,
                attack: 0.005,
                release: 0.2
            }).connect(masterLimiter);

            for (const track of midi.tracks) {
                if (track.notes.length === 0) continue;
                const instrument = this.createInstrumentForTrack(track, profile, masterCompressor);
                const sortedNotes = [...track.notes].sort((a, b) => a.time - b.time);
                sortedNotes.forEach(note => {
                    instrument.triggerAttackRelease(note.name, note.duration, note.time, note.velocity);
                });
            }

            let lastReportedProgress = 0;
            interval = setInterval(() => {
                const p = Math.round((context.currentTime / durationSeconds) * 90);
                if (p > lastReportedProgress) {
                    onProgress(p);
                    lastReportedProgress = p;
                }
            }, 100);
        }, durationSeconds);

        if (interval) clearInterval(interval);
        onProgress(100);
        return this.encodeWav(buffer.get());
    }

    private createInstrumentForTrack(track: any, profile: RenderProfile, dest: Tone.ToneAudioNode): any {
        const isDrums = track.channel === 9 || track.instrument.percussion;
        const isBass = (track.notes.some((n: any) => n.midi < 45) && !isDrums);
        
        // We use PolySynth as a wrapper for Synth to ensure overlaps don't crash the renderer
        if (profile.engine === 'ELECTRONIC') {
            const dist = new Tone.Distortion(0.05).connect(dest);
            const lowPass = new Tone.Filter(4000, "lowpass").connect(dist);

            if (isBass) {
                return new Tone.PolySynth(Tone.Synth, {
                    oscillator: { type: "sawtooth" },
                    envelope: { attack: 0.001, decay: 0.2, sustain: 0.2, release: 0.1 },
                    volume: -6
                }).connect(lowPass);
            }
            return new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "fatsawtooth", count: 3, spread: 20 },
                envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.6 }
            }).connect(lowPass);
        }

        if (profile.engine === 'HARDWARE') {
            const chorus = new Tone.Chorus(4, 2, 0.5).start().connect(dest);
            return new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "square" },
                envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.4 }
            }).connect(chorus);
        }

        return new Tone.PolySynth(Tone.Synth).connect(dest);
    }

    private encodeWav(buffer: AudioBuffer): Blob {
        const numOfChan = buffer.numberOfChannels;
        const length = buffer.length * numOfChan * 2 + 44;
        const bufferData = new ArrayBuffer(length);
        const view = new DataView(bufferData);
        const channels = [];
        let i, sample, offset = 0;

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

        for (i = 0; i < numOfChan; i++) channels.push(buffer.getChannelData(i));

        for (i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < numOfChan; channel++) {
                sample = Math.max(-1, Math.min(1, channels[channel][i]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, sample, true);
                offset += 2;
            }
        }

        return new Blob([view], { type: 'audio/wav' });
    }
}

export const midiRendererService = new MidiRendererService();
