
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Map flats to sharps for internal consistency (Normalized to UPPERCASE keys)
const ENHARMONIC_MAP: Record<string, string> = {
    'DB': 'C#', 'EB': 'D#', 'GB': 'F#', 'AB': 'G#', 'BB': 'A#',
    'C_SHARP': 'C#', 'F_SHARP': 'F#' // Safety aliases
};

export const theoryEngine = {
    normalizeNote: (note: string): string => {
        if (!note) return 'C';
        const clean = note.toUpperCase().replace(/\s+/g, '');
        
        // Try exact match in map first
        if (ENHARMONIC_MAP[clean]) return ENHARMONIC_MAP[clean];

        // Or just return Title Case
        if (clean.length > 1 && (clean[1] === '#' || clean[1] === 'B')) {
            return clean.substring(0, 2);
        }
        return clean.substring(0, 1);
    },

    getMidiNote: (note: string): number => {
        if (!note) return 60; // Default Middle C if empty
        
        // 1. Clean input: Remove spaces, convert to UpperCase ("f# 3" -> "F#3")
        const clean = note.toUpperCase().replace(/[^A-Z0-9#]/g, ''); 
        
        // 2. Identify Note Name (Greedy Match)
        // We sort NOTE_NAMES by length descending so "F#" (len 2) matches before "F" (len 1)
        const sortedNames = [...NOTE_NAMES].sort((a,b) => b.length - a.length);
        
        let pitchName = '';
        let rest = '';
        
        // Check Standard Names
        for (const name of sortedNames) {
            if (clean.startsWith(name)) {
                pitchName = name;
                rest = clean.slice(name.length);
                break;
            }
        }
        
        // Check Enharmonics (e.g. "DB3") if no standard name found
        if (!pitchName) {
            const enharmonics = Object.keys(ENHARMONIC_MAP);
            for (const enh of enharmonics) {
                if (clean.startsWith(enh)) {
                    pitchName = ENHARMONIC_MAP[enh];
                    rest = clean.slice(enh.length);
                    break;
                }
            }
        }

        // FAIL-SAFE: If still no pitch name found, default to C but log warning
        if (!pitchName) {
            console.warn(`[TheoryEngine] Could not parse note: "${note}". Defaulting to 60 (C4).`);
            return 60;
        }

        // 3. Identify Octave
        // Default to octave 3 if no number provided (Standard Producer Octave)
        let octave = 3; 
        const octaveMatch = rest.match(/^-?\d+/);
        if (octaveMatch) {
            octave = parseInt(octaveMatch[0]);
        }

        // 4. Calculate MIDI
        const idx = NOTE_NAMES.indexOf(pitchName);
        return (octave + 1) * 12 + idx;
    },

    midiToNote: (midi: number): string => {
        const octave = Math.floor(midi / 12) - 1;
        const name = NOTE_NAMES[midi % 12];
        return `${name}${octave}`;
    },

    getScaleIntervals: (scaleName: string): number[] => {
        const s = scaleName.toLowerCase().replace(/[\s-]/g, '');
        
        if (s.includes('major')) return [0, 2, 4, 5, 7, 9, 11];
        if (s.includes('minor') || s.includes('aeolian')) return [0, 2, 3, 5, 7, 8, 10];
        if (s.includes('phrygian')) {
            if (s.includes('dominant')) return [0, 1, 4, 5, 7, 8, 10]; // Exotic
            return [0, 1, 3, 5, 7, 8, 10]; // Psytrance Standard
        }
        if (s.includes('dorian')) return [0, 2, 3, 5, 7, 9, 10];
        if (s.includes('lydian')) return [0, 2, 4, 6, 7, 9, 11];
        if (s.includes('harmonic')) return [0, 2, 3, 5, 7, 8, 11];
        if (s.includes('chromatic')) return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        
        return [0, 2, 3, 5, 7, 8, 10]; // Default to Minor
    },

    // NEW: Get valid Pitch Classes (0-11) for a Key/Scale
    getScalePitchClasses: (root: string, scaleName: string): number[] => {
        // Use the robust getMidiNote to find root pitch class
        const rootMidi = theoryEngine.getMidiNote(`${root}1`); 
        const rootIdx = rootMidi % 12;

        const intervals = theoryEngine.getScaleIntervals(scaleName);
        return intervals.map(i => (rootIdx + i) % 12);
    },

    getScaleNotes: (root: string, scaleName: string): string[] => {
        const rootMidi = theoryEngine.getMidiNote(`${root}1`);
        const rootIdx = rootMidi % 12;
        const intervals = theoryEngine.getScaleIntervals(scaleName);
        return intervals.map(i => NOTE_NAMES[(rootIdx + i) % 12]);
    },

    isNoteInScale: (note: string, root: string, scaleName: string): boolean => {
        if (!note) return true;
        const midi = theoryEngine.getMidiNote(note);
        const pc = midi % 12;
        const allowedPCs = theoryEngine.getScalePitchClasses(root, scaleName);
        return allowedPCs.includes(pc);
    },

    // NEW: Robust Mathematical Snapping
    snapMidiToScale: (midi: number, root: string, scaleName: string): number => {
        const allowedPCs = theoryEngine.getScalePitchClasses(root, scaleName);
        const pc = midi % 12;
        
        if (allowedPCs.includes(pc)) return midi;

        // Find closest valid neighbor
        let minDiff = 12;
        let bestPC = pc;

        allowedPCs.forEach(targetPC => {
            // Calculate distance in a circle (mod 12)
            let diff = Math.abs(targetPC - pc);
            if (diff > 6) diff = 12 - diff; // Wrap around

            if (diff < minDiff) {
                minDiff = diff;
                bestPC = targetPC;
            }
        });

        // Apply the difference to the original MIDI note
        // We need to determine if we go up or down
        let result = midi + (bestPC - pc);
        // Correct for wrap-around errors (e.g. B -> C)
        if (Math.abs(result - midi) > 6) {
            if (result > midi) result -= 12;
            else result += 12;
        }
        
        return result;
    },

    getClosestNoteInScale: (note: string, root: string, scaleName: string): string => {
        const midi = theoryEngine.getMidiNote(note);
        const snappedMidi = theoryEngine.snapMidiToScale(midi, root, scaleName);
        return theoryEngine.midiToNote(snappedMidi);
    }
};
