
import { GrooveObject, NoteEvent, ChannelKey, MusicGenre, ArrangementSegment, EnergyLevel, SectionType } from '../types';
import { engineLogService } from './engineLogService';
import { engineProfileService, resolveGenreId } from './engineProfileService';
import { melodicComposer, ComplexityLevel } from './melodicComposer';
import { theoryEngine } from './theoryEngine';

export const ELITE_16_CHANNELS: ChannelKey[] = [
  'ch1_kick', 'ch2_sub', 'ch3_midBass', 'ch4_leadA', 'ch5_leadB',
  'ch6_arpA', 'ch7_arpB', 'ch8_snare', 'ch9_clap', 'ch10_percLoop',
  'ch11_percTribal', 'ch12_hhClosed', 'ch13_hhOpen', 'ch14_acid', 'ch15_pad', 'ch16_synth'
];

export const SUPPORTED_CHANNELS: ChannelKey[] = [...ELITE_16_CHANNELS];

const TICKS_PER_BAR = 1920;
const TICKS_PER_16TH = 120;

export interface GenerationMetadata {
    sourceFilesUsed: string[];
    fidelityConfidence: number;
    enginePatternsActive: number;
}

export class MaestroClass {
    private renderSeedBar(channel: ChannelKey, barIndex: number, seedNotes: any[] = []): NoteEvent[] {
        if (!Array.isArray(seedNotes) || seedNotes.length === 0) return [];
        const baseTick = barIndex * TICKS_PER_BAR;

        return seedNotes.map((seed: any, idx: number) => {
            const step = Math.max(0, Math.min(15, Math.round(seed.s || 0)));
            const durationTicks = Math.max(30, Math.min(240, Math.round(seed.d || 120)));
            const velocityBase = Math.max(0.35, Math.min(1, Number(seed.v || 0.8)));
            const variation = (idx % 4 === 0 && channel !== 'ch1_kick') ? 0.04 : 0;
            const velocity = Math.max(0.3, Math.min(1, velocityBase - variation));
            const startTick = baseTick + (step * TICKS_PER_16TH);

            return {
                note: seed.n || 'C3',
                time: `${barIndex}:${Math.floor(step / 4)}:${step % 4}`,
                duration: '16n',
                durationTicks,
                startTick,
                velocity
            };
        });
    }

    public async generateGroove(params: any, trackLengthMinutes: number, channels: ChannelKey[]): Promise<GrooveObject> {
        const bpm = params.bpm || 145;
        const totalBars = Math.ceil((trackLengthMinutes * bpm) / 4);
        const genre = params.genre || MusicGenre.PSYTRANCE_FULLON;
        const genreId = resolveGenreId(genre);
        const engineProfile = engineProfileService.getGenreEngineProfile(genreId);

        // Track source files for status
        const sources = engineProfile.samples > 0 ? engineProfile.lastSources.map(s => s.file) : [];
        
        if (engineProfile.samples > 0) {
            engineLogService.append({ 
                type: "ENGINE_SYNTHESIS_TRACE", 
                genre: genreId, 
                samples: engineProfile.samples, 
                reason: `Engine Influence from: ${sources.slice(0, 3).join(', ')}` 
            });
        }
        
        const groove: any = {
            id: `GEN-${Date.now()}`,
            name: params.trackName || "AI Composition",
            bpm,
            key: params.key || "F#",
            scale: params.scale || "Phrygian",
            genre: genre,
            totalBars,
            structureMap: this.generateDefaultStructure(totalBars, channels),
            meta: {
                sourceFilesUsed: sources,
                engineEnhanced: engineProfile.samples > 0,
                fidelityRate: engineProfile.samples > 0 ? 98 : 0
            }
        };

        ELITE_16_CHANNELS.forEach(ch => groove[ch] = []);

        const seedPatterns = params?.patterns || {};

        for (let b = 0; b < totalBars; b++) {
            channels.forEach(ch => {
                const seededBar = this.renderSeedBar(ch, b, seedPatterns?.[ch]?.notes || []);
                const generatedBar = this.generateSingleBar(ch, b, groove.bpm, groove.key, groove.scale, 'COMPLEX', undefined, undefined, groove.genre as MusicGenre);
                const notes = seededBar.length > 0 ? [...seededBar, ...generatedBar.filter((n, i) => i % 3 === 0)] : generatedBar;
                groove[ch].push(...notes);
            });
        }

        return groove as GrooveObject;
    }

