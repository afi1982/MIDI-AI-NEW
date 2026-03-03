import { MusicGenre } from './types';
import { referenceStorageService } from './services/referenceStorageService';

export const EMOTIONAL_PRESETS_V1: Record<string, any> = {
  "PSYTRANCE_FULLON": {
    "bpmRange": [142, 148],
    "scalePrefs": ["Phrygian", "PhrygianDominant", "Aeolian"],
    "timeline": [
      { "section": "INTRO", "bars": 16, "emotion": "TENSION",  "intensity": 0.55 },
      { "section": "BUILD", "bars": 16, "emotion": "GROOVE",   "intensity": 0.70 },
      { "section": "DROP",  "bars": 32, "emotion": "GROOVE",   "intensity": 0.78 },
      { "section": "BREAK", "bars": 16, "emotion": "RELEASE",  "intensity": 0.52 },
      { "section": "PEAK",  "bars": 32, "emotion": "EUPHORIA", "intensity": 0.92 },
      { "section": "OUTRO", "bars": 16, "emotion": "RELEASE",  "intensity": 0.45 }
    ],
    "leadRules": {
      "velocity": { "TENSION": [0.55,0.72], "GROOVE":[0.65,0.85], "RELEASE":[0.45,0.65], "EUPHORIA":[0.82,1.0], "CONTRAST":[0.7,0.9] },
      "intervalSemitones": { "TENSION":[1,3], "GROOVE":[1,5], "RELEASE":[2,5], "EUPHORIA":[4,9], "CONTRAST":[1,7] },
      "density": { "TENSION": [0.35,0.55], "GROOVE":[0.55,0.75], "RELEASE":[0.20,0.40], "EUPHORIA":[0.70,0.90], "CONTRAST":[0.5,0.8] },
      "phraseBars": { "INTRO": 8, "DROP": 4, "PEAK": 4 }
    },
    "bassRules": {
      "grid": "1/16",
      "quantize": 0.92,
      "velocity": [0.75, 0.95],
      "holeMaxBeats": 0.0
    },
    "kickRules": { "quantize": 1.0, "velocity": [0.85, 1.0] },
    "antiClash": { "maxLeadOverlapPct": 0.15, "octaveSeparation": true },
    "peakTypeWeights": { "MELODIC": 0.55, "ENERGY": 0.35, "CONTRAST": 0.10 }
  },

  "TECHNO_PEAK": {
    "bpmRange": [128, 135],
    "scalePrefs": ["Minor", "Dorian", "Phrygian"],
    "timeline": [
      { "section": "INTRO", "bars": 32, "emotion": "GROOVE",   "intensity": 0.55 },
      { "section": "BUILD", "bars": 32, "emotion": "TENSION",  "intensity": 0.70 },
      { "section": "DROP",  "bars": 32, "emotion": "GROOVE",   "intensity": 0.75 },
      { "section": "BREAK", "bars": 16, "emotion": "RELEASE",  "intensity": 0.50 },
      { "section": "PEAK",  "bars": 32, "emotion": "TENSION",  "intensity": 0.85 },
      { "section": "OUTRO", "bars": 32, "emotion": "RELEASE",  "intensity": 0.40 }
    ],
    "leadRules": {
      "velocity": { "TENSION": [0.55,0.75], "GROOVE":[0.55,0.78], "RELEASE":[0.40,0.60], "EUPHORIA":[0.70,0.90], "CONTRAST":[0.6,0.8] },
      "intervalSemitones": { "TENSION":[1,2], "GROOVE":[1,3], "RELEASE":[1,3], "EUPHORIA":[2,5], "CONTRAST":[1,2] },
      "density": { "TENSION": [0.25,0.45], "GROOVE":[0.25,0.50], "RELEASE":[0.15,0.30], "EUPNOSAURE": [0.35,0.60], "CONTRAST":[0.3,0.5] },
      "monophonic": true
    },
    "bassRules": { "grid": "1/16", "quantize": 0.95, "velocity": [0.70, 0.90] },
    "kickRules": { "quantize": 1.0, "velocity": [0.90, 1.0] },
    "antiClash": { "maxLeadOverlapPct": 0.10, "octaveSeparation": true },
    "peakTypeWeights": { "MELODIC": 0.20, "ENERGY": 0.65, "CONTRAST": 0.15 }
  },

  "PROGRESSIVE_TRANCE": {
    "bpmRange": [130, 138],
    "scalePrefs": ["Aeolian", "Dorian", "Major"],
    "timeline": [
      { "section": "INTRO", "bars": 32, "emotion": "RELEASE",  "intensity": 0.45 },
      { "section": "BUILD", "bars": 32, "emotion": "TENSION",  "intensity": 0.65 },
      { "section": "DROP",  "bars": 32, "emotion": "EUPHORIA", "intensity": 0.82 },
      { "section": "BREAK", "bars": 32, "emotion": "RELEASE",  "intensity": 0.50 },
      { "section": "PEAK",  "bars": 32, "emotion": "EUPHORIA", "intensity": 0.92 },
      { "section": "OUTRO", "bars": 32, "emotion": "RELEASE",  "intensity": 0.40 }
    ],
    "leadRules": {
      "velocity": { "TENSION": [0.55,0.75], "GROOVE":[0.55,0.80], "RELEASE":[0.45,0.70], "EUPHORIA":[0.80,1.0], "CONTRAST":[0.7,0.9] },
      "intervalSemitones": { "TENSION":[2,5], "GROOVE":[1,4], "RELEASE":[1,4], "EUPHORIA":[3,8], "CONTRAST":[2,6] },
      "density": { "TENSION": [0.20,0.40], "GROOVE":[0.35,0.55], "RELEASE":[0.15,0.30], "EUPHORIA":[0.45,0.70], "CONTRAST":[0.4,0.6] },
      "legatoBias": 0.7,
      "phraseBars": { "INTRO": 16, "DROP": 8, "PEAK": 8 }
    },
    "bassRules": { "grid": "1/8", "quantize": 0.90, "velocity": [0.65, 0.88] },
    "kickRules": { "quantize": 1.0, "velocity": [0.80, 0.95] },
    "antiClash": { "maxLeadOverlapPct": 0.12, "octaveSeparation": true },
    "peakTypeWeights": { "MELODIC": 0.70, "ENERGY": 0.20, "CONTRAST": 0.10 }
  },

  "DARK_PSY": {
    "bpmRange": [148, 155],
    "scalePrefs": ["Phrygian", "Locrian", "HarmonicMinor"],
    "timeline": [
      { "section": "INTRO", "bars": 16, "emotion": "TENSION",  "intensity": 0.60 },
      { "section": "BUILD", "bars": 16, "emotion": "TENSION",  "intensity": 0.78 },
      { "section": "DROP",  "bars": 32, "emotion": "GROOVE",   "intensity": 0.82 },
      { "section": "BREAK", "bars": 16, "emotion": "TENSION",  "intensity": 0.75 },
      { "section": "PEAK",  "bars": 32, "emotion": "CONTRAST", "intensity": 0.88 },
      { "section": "OUTRO", "bars": 16, "emotion": "RELEASE",  "intensity": 0.45 }
    ],
    "leadRules": {
      "velocity": { "TENSION": [0.55,0.78], "GROOVE":[0.60,0.85], "RELEASE":[0.45,0.65], "EUPHORIA":[0.75,0.95], "CONTRAST":[0.7,0.9] },
      "intervalSemitones": { "TENSION":[1,3], "GROOVE":[1,4], "RELEASE":[1,3], "EUPHORIA":[2,6], "CONTRAST":[1,5] },
      "density": { "TENSION": [0.15,0.35], "GROOVE":[0.25,0.45], "RELEASE":[0.10,0.25], "EUPHORIA":[0.25,0.55], "CONTRAST":[0.3,0.5] },
      "narrowRangeBias": 0.8
    },
    "bassRules": { "grid": "1/16", "quantize": 0.95, "velocity": [0.75, 0.95] },
    "kickRules": { "quantize": 1.0, "velocity": [0.90, 1.0] },
    "antiClash": { "maxLeadOverlapPct": 0.08, "octaveSeparation": true },
    "peakTypeWeights": { "MELODIC": 0.15, "ENERGY": 0.55, "CONTRAST": 0.30 }
  }
};

