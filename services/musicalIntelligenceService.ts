
import { NoteEvent, ChannelKey } from '../types';

/**
 * MUSICAL INTELLIGENCE ENGINE V113
 * Implements "Musical Phrasing" over "Linear MIDI".
 */
export const musicalIntelligenceService = {
    
    applyV113Intelligence: (notes: NoteEvent[], channel: ChannelKey, barIndex: number): NoteEvent[] => {
        if (!notes || notes.length === 0) return [];
        
        // Deep clone to avoid mutating references before assignment
        let processed = notes.map(n => ({...n}));

        const isKick = channel.includes('kick');
        const isBass = channel.includes('sub') || channel.includes('mid');
        const isLead = channel.includes('lead') || channel.includes('acid') || channel.includes('arp');
        
        // --- 1. HEURISTIC VELOCITY MAPPING (Dynamics) ---
        // V113 Requirement: "Velocity Curves" instead of static values.
        processed.forEach((note) => {
            const p = note.time.split(':').map(Number);
            const sixteenth = (p[1] * 4) + p[2]; // 0-15

            if (isLead) {
                // Logic: Crescendo over 4-bar phrases (Anyma Style)
                const phrasePos = barIndex % 4; 
                // Slight boost (1.0 to 1.15) over the phrase
                const dynamics = 1.0 + (phrasePos * 0.04); 
                
                // Logic: Off-beat Drive (Psytrance Style)
                // Accenting the "and" of the beat (2, 6, 10, 14)
                const isOffbeat = [2, 6, 10, 14].includes(sixteenth);
                const accent = isOffbeat ? 1.12 : 0.95;
                
                note.velocity = Math.min(1.0, Math.max(0.1, note.velocity * dynamics * accent));
                note.velocity = Number(note.velocity.toFixed(2));
            } 
            else if (isBass) {
                // Logic: Rolling Bass "Suction"
                // Downbeats (0, 4, 8, 12) are slightly tucked under the kick or previous note to create groove
                const isDownbeat = sixteenth % 4 === 0;
                note.velocity = isDownbeat ? 0.88 : 0.98; 
            }
        });

        // --- 2. ADAPTIVE GATE LOGIC (The "Breath" Factor) ---
        // V113 Requirement: Vary note length based on grid position.
        processed.forEach((note) => {
            const p = note.time.split(':').map(Number);
            const sixteenth = (p[1] * 4) + p[2];

            // End of Bar Breath (Short Release)
            if (sixteenth === 15) {
                note.durationTicks = Math.round((note.durationTicks || 120) * 0.4); 
            }
            // Downbeat Anchor (Legato/Hold)
            else if (sixteenth === 0) {
                note.durationTicks = Math.round((note.durationTicks || 120) * 1.1); // 10% Overlap
            }
        });

        // --- 3. HARMONIC RICHNESS (Ghost Notes) ---
        // V113 Requirement: Add low velocity notes for texture.
        // Only apply to leads/arps to avoid muddying the low end.
        if (isLead && processed.length > 0) {
             // 40% chance per bar to inject ghost layer
             if (Math.random() < 0.4) {
                 const strongNotes = processed.filter(n => n.velocity > 0.6);
                 if (strongNotes.length > 0) {
                     const source = strongNotes[Math.floor(Math.random() * strongNotes.length)];
                     
                     // Create Ghost
                     const ghost: NoteEvent = { ...source };
                     ghost.velocity = 0.25; // Very soft background texture
                     
                     // Shift Octave Down
                     const noteStr = Array.isArray(ghost.note) ? ghost.note[0] : ghost.note;
                     const match = noteStr.match(/([A-G][#b]?)(\d+)/);
                     if (match) {
                         const noteName = match[1];
                         const oct = parseInt(match[2]);
                         if (oct > 2) {
                             ghost.note = `${noteName}${oct - 1}`;
                             // Keep same time for layering (unison/octave stack)
                             processed.push(ghost);
                         }
                     }
                 }
             }
        }

        // --- 4. MICRO-TIMING JITTER (Humanization) ---
        // V113 Requirement: 2ms-7ms offset (approx 5-15 ticks at 145BPM).
        if (!isKick) { // Kick must stay locked to grid
            processed.forEach(note => {
                // Random jitter between 2 and 12 ticks
                const jitter = Math.floor(2 + Math.random() * 10); 
                // Apply half positive, half negative roughly, but favor "dragging" (late) slightly for groove
                const offset = Math.random() > 0.4 ? jitter : -jitter;
                
                note.startTick = (note.startTick || 0) + offset;
                note.tickOffset = offset; // Store for QA visibility
            });
        }

        return processed;
    }
};
