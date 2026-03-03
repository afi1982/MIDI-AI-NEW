
import { NoteEvent, GenreEngineProfile, MusicGenre } from '../types';
import { theoryEngine } from './theoryEngine';

const TICKS_PER_16TH = 120;

export type ComplexityLevel = 'SIMPLE' | 'COMPLEX';

export const melodicComposer = {
    
    // --- MOTIF LOGIC ---
    
    createMotif(length: number = 16, range: number = 7, genre: string = 'Psytrance', engineProfile?: GenreEngineProfile): number[] {
        const motif = [];
        
        // DEFAULT DENSITY MAPS (Fallback if Engine is Empty)
        let densityMap = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]; 
        
        if (genre.includes('Techno')) {
            densityMap = [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0];
        } else if (genre.includes('Goa')) {
            densityMap = [1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0];
        } else if (genre.includes('Full-On') || genre.includes('Power')) {
            densityMap = [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0];
        }

        // --- ENGINE ENFORCEMENT LOGIC ---
        // If we have an engine profile, we use it for rhythmic guidance.
        const useEngineMask = engineProfile && engineProfile.rhythmMask16 && engineProfile.rhythmMask16.length > 0;
        const rhythmMask = useEngineMask ? engineProfile.rhythmMask16 : densityMap;
        
        // If using Engine Profile, boost confidence to nearly 100% to follow the learned style.
        const adherenceFactor = useEngineMask ? 0.95 : 0.8; 

        for (let i = 0; i < length; i++) {
            const isStrongBeat = i % 4 === 0;
            const maskValue = rhythmMask[i % 16] || 0;
            
            // Logic: If maskValue is high (learned from file), we almost certainly play a note.
            // If maskValue is low, we almost certainly silence it.
            let probability = maskValue * adherenceFactor;
            
            // Add slight variation only if NOT using engine mask
            if (!useEngineMask && isStrongBeat) probability += 0.2;

            const shouldPlay = Math.random() < probability;

            if (shouldPlay) {
                // Pitch Logic (Keep relative to key)
                if (isStrongBeat) {
                    const anchors = [0, 0, 2, 4, 7]; 
                    motif.push(anchors[Math.floor(Math.random() * anchors.length)]);
                } else {
                    motif.push(Math.floor(Math.random() * range));
                }
            } else {
                motif.push(-1); 
            }
        }
        return motif;
    },

    mutateMotif(motif: number[], range: number = 7): number[] {
        const newMotif = [...motif];
        const mutationCount = Math.max(1, Math.floor(motif.length * 0.25)); 
        for(let i=0; i<mutationCount; i++) {
            const idx = Math.floor(Math.random() * motif.length);
            if (newMotif[idx] !== -1) {
                const shift = Math.random() > 0.5 ? 1 : -1;
                newMotif[idx] = Math.max(0, Math.min(range, newMotif[idx] + shift));
            } else {
                if (Math.random() > 0.7) newMotif[idx] = Math.floor(Math.random() * range);
            }
        }
        return newMotif;
    },

    // --- GENERATION LOGIC ---

    generateBar(
        barIndex: number, 
        root: number, 
        scale: number[], 
        role: string, 
        motif?: number[], 
        isTransition?: boolean,
        complexity: ComplexityLevel = 'COMPLEX',
        genre: string = 'Psytrance', 
        engineProfile?: GenreEngineProfile,
        sessionMask?: number[] 
    ): NoteEvent[] {
        const events: NoteEvent[] = [];
        const baseTick = barIndex * 1920;
        let currentMotif = motif || [0, -1, 2, -1, 4, -1, 2, -1, 0, -1, 5, -1, 2, -1, 1, -1];
        const r = role.toUpperCase();

        // --- VELOCITY ENGINE INJECTION ---
        // If engine profile exists, use its average velocity as a baseline
        const baseVelocity = engineProfile ? Math.max(0.6, Math.min(0.95, engineProfile.avgLeadDensity || 0.8)) : 0.8;

        // --- KICK (Genre Specific) ---
        if (r.includes('KICK')) {
            const rootNote = theoryEngine.midiToNote(root);
            for (let step = 0; step < 16; step++) {
                let shouldHit = false;
                // 4-on-the-floor is standard for all these genres
                if (step % 4 === 0) shouldHit = true;
                
                if (complexity === 'COMPLEX' && genre.includes('Techno') && step === 15 && Math.random() > 0.8) {
                    shouldHit = true; // Occasional ghost kick
                }

                if (shouldHit) {
                    events.push({
                        note: rootNote,
                        time: `${barIndex}:${Math.floor(step/4)}:${step%4}`,
                        duration: "16n",
                        durationTicks: 120,
                        startTick: baseTick + (step * TICKS_PER_16TH),
                        velocity: step % 4 === 0 ? 0.95 : 0.7
                    });
                }
            }
        }

        // --- BASS & SUB (Genre Specific) ---
        else if (r.includes('BASS') || r.includes('SUB')) {
            const isSub = r.includes('SUB');
            const bassMidi = root; // Bass usually at root or root-12
            const rootNote = theoryEngine.midiToNote(bassMidi);
            
            for (let step = 0; step < 16; step++) {
                let shouldHit = false;
                let velocity = 0.85;

                if (genre.includes('Psytrance') || genre.includes('Goa')) {
                    // Standard Psytrance Rolling Bass: K B B B
                    // Step 0 is Kick, 1,2,3 are Bass
                    if (step % 4 !== 0) {
                        shouldHit = true;
                        if (complexity === 'SIMPLE' && step % 4 === 2) shouldHit = false; // Thinner bass for simple
                    }
                } else if (genre.includes('Techno')) {
                    if (complexity === 'SIMPLE') {
                        if (step % 4 === 2) shouldHit = true; // Simple offbeat
                    } else {
                        // More syncopated techno bass
                        if (step % 4 === 2 || step % 8 === 3 || step % 8 === 6) shouldHit = true;
                    }
                } else {
                    // Default offbeat
                    if (step % 4 !== 0 && step % 2 === 0) shouldHit = true;
                }

                if (shouldHit) {
                    events.push({
                        note: rootNote,
                        time: `${barIndex}:${Math.floor(step/4)}:${step%4}`,
                        duration: "16n",
                        durationTicks: 110,
                        startTick: baseTick + (step * TICKS_PER_16TH),
                        velocity: velocity
                    });
                }
            }
        }

        // --- SNARE & CLAP (Genre Specific) ---
        else if (r.includes('SNARE') || r.includes('CLAP')) {
            const isSnare = r.includes('SNARE');
            const rootNote = theoryEngine.midiToNote(root);

            for (let step = 0; step < 16; step++) {
                let shouldHit = false;
                let velocity = 0.95;

                // SIMPLE: Standard Backbeat (2 & 4)
                if (step === 4 || step === 12) shouldHit = true;

                if (complexity === 'COMPLEX') {
                    if (isSnare) {
                        if (genre.includes('Techno') && step % 4 === 0 && Math.random() > 0.8) shouldHit = true;
                        if (step >= 14 && Math.random() > 0.6) { shouldHit = true; velocity = 0.75; }
                    } else { 
                        if ((genre.includes('Full-On') || genre.includes('Goa')) && (step === 11 || step === 13) && Math.random() > 0.7) shouldHit = true;
                    }
                }

                if (shouldHit) {
                    events.push({
                        note: rootNote,
                        time: `${barIndex}:${Math.floor(step/4)}:${step%4}`,
                        duration: "16n",
                        durationTicks: 120,
                        startTick: baseTick + (step * TICKS_PER_16TH),
                        velocity: velocity
                    });
                }
            }
        }

        // --- HI-HATS (Genre Specific) ---
        else if (r.includes('HH') || r.includes('CLOSED')) {
            const rootNote = theoryEngine.midiToNote(root);
            // Use engine mask for HH if available (Techno rumble/groove often lives in HH patterns)
            const hhMask = engineProfile?.rhythmMask16 || null;

            for (let step = 0; step < 16; step++) {
                let shouldHit = false;
                let velocity = 0.75;

                if (hhMask && Math.random() < hhMask[step] * 0.9) {
                    shouldHit = true; // Use learned groove
                } else if (complexity === 'SIMPLE') {
                    if (step % 4 === 2) { shouldHit = true; velocity = 0.9; } 
                } else {
                    if (genre.includes('Techno')) {
                        shouldHit = true;
                        velocity = (step % 4 === 2) ? 0.9 : 0.7; 
                    } else {
                        shouldHit = true;
                        if (step % 4 === 2) velocity = 0.95;
                        else velocity = 0.7 + (Math.random() * 0.1);
                    }
                }

                if (shouldHit) {
                    events.push({
                        note: rootNote,
                        time: `${barIndex}:${Math.floor(step/4)}:${step%4}`,
                        duration: "16n",
                        durationTicks: 60,
                        startTick: baseTick + (step * TICKS_PER_16TH),
                        velocity: velocity
                    });
                }
            }
        }

        // --- PERCUSSION ---
        else if (r.includes('PERC')) {
            const offsets = [0, 3, 5, 7]; 
            
            for (let step = 0; step < 16; step++) {
                let shouldHit = false;
                let velocity = 0.8;
                let pitchOffset = 0;

                if (complexity === 'SIMPLE') {
                    if (step % 8 === 4) shouldHit = true; // Very sparse percussion
                } else {
                    if (genre.includes('Techno')) {
                        if (step % 4 !== 0 && Math.random() > 0.7) shouldHit = true;
                    } else {
                        const isPolyrhythm = step % 3 === 0;
                        if (isPolyrhythm || Math.random() > 0.6) {
                            shouldHit = true;
                            pitchOffset = offsets[Math.floor(Math.random() * offsets.length)];
                        }
                    }
                }

                if (shouldHit) {
                    events.push({
                        note: theoryEngine.midiToNote(root + pitchOffset),
                        time: `${barIndex}:${Math.floor(step/4)}:${step%4}`,
                        duration: "16n",
                        durationTicks: 80,
                        startTick: baseTick + (step * TICKS_PER_16TH),
                        velocity: Number(velocity.toFixed(2))
                    });
                }
            }
        }

        // --- LEAD / ARP / ACID (Melodic) ---
        else if (r.includes('LEAD') || r.includes('ARP') || r.includes('ACID') || r.includes('SYNTH')) {
            const isArp = r.includes('ARP');
            const isAcid = r.includes('ACID');

            for (let step = 0; step < 16; step++) {
                const noteIndex = currentMotif[step % currentMotif.length];
                
                // FORCE: If motif has a note (derived from engine), we play it.
                if (noteIndex === -1) continue; 

                const scaleDegree = noteIndex % scale.length;
                const octaveShift = Math.floor(noteIndex / scale.length);
                let midiNote = root + (scale[scaleDegree] || 0) + (octaveShift * 12);
                
                let durationTicks = isArp ? 100 : (complexity === 'SIMPLE' ? 240 : 150);
                if (genre.includes('Melodic Techno') && !isArp && !isAcid) {
                    durationTicks = 240; 
                }

                if (genre.includes('Goa') && Math.random() > 0.8) midiNote += 12;
                if (isAcid && genre.includes('Peak') && Math.random() > 0.5) midiNote = root;

                events.push({
                    note: theoryEngine.midiToNote(midiNote),
                    time: `${barIndex}:${Math.floor(step/4)}:${step%4}`,
                    duration: "custom",
                    durationTicks: durationTicks,
                    startTick: baseTick + (step * TICKS_PER_16TH),
                    velocity: (complexity === 'SIMPLE') ? 0.9 : baseVelocity + (Math.random() * 0.1 - 0.05) // Use engine velocity
                });
            }
        }

        // --- PAD / ATMOSPHERE ---
        else if (r.includes('PAD')) {
            const voicing = [0, 4, 7]; 
            if (genre.includes('Techno')) voicing.pop(); 

            if (complexity === 'SIMPLE') {
                voicing.forEach(interval => {
                    events.push({
                        note: theoryEngine.midiToNote(root + (scale[interval % scale.length] || 0)),
                        time: `${barIndex}:0:0`,
                        duration: "1n",
                        durationTicks: 1920,
                        startTick: baseTick,
                        velocity: 0.6
                    });
                });
            } else {
                for (let step = 0; step < 16; step++) {
                    // Use session mask or engine profile for rhythmic pads
                    const isActive = currentMotif[step % 16] !== -1;
                    
                    if (genre.includes('Melodic') && isActive) {
                         const interval = voicing[step % voicing.length];
                         events.push({
                            note: theoryEngine.midiToNote(root + (scale[interval % scale.length] || 0)),
                            time: `${barIndex}:${Math.floor(step/4)}:${step%4}`,
                            duration: "16n",
                            durationTicks: 105, 
                            startTick: baseTick + (step * TICKS_PER_16TH),
                            velocity: 0.5
                        });
                        continue;
                    }

                    if (isActive) {
                        voicing.forEach(interval => {
                            events.push({
                                note: theoryEngine.midiToNote(root + (scale[interval % scale.length] || 0)),
                                time: `${barIndex}:${Math.floor(step/4)}:${step%4}`,
                                duration: "16n",
                                durationTicks: 105, 
                                startTick: baseTick + (step * TICKS_PER_16TH),
                                velocity: 0.5 + (Math.random() * 0.1)
                            });
                        });
                    }
                }
            }
        }

        return events;
    }
};
