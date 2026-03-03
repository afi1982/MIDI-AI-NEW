
import { ReferenceMidiFile, GenreEngineProfile, MusicGenre } from '../types';

const STORAGE_KEY_REFS = 'TRANCEGEN_REFS_V1';
const STORAGE_KEY_GENRE_ENGINE = 'TRANCEGEN_GENRE_ENGINE_V1';

export const referenceStorageService = {
    // --- CRUD ---
    getAllReferences: (): ReferenceMidiFile[] => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_REFS);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error("Failed to load references", e);
            return [];
        }
    },

    saveReference: (ref: ReferenceMidiFile) => {
        const refs = referenceStorageService.getAllReferences();
        const existingIdx = refs.findIndex(r => r.id === ref.id);
        
        if (existingIdx >= 0) refs[existingIdx] = ref;
        else refs.unshift(ref); // Add to top

        localStorage.setItem(STORAGE_KEY_REFS, JSON.stringify(refs.slice(0, 100))); // Limit 100
        
        // Auto-rebuild genre engine if analyzed
        if (ref.analysisStatus === 'ANALYZED') {
            referenceStorageService.rebuildGenreEngineProfile(ref.genreTag);
        }
    },

    deleteReference: (id: string) => {
        const refs = referenceStorageService.getAllReferences();
        const updated = refs.filter(r => r.id !== id);
        localStorage.setItem(STORAGE_KEY_REFS, JSON.stringify(updated));
    },

    // --- AGGREGATION ---
    getGenreEngineProfile: (genre: string): GenreEngineProfile | null => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_GENRE_ENGINE);
            const allProfiles: Record<string, GenreEngineProfile> = raw ? JSON.parse(raw) : {};
            return allProfiles[genre] || null;
        } catch (e) {
            return null;
        }
    },

    rebuildGenreEngineProfile: (genre: string): GenreEngineProfile | null => {
        const refs = referenceStorageService.getAllReferences().filter(
            r => r.genreTag === genre && r.analysisStatus === 'ANALYZED' && r.analysisResult
        );

        if (refs.length === 0) return null;

        let totalLeadDensity = 0;
        let totalBassDensity = 0;
        let rhythmAggregator = new Array(16).fill(0);
        let minPitch = 127;
        let maxPitch = 0;
        let leadCount = 0;
        let bassCount = 0;

        refs.forEach(ref => {
            const profile = ref.analysisResult!;
            
            profile.trackStats.forEach(track => {
                // Heuristic Role Detection
                const isBass = track.pitchMax < 55 && track.noteDensity > 2; // Rough heuristic
                const isLead = track.pitchMin > 60 && track.noteDensity > 1;

                if (isBass) {
                    totalBassDensity += track.noteDensity;
                    bassCount++;
                } else if (isLead) {
                    totalLeadDensity += track.noteDensity;
                    leadCount++;
                    
                    // Add to Rhythm Mask (weighted by density)
                    track.rhythmMask16.forEach((val, idx) => {
                        rhythmAggregator[idx] += val;
                    });

                    if (track.pitchMin < minPitch) minPitch = track.pitchMin;
                    if (track.pitchMax > maxPitch) maxPitch = track.pitchMax;
                }
            });
        });

        // Normalize
        const avgLeadDensity = leadCount > 0 ? totalLeadDensity / leadCount : 0.5; // fallback
        const avgBassDensity = bassCount > 0 ? totalBassDensity / bassCount : 0.8; // fallback
        
        // Normalize Rhythm Mask
        const maxMaskVal = Math.max(...rhythmAggregator) || 1;
        const normalizedMask = rhythmAggregator.map(v => v / maxMaskVal);

        const profile: GenreEngineProfile = {
            genreTag: genre,
            avgLeadDensity,
            avgBassDensity,
            rhythmMask16: normalizedMask,
            pitchRange: { min: minPitch === 127 ? 60 : minPitch, max: maxPitch === 0 ? 84 : maxPitch },
            updatedAt: Date.now(),
            sampleCount: refs.length
        };

        // Save
        const raw = localStorage.getItem(STORAGE_KEY_GENRE_ENGINE);
        const allProfiles: Record<string, GenreEngineProfile> = raw ? JSON.parse(raw) : {};
        allProfiles[genre] = profile;
        localStorage.setItem(STORAGE_KEY_GENRE_ENGINE, JSON.stringify(allProfiles));

        return profile;
    }
};