export const getPresetForGenre = (genre: MusicGenre) => {
    /* Fix: Updated keyMap to strictly strictly follow members of V16.0 IRON LIST defined in types.ts */
    const keyMap: Record<string, string> = {
        [MusicGenre.PSYTRANCE_FULLON]: "PSYTRANCE_FULLON",
        [MusicGenre.PSYTRANCE_POWER]: "PSYTRANCE_FULLON",
        [MusicGenre.TECHNO_PEAK]: "TECHNO_PEAK",
        [MusicGenre.GOA_TRANCE]: "PSYTRANCE_FULLON",
        // Fix: Changed non-existent MusicGenre.CLASSIC_TRANCE to MELODIC_TECHNO based on iron list from types.ts
        [MusicGenre.MELODIC_TECHNO]: "PROGRESSIVE_TRANCE"
    };
    
    // 1. Load Factory Preset
    const presetKey = keyMap[genre] || "PSYTRANCE_FULLON";
    const factoryPreset = JSON.parse(JSON.stringify(EMOTIONAL_PRESETS_V1[presetKey]));

    // Fix: Inject Default Variation Policy if missing (Prevents 'maxChangedNotes' undefined error)
    if (!factoryPreset.variation) {
        factoryPreset.variation = {
            transposeDegreesMax: 2,
            allowInversion: true,
            rhythmShiftMax16th: 1,
            durationJitter16th: 0.1,
            velocityJitter: 0.1,
            maxChangedNotes: 2
        };
    }

    // 2. Engine Profile Injection (Additive Logic)
    // Check if we have learned engine profile for this genre
    const profile = referenceStorageService.getGenreEngineProfile(genre);
    
    if (profile) {
        console.log(`[Preset Service] Injecting Engine Profile for ${genre} (Samples: ${profile.sampleCount})`);
        
        // A. Inject Lead Density
        // Adjust the ranges based on learned average
        const baseDensity = profile.avgLeadDensity;
        if (baseDensity > 0) {
            factoryPreset.leadRules.density.GROOVE = [Math.max(0, baseDensity - 0.1), Math.min(1, baseDensity + 0.1)];
            factoryPreset.leadRules.density.EUPHORIA = [Math.max(0, baseDensity), Math.min(1, baseDensity + 0.2)];
        }

        // B. Inject Rhythm Bias
        factoryPreset.rhythmBias = profile.rhythmMask16; 
    }

    return factoryPreset;
};