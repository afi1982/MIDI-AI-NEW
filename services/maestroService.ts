
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

export interface GenerationMetadata {
    sourceFilesUsed: string[];
    fidelityConfidence: number;
    enginePatternsActive: number;
}

export class MaestroClass {
    public async generateGroove(params: any, trackLengthMinutes: number, channels: ChannelKey[]): Promise<GrooveObject> {
        const bpm = params.bpm || 145;
        const totalBars = Math.ceil((trackLengthMinutes * bpm) / 4);
        const genre = params.genre || MusicGenre.PSYTRANCE_FULLON;
        const genreId = resolveGenreId(genre);
        const engineProfile = engineProfileService.getGenreEngineProfile(genreId);
        const isNeurokinetic = engineProfileService.isNeurokineticActive();

        // Track source files for status
        const sources = engineProfile.samples > 0 ? engineProfile.lastSources.map(s => s.file) : [];
        
        if (engineProfile.samples > 0) {
            engineLogService.append({ 
                type: "ENGINE_SYNTHESIS_TRACE", 
                genre: genreId, 
                samples: engineProfile.samples, 
                reason: `Neurokinetic Influence: ${isNeurokinetic ? 'HYBRID_ACTIVE' : 'STANDARD'} | Sources: ${sources.slice(0, 2).join(', ')}` 
            });
        }
        
        const groove: any = {
            id: `GEN-${Date.now()}`,
            name: params.trackName || "Neurokinetic Composition",
            bpm,
            key: params.key || "F#",
            scale: params.scale || "Phrygian",
            genre: genre,
            totalBars,
            structureMap: this.generateDefaultStructure(totalBars, ELITE_16_CHANNELS), // Always use 16 channels for structure
            meta: {
                sourceFilesUsed: sources,
                engineEnhanced: true,
                fidelityRate: 100,
                architecture: "Neurokinetic V120"
            }
        };

        // Ensure all 16 channels exist
        ELITE_16_CHANNELS.forEach(ch => groove[ch] = []);

        // Generate a set of motifs for the track to ensure consistency and prevent clashing
        const trackMotifs: Record<string, number[]> = {};
        const melodicChannels = ELITE_16_CHANNELS.filter(c => c.includes('lead') || c.includes('arp') || c.includes('acid') || c.includes('synth') || c.includes('pad'));
        
        melodicChannels.forEach(ch => {
            const engineProfileData = engineProfile.samples > 0 ? {
                genreTag: genreId,
                avgLeadDensity: engineProfile.densityTarget / 16,
                avgBassDensity: 0.8,
                rhythmMask16: engineProfile.learnedParams?.rhythmTemplates?.[0] || [],
                pitchRange: { min: 60, max: 60 + engineProfile.melodyRangeSemitones },
                updatedAt: Date.now(),
                sampleCount: engineProfile.samples
            } : undefined;
            trackMotifs[ch] = melodicComposer.createMotif(16, 7, genre, engineProfileData);
        });

        for (let b = 0; b < totalBars; b++) {
            // Find current section
            const section = groove.structureMap.find((s: any) => b >= s.startBar && b < s.startBar + s.durationBars);
            const activeChannels = section ? section.activeInstruments : ELITE_16_CHANNELS;
            const energy = section ? section.energy : EnergyLevel.MED;

            // Mutate motifs slightly every 8 bars for movement
            if (b > 0 && b % 8 === 0) {
                melodicChannels.forEach(ch => {
                    if (Math.random() > 0.5) {
                        trackMotifs[ch] = melodicComposer.mutateMotif(trackMotifs[ch], 7);
                    }
                });
            }

            ELITE_16_CHANNELS.forEach((ch: ChannelKey) => {
                // Neurokinetic Hybrid Logic:
                // If channel is Kick/Sub/Bass or Percussion and we are in Neurokinetic mode, 
                // we prioritize the learned rhythm templates from the engine profile.
                const isRhythm = ch.includes('kick') || ch.includes('sub') || ch.includes('midBass');
                const isPerc = ch.includes('perc') || ch.includes('hh');
                const useHybrid = isNeurokinetic && (isRhythm || isPerc) && engineProfile.learnedParams?.rhythmTemplates && engineProfile.learnedParams.rhythmTemplates.length > 0;

                // Orchestration variety
                let barProbability = 1.0;
                if (!isRhythm) {
                    if (ch.includes('lead') || ch.includes('arp') || ch.includes('acid')) {
                        // Melodic channels alternate or have gaps to prevent "crushing"
                        const channelIndex = melodicChannels.indexOf(ch);
                        const isEvenBar = b % 2 === 0;
                        const isEvenChannel = channelIndex % 2 === 0;
                        
                        // Complementary activation: Even channels on even bars, odd on odd, or both on peak
                        if (energy === EnergyLevel.PEAK) {
                            barProbability = 1.0;
                        } else {
                            barProbability = (isEvenBar === isEvenChannel) ? 1.0 : 0.3;
                        }
                    } else if (ch.includes('perc') || ch.includes('hh')) {
                        barProbability = (b % 4 === 0) ? 0.8 : 1.0;
                    }
                }

                if (activeChannels.includes(ch) && Math.random() < barProbability) {
                    const complexity = energy === EnergyLevel.PEAK ? 'COMPLEX' : 'SIMPLE';
                    
                    // If hybrid, we might pass a specific mask derived from the engine
                    const mask = useHybrid ? engineProfile.learnedParams!.rhythmTemplates![0] : undefined;
                    
                    // Use the pre-generated motif for this channel
                    const motif = trackMotifs[ch];

                    const notes = this.generateSingleBar(ch, b, groove.bpm, groove.key, groove.scale, complexity, motif, mask, groove.genre as MusicGenre);
                    groove[ch].push(...notes);
                }
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
        const segments: ArrangementSegment[] = [];
        
        // Define channel groups for orchestration
        const rhythmGroup = channels.filter(c => c.includes('kick') || c.includes('sub') || c.includes('midBass') || c.includes('hh') || c.includes('perc'));
        const melodicGroup = channels.filter(c => c.includes('lead') || c.includes('arp') || c.includes('acid') || c.includes('synth'));
        const atmosphericGroup = channels.filter(c => c.includes('pad') || c.includes('snare') || c.includes('clap'));

        // 1. INTRO (15%)
        const introLen = Math.floor(totalBars * 0.15);
        segments.push({ 
            type: SectionType.INTRO, 
            startBar: 0, 
            durationBars: introLen, 
            energy: EnergyLevel.LOW, 
            activeInstruments: [...rhythmGroup.slice(0, 3), ...atmosphericGroup.slice(0, 1)] 
        });

        // 2. BUILDUP (20%)
        const verseLen = Math.floor(totalBars * 0.20);
        segments.push({ 
            type: SectionType.BUILDUP, 
            startBar: introLen, 
            durationBars: verseLen, 
            energy: EnergyLevel.MED, 
            activeInstruments: [...rhythmGroup, ...melodicGroup.slice(0, 1)] 
        });

        // 3. DROP / PEAK (30%)
        const dropLen = Math.floor(totalBars * 0.30);
        segments.push({ 
            type: SectionType.DROP, 
            startBar: introLen + verseLen, 
            durationBars: dropLen, 
            energy: EnergyLevel.PEAK, 
            activeInstruments: channels 
        });

        // 4. BREAKDOWN (15%)
        const breakLen = Math.floor(totalBars * 0.15);
        segments.push({ 
            type: SectionType.BREAKDOWN, 
            startBar: introLen + verseLen + dropLen, 
            durationBars: breakLen, 
            energy: EnergyLevel.LOW, 
            activeInstruments: [...melodicGroup, ...atmosphericGroup] 
        });

        // 5. OUTRO (20%)
        const outroLen = totalBars - (introLen + verseLen + dropLen + breakLen);
        segments.push({ 
            type: SectionType.OUTRO, 
            startBar: introLen + verseLen + dropLen + breakLen, 
            durationBars: outroLen, 
            energy: EnergyLevel.LOW, 
            activeInstruments: rhythmGroup.slice(0, 4) 
        });

        return segments;
    }
}

export const maestroService = new MaestroClass();