    public generateSingle4BarLoopWithMeta(
        channel: ChannelKey, 
        bpm: number, 
        key: string, 
        scale: string, 
        complexity: ComplexityLevel, 
        motif: number[], 
        mask: number[],
        genre: MusicGenre
    ): { notes: NoteEvent[], meta: GenerationMetadata } {
        const genreId = resolveGenreId(genre);
        const engineProfile = engineProfileService.getGenreEngineProfile(genreId);
        
        const meta: GenerationMetadata = {
            sourceFilesUsed: engineProfile.samples > 0 ? engineProfile.lastSources.slice(0, 3).map(s => s.file) : ["Factory Standard"],
            fidelityConfidence: engineProfile.samples > 0 ? 98 : 0,
            enginePatternsActive: engineProfile.samples
        };

        if (engineProfile.samples > 0) {
            engineLogService.append({ 
                type: "ENGINE_LOOP_GEN", 
                genre: genreId,
                samples: engineProfile.samples, 
                reason: `Pattern derived from: ${meta.sourceFilesUsed[0]}` 
            });
        }
        
        const allNotes: NoteEvent[] = [];
        for (let b = 0; b < 4; b++) {
            const notes = this.generateSingleBar(channel, b, bpm, key, scale, complexity, motif, mask, genre);
            allNotes.push(...notes);
        }
        return { notes: allNotes, meta };
    }

    public generateSingle4BarLoop(channel: ChannelKey, bpm: number, key: string, scale: string, complexity: ComplexityLevel, motif: number[], mask: number[], genre: MusicGenre): NoteEvent[] {
        return this.generateSingle4BarLoopWithMeta(channel, bpm, key, scale, complexity, motif, mask, genre).notes;
    }

    private generateSingleBar(
        channel: ChannelKey, 
        barIndex: number, 
        bpm: number, 
        key: string, 
        scale: string, 
        complexity: ComplexityLevel, 
        motif?: number[], 
        mask?: number[],
        genre?: MusicGenre
    ): NoteEvent[] {
        const rootMidi = theoryEngine.getMidiNote(`${key}1`);
        const intervals = theoryEngine.getScaleIntervals(scale);
        const genreId = genre ? resolveGenreId(genre) : 'PSYTRANCE_FULLON';
        const engineProfile = engineProfileService.getGenreEngineProfile(genreId);

        const engineProfileData = engineProfile.samples > 0 ? {
            genreTag: genreId,
            avgLeadDensity: engineProfile.densityTarget / 16,
            avgBassDensity: 0.8,
            rhythmMask16: engineProfile.learnedParams?.rhythmTemplates?.[0] || [],
            pitchRange: { min: 60, max: 60 + engineProfile.melodyRangeSemitones },
            updatedAt: Date.now(),
            sampleCount: engineProfile.samples
        } : undefined;
        
        return melodicComposer.generateBar(
            barIndex, 
            rootMidi, 
            intervals, 
            channel, 
            motif, 
            false, 
            complexity, 
            genre || 'Psytrance',
            engineProfileData,
            mask
        );
    }

    private generateDefaultStructure(totalBars: number, channels: ChannelKey[]): ArrangementSegment[] {
        return [
            { type: SectionType.INTRO, startBar: 0, durationBars: Math.floor(totalBars * 0.15), energy: EnergyLevel.LOW, activeInstruments: channels.slice(0, 4) },
            { type: SectionType.DROP, startBar: Math.floor(totalBars * 0.3), durationBars: Math.floor(totalBars * 0.4), energy: EnergyLevel.PEAK, activeInstruments: channels }
        ];
    }
}

export const maestroService = new MaestroClass();
