
import { GrooveObject } from '../types';

interface GlossaryTerm {
    term: string;
    definition: string;
    contextParams: string[];
}

const GLOSSARY_DB: Record<string, GlossaryTerm> = {
    'scale': {
        term: 'Musical Scale',
        definition: "Your track is currently in {key} {scale}. This defines the emotional 'color'. For Psytrance, Phrygian creates a dark, hypnotic tension.",
        contextParams: ['key', 'scale']
    },
    'phrygian': {
        term: 'Phrygian Mode',
        definition: "A scale mode with a flattened 2nd note (semitone above root). In {key}, this means the notes {key} and {key+1} are adjacent, creating the classic 'Psy' darkness.",
        contextParams: ['key']
    },
    'velocity': {
        term: 'Velocity',
        definition: "Controls how 'hard' a note is struck (0-127). V49 uses this to create 'Humanization'. Your Lead A varies velocity between 0.7 and 1.0 to avoid sounding robotic.",
        contextParams: []
    },
    'cutoff': {
        term: 'Filter Cutoff (CC74)',
        definition: "The most important automation in Trance. Opening the filter lets high frequencies through (Energy Up). Closing it muffles the sound (Energy Down). Map MIDI CC 74 to your synth's filter.",
        contextParams: []
    },
    'sidechain': {
        term: 'Sidechain Compression',
        definition: "Ducking the volume of the Bass/Leads whenever the Kick hits. In a {bpm} BPM track, this creates the 'pumping' rhythm essential for the genre.",
        contextParams: ['bpm']
    },
    'jitter': {
        term: 'Micro-Timing (Jitter)',
        definition: "Small timing deviations. V49 applies 2% jitter to your hi-hats so they don't sound perfectly computerized.",
        contextParams: []
    },
    'euclidean': {
        term: 'Euclidean Rhythm',
        definition: "An algorithm that distributes hits as evenly as possible. Your 'Tribal Perc' (Ch 11) uses this to create polyrhythms against the 4/4 Kick.",
        contextParams: []
    },
    'bpm': {
        term: 'BPM',
        definition: "Beats Per Minute. Your project is locked to {bpm} BPM, which is standard for {genre}.",
        contextParams: ['bpm', 'genre']
    }
};

export const glossaryService = {
    query: (input: string, groove: GrooveObject): string | null => {
        const lowerInput = input.toLowerCase();
        
        // Find matching key
        const matchKey = Object.keys(GLOSSARY_DB).find(k => lowerInput.includes(k));
        
        if (!matchKey) return null;

        const entry = GLOSSARY_DB[matchKey];
        let response = entry.definition;

        // Context Injection
        response = response.replace(/{key}/g, groove.key || "C");
        response = response.replace(/{scale}/g, groove.scale || "Minor");
        response = response.replace(/{bpm}/g, groove.bpm?.toString() || "140");
        response = response.replace(/{genre}/g, groove.genre || "Psytrance");
        response = response.replace(/{key\+1}/g, "the Flat 2nd"); // Simplified logic for demo

        return response;
    }
};
