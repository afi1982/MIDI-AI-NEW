
import { Midi } from '@tonejs/midi';
import { StyleEngineProfile, MusicGenre, ReferenceProfileStats } from '../types';

const GENRE_SIGNATURES: Record<MusicGenre, { minBpm: number; maxBpm: number; bassDensityMin: number; kickSteady: boolean }> = {
    [MusicGenre.PSYTRANCE_FULLON]: { minBpm: 142, maxBpm: 150, bassDensityMin: 10, kickSteady: true },
    [MusicGenre.TECHNO_PEAK]: { minBpm: 128, maxBpm: 136, bassDensityMin: 1, kickSteady: true },
    [MusicGenre.GOA_TRANCE]: { minBpm: 138, maxBpm: 144, bassDensityMin: 8, kickSteady: true },
    [MusicGenre.MELODIC_TECHNO]: { minBpm: 122, maxBpm: 130, bassDensityMin: 4, kickSteady: true },
    [MusicGenre.PSYTRANCE_POWER]: { minBpm: 140, maxBpm: 146, bassDensityMin: 10, kickSteady: true },
};

const detectGenre = (bpm: number, tracks: StyleEngineProfile['trackStats']): { genre: MusicGenre | null, confidence: number } => {
    let bestMatch: MusicGenre | null = null;
    let highestScore = 0;

    const bassTrack = tracks.find(t => t.pitchMax < 55 && t.noteDensity > 1);
    const bassDensity = bassTrack ? bassTrack.noteDensity : 0;

    Object.entries(GENRE_SIGNATURES).forEach(([genreKey, rules]) => {
        const genre = genreKey as MusicGenre;
        let score = 0;

        if (bpm >= rules.minBpm && bpm <= rules.maxBpm) {
            score += 50;
        } else if (bpm >= rules.minBpm - 2 && bpm <= rules.maxBpm + 2) {
            score += 20; 
        }

        if (bassDensity >= rules.bassDensityMin) {
            score += 30;
        } else if (bassDensity > 0) {
            score += 10;
        }

        if (score > highestScore) {
            highestScore = score;
            bestMatch = genre;
        }
    });

    const confidence = Math.min(1.0, highestScore / 80);
    return { genre: confidence > 0.5 ? bestMatch : null, confidence };
};

