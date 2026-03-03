
import { MusicGenre, BpmMode, ProfileParameters, ProfileVersion, StyleBlueprint } from '../types';

export type StyleProfileKey = 'FULL_ON' | 'PSY_POWER' | 'GOA' | 'MELODIC_TECHNO' | 'TECHNO';

/* Fix: Added versionHistory to StyleProfile interface to satisfy EngineOptimizationDashboard.tsx */
export interface StyleProfile {
    id: StyleProfileKey;
    label: string;
    engineGenre: MusicGenre; 
    blueprint: StyleBlueprint;
    parameters: ProfileParameters; 
    versionHistory: ProfileVersion[];
}

const DEFAULT_PARAMS: ProfileParameters = {
    swing: 0, grooveIntensity: 0.8, padPresence: 0.5, hookProbability: 0.6,
    midBassWeight: 0.5, arpVariation: 0.5, breakdownDensity: 0.5, peakContrast: 0.8
};

/* Fix: Helper to create initial factory version for history */
const getInitialHistory = (params: ProfileParameters): ProfileVersion[] => [{
    versionId: 'v1.0-factory',
    timestamp: Date.now(),
    parameters: { ...params },
    changeLog: 'Factory default profile initialized.',
    ratingAvg: 0,
    generationCount: 0
}];

export const STYLE_PROFILES: Record<StyleProfileKey, StyleProfile> = {
    'FULL_ON': {
        id: 'FULL_ON', label: 'Full-On Psytrance', engineGenre: MusicGenre.PSYTRANCE_FULLON,
        blueprint: { name: "FULL_ON", scale: [0, 1, 3, 5, 7, 8, 10], tempo: { min: 142, max: 148, default: 145 }, density: 0.95, repetition: 0.8, aggression: 0.9, movement: 0.8, groove: 0.9, motifLength: 16, legatoAmount: 0.8, minNoteDurationTicks: 120, maxGapAllowedTicks: 480, structure: { introBars: 32, buildBars: 32, peakBars: 64, outroBars: 32 }, feel: { hypnotic: true, aggressive: true, melodic: true } },
        parameters: { ...DEFAULT_PARAMS },
        versionHistory: getInitialHistory(DEFAULT_PARAMS)
    },
    'PSY_POWER': {
        id: 'PSY_POWER', label: 'Psytrance (Power)', engineGenre: MusicGenre.PSYTRANCE_POWER,
        blueprint: { name: "PSY_POWER", scale: [0, 1, 3, 5, 7, 8, 10], tempo: { min: 140, max: 146, default: 144 }, density: 0.85, repetition: 0.75, aggression: 0.7, movement: 0.75, groove: 0.8, motifLength: 16, legatoAmount: 0.5, minNoteDurationTicks: 120, maxGapAllowedTicks: 480, structure: { introBars: 32, buildBars: 32, peakBars: 64, outroBars: 32 }, feel: { hypnotic: true, aggressive: true, melodic: true } },
        parameters: { ...DEFAULT_PARAMS },
        versionHistory: getInitialHistory(DEFAULT_PARAMS)
    },
    'GOA': {
        id: 'GOA', label: 'Goa Trance', engineGenre: MusicGenre.GOA_TRANCE,
        blueprint: { name: "GOA", scale: [0, 1, 3, 5, 7, 8, 10], tempo: { min: 142, max: 146, default: 145 }, density: 0.8, repetition: 0.7, aggression: 0.6, movement: 0.9, groove: 0.7, motifLength: 16, legatoAmount: 0.6, minNoteDurationTicks: 120, maxGapAllowedTicks: 480, structure: { introBars: 32, buildBars: 32, peakBars: 48, outroBars: 32 }, feel: { hypnotic: true, aggressive: false, melodic: true } },
        parameters: { ...DEFAULT_PARAMS },
        versionHistory: getInitialHistory(DEFAULT_PARAMS)
    },
    'MELODIC_TECHNO': {
        id: 'MELODIC_TECHNO', label: 'Melodic Techno', engineGenre: MusicGenre.MELODIC_TECHNO,
        blueprint: { name: "MELODIC_TECHNO", scale: [0, 2, 3, 5, 7, 8, 10], tempo: { min: 122, max: 128, default: 125 }, density: 0.5, repetition: 0.6, aggression: 0.3, movement: 0.7, groove: 0.6, motifLength: 32, legatoAmount: 0.9, minNoteDurationTicks: 480, maxGapAllowedTicks: 960, structure: { introBars: 32, buildBars: 64, peakBars: 64, outroBars: 32 }, feel: { hypnotic: true, aggressive: false, melodic: true } },
        parameters: { ...DEFAULT_PARAMS, padPresence: 0.9 },
        versionHistory: getInitialHistory({ ...DEFAULT_PARAMS, padPresence: 0.9 })
    },
    'TECHNO': {
        id: 'TECHNO', label: 'Techno (Peak)', engineGenre: MusicGenre.TECHNO_PEAK,
        blueprint: { name: "TECHNO", scale: [0, 3, 5, 7, 10], tempo: { min: 130, max: 135, default: 132 }, density: 0.6, repetition: 0.95, aggression: 0.8, movement: 0.4, groove: 0.95, motifLength: 16, legatoAmount: 0.3, minNoteDurationTicks: 60, maxGapAllowedTicks: 960, structure: { introBars: 64, buildBars: 64, peakBars: 128, outroBars: 64 }, feel: { hypnotic: true, aggressive: true, melodic: false } },
        parameters: { ...DEFAULT_PARAMS },
        versionHistory: getInitialHistory(DEFAULT_PARAMS)
    }
};

export const getProfileForGenre = (genre: MusicGenre): StyleProfile => {
    const entry = Object.values(STYLE_PROFILES).find((p: any) => p.engineGenre === genre);
    return (entry as StyleProfile) || STYLE_PROFILES['FULL_ON'];
};

/* Fix: Added rollbackProfile function required by EngineOptimizationDashboard.tsx */
export const rollbackProfile = (id: StyleProfileKey) => {
    const profile = STYLE_PROFILES[id];
    if (profile.versionHistory.length > 1) {
        profile.versionHistory.pop();
        const prev = profile.versionHistory[profile.versionHistory.length - 1];
        profile.parameters = { ...prev.parameters };
    }
};

/* Fix: Added resetProfileToFactory function required by EngineOptimizationDashboard.tsx */
export const resetProfileToFactory = (id: StyleProfileKey) => {
    const profile = STYLE_PROFILES[id];
    const factory = profile.versionHistory[0];
    profile.versionHistory = [factory];
    profile.parameters = { ...factory.parameters };
};
