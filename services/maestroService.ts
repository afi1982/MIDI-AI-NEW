import { GrooveObject, NoteEvent, ChannelKey, MusicGenre } from '../types';
import { engineLogService } from './engineLogService';
import { engineProfileService, resolveGenreId } from './engineProfileService';
import { ComplexityLevel } from './melodicComposer';
import { composeMusicalLoop, composeProfessionalTrack } from './trackComposer';

export const ELITE_16_CHANNELS: ChannelKey[] = [
  'ch1_kick', 'ch2_sub', 'ch3_midBass', 'ch4_leadA', 'ch5_leadB',
  'ch6_arpA', 'ch7_arpB', 'ch8_snare', 'ch9_clap', 'ch10_percLoop',
  'ch11_percTribal', 'ch12_hhClosed', 'ch13_hhOpen', 'ch14_acid', 'ch15_pad', 'ch16_synth'
];

export const SUPPORTED_CHANNELS: ChannelKey[] = [...ELITE_16_CHANNELS];

export interface GenerationMetadata {
    sourceFilesUsed: string[];
    fidelityConfidence: number;
    enginePatternsActive: number;
}

export class MaestroClass {
    public async generateGroove(params: any, trackLengthMinutes: number, channels: ChannelKey[]): Promise<GrooveObject> {
        const selected = (channels && channels.length) ? channels : ELITE_16_CHANNELS;
        const groove = composeProfessionalTrack(params, trackLengthMinutes, selected);
        const genreId = resolveGenreId(params.genre || MusicGenre.PSYTRANCE_FULLON);
        const engineProfile = engineProfileService.getGenreEngineProfile(genreId);
        const sources = engineProfile.samples > 0
            ? engineProfile.lastSources.map(s => s.file).filter(Boolean)
            : [];
        groove.meta = {
            ...(groove.meta || {}),
            sourceFilesUsed: sources,
            engineEnhanced: true,
            architecture: 'Phrase Arrangement V2'
        };
        engineLogService.append({
            type: 'ENGINE_SYNTHESIS_TRACE',
            genre: genreId,
            samples: engineProfile.samples,
            reason: `Phrase engine: intro-groove-build-drop-break-drop-outro`
        });
        return groove;
    }

    public generateSingle4BarLoopWithMeta(
        channel: ChannelKey,
        bpm: number,
        key: string,
        scale: string,
        complexity: ComplexityLevel,
        _motif: number[],
        _mask: number[],
        genre: MusicGenre,
        seed = 1
    ): { notes: NoteEvent[], meta: GenerationMetadata } {
        const genreId = resolveGenreId(genre);
        const engineProfile = engineProfileService.getGenreEngineProfile(genreId);
        const notes = composeMusicalLoop(channel, bpm, key, scale, genre, complexity, seed);
        const meta: GenerationMetadata = {
            sourceFilesUsed: engineProfile.samples > 0
                ? engineProfile.lastSources.slice(0, 3).map(s => s.file).filter(Boolean)
                : [`Groove ${seed.toString(36).slice(-4).toUpperCase()}`],
            fidelityConfidence: 100,
            enginePatternsActive: Math.max(1, engineProfile.samples)
        };
        return { notes, meta };
    }

    public generateSingle4BarLoop(
        channel: ChannelKey,
        bpm: number,
        key: string,
        scale: string,
        complexity: ComplexityLevel,
        motif: number[],
        mask: number[],
        genre: MusicGenre,
        seed = 1
    ): NoteEvent[] {
        return this.generateSingle4BarLoopWithMeta(channel, bpm, key, scale, complexity, motif, mask, genre, seed).notes;
    }
}

export const maestroService = new MaestroClass();