export const referenceAnalysisService = {
    analyzeMidi: async (file: File): Promise<StyleEngineProfile> => {
        const arrayBuffer = await file.arrayBuffer();
        const midi = new Midi(arrayBuffer);

        const ppq = midi.header.ppq || 480;
        const ticksPerBar = ppq * 4;
        const totalTicks = midi.durationTicks;
        
        const lengthBars = totalTicks / ticksPerBar;

        if (midi.tracks.length === 0) throw new Error("Invalid MIDI: No tracks found.");
        
        if (totalTicks === 0 || lengthBars < 0.1) throw new Error("Invalid MIDI: Duration too short.");

        const trackStats = midi.tracks.map(track => {
            const notes = track.notes;
            const noteCount = notes.length;
            
            const noteDensity = noteCount / Math.max(0.25, lengthBars);

            const rhythmMask16 = new Array(16).fill(0);
            const ticksPer16th = ppq / 4;
            
            notes.forEach(note => {
                const quantized16th = Math.round(note.ticks / ticksPer16th) % 16;
                rhythmMask16[quantized16th]++;
            });

            const maxVal = Math.max(...rhythmMask16) || 1;
            const normalizedMask = rhythmMask16.map(v => v / maxVal);

            let pitchMin = 127;
            let pitchMax = 0;
            let totalVel = 0;

            notes.forEach(n => {
                if (n.midi < pitchMin) pitchMin = n.midi;
                if (n.midi > pitchMax) pitchMax = n.midi;
                totalVel += n.velocity;
            });

            return {
                trackName: track.name || `Track ${track.channel + 1}`,
                noteDensity,
                rhythmMask16: normalizedMask,
                pitchMin: noteCount > 0 ? pitchMin : 0,
                pitchMax: noteCount > 0 ? pitchMax : 0,
                avgVelocity: noteCount > 0 ? totalVel / noteCount : 0,
                roleHint: 'UNKNOWN' as any,
                repetitionScore: 0
            };
        });

        const activeTracks = trackStats.filter(t => t.pitchMax > 0);
        
        const estimatedBpm = midi.header.tempos.length > 0 ? Math.round(midi.header.tempos[0].bpm) : 140;
        const detection = detectGenre(estimatedBpm, activeTracks);

        const noteDensityAvg = activeTracks.reduce((sum, t) => sum + t.noteDensity, 0) / (activeTracks.length || 1);
        const velocityAvg = activeTracks.reduce((sum, t) => sum + t.avgVelocity, 0) / (activeTracks.length || 1);
        let minPitch = 127;
        let maxPitch = 0;
        activeTracks.forEach(t => {
            if (t.pitchMin < minPitch) minPitch = t.pitchMin;
            if (t.pitchMax > maxPitch) maxPitch = t.pitchMax;
        });

        return {
            bpmEstimate: estimatedBpm,
            bpmConfidence: detection.confidence,
            noteDensityAvg,
            velocityAvg,
            syncopationScore: 0.5,
            pitchRange: { min: minPitch === 127 ? 0 : minPitch, max: maxPitch === 0 ? 127 : maxPitch },
            trackStats: activeTracks,
            detectedGenre: detection.genre || undefined
        };
    },

    // V84 NEW: Statistical Extraction for Governance
    extractGovernanceStats: async (file: File): Promise<ReferenceProfileStats> => {
        const arrayBuffer = await file.arrayBuffer();
        const midi = new Midi(arrayBuffer);
        const ppq = midi.header.ppq || 480;
        const ticksPerBar = ppq * 4;
        
        // 1. Find Lead Candidate (Highest note density in mid-high range)
        let leadTrack = midi.tracks[0];
        let maxScore = -1;

        midi.tracks.forEach(t => {
            if(t.channel === 9 || t.instrument.percussion) return; // Skip drums
            const notes = t.notes;
            if(notes.length < 10) return;
            
            const avgPitch = notes.reduce((s, n) => s + n.midi, 0) / notes.length;
            if(avgPitch < 55) return; // Bass

            const density = notes.length / (midi.durationTicks / ticksPerBar);
            if(density > maxScore) {
                maxScore = density;
                leadTrack = t;
            }
        });

        // 2. Calculate Scarcity (Avg Gap between phrases)
        let totalGapBars = 0;
        let gapCount = 0;
        const notes = leadTrack.notes;
        
        for(let i = 1; i < notes.length; i++) {
            const gapTicks = notes[i].ticks - (notes[i-1].ticks + notes[i-1].durationTicks);
            const gapBars = gapTicks / ticksPerBar;
            if(gapBars > 1) { // Only count gaps > 1 bar
                totalGapBars += gapBars;
                gapCount++;
            }
        }
        
        const leadScarcity = gapCount > 0 ? (totalGapBars / gapCount) : 0;

        // 3. Dominant Element
        let dominantElement: ReferenceProfileStats['dominantElement'] = 'LEAD';
        const hasAcid = midi.tracks.some(t => t.name.toLowerCase().includes('acid') || t.name.toLowerCase().includes('303'));
        if(hasAcid) dominantElement = 'ACID';
        else if(maxScore > 8) dominantElement = 'ARP'; // High density likely arp

        // 4. Energy Profile
        const energyProfile = leadScarcity > 8 ? 'PEAKY' : (leadScarcity > 2 ? 'DYNAMIC' : 'CONSISTENT');

        return {
            filename: file.name,
            leadScarcity: parseFloat(leadScarcity.toFixed(1)),
            avgDensity: parseFloat(Math.min(1.0, maxScore / 16).toFixed(2)),
            dominantElement,
            phraseLengthBars: 8, // Heuristic default, hard to extract accurately without ML
            energyProfile,
            timestamp: Date.now()
        };
    }
};
