
import { GrooveObject, NoteEvent, ChannelKey } from '../types';
import { theoryEngine } from './theoryEngine';

export const optimizationService = {
    applyCommand(groove: GrooveObject, command: any): GrooveObject {
        const newGroove = JSON.parse(JSON.stringify(groove));

        switch (command.operation) {
            case 'SYNC_MELODIC_INTERACTION':
                this.resolveSpectralConflicts(newGroove);
                this.applyRhythmicHumanization(newGroove);
                this.fixNoteOverlaps(newGroove);
                break;
            case 'SYSTEM_SYNC':
                this.alignToGlobalScale(newGroove, command.params || {});
                this.resolveSpectralConflicts(newGroove); // Force phase check
                break;
            case 'SCALE_QUANTIZE':
                this.alignToGlobalScale(newGroove, command.params || {});
                break;
            case 'VELOCITY_HUMANIZE':
                this.applyVelocityHumanization(newGroove, command.params || {});
                break;
        }
        return newGroove;
    },

    resolveSpectralConflicts(groove: GrooveObject) {
        const kick = groove['ch1_kick'] || [];
        const sub = groove['ch2_sub'] || [];
        const midBass = groove['ch3_midBass'] || [];

        // 1. Kick-Bass Phase Lock & Sidechain (-3dB logic)
        kick.forEach(kNote => {
            const kStart = kNote.startTick || 0;
            const kEnd = kStart + (kNote.durationTicks || 480);
            
            // Remove any bass notes that overlap with the Kick's "Punch" (first 60 ticks)
            const sidechainRange = 80; // Ticks
            
            [sub, midBass].forEach(track => {
                for (let i = track.length - 1; i >= 0; i--) {
                    const bStart = track[i].startTick || 0;
                    if (bStart >= kStart && bStart < kStart + sidechainRange) {
                        // Conflict! Remove note to create "Suction" effect (Sidechain)
                        track.splice(i, 1);
                    }
                }
            });
        });

        // 2. Lead Conflicts
        const leadA = groove['ch4_leadA'] || [];
        const acid = groove['ch14_acid'] || [];
        acid.forEach((aNote: any) => {
            leadA.forEach((lNote: any) => {
                if (Math.abs((aNote.startTick || 0) - (lNote.startTick || 0)) < 60) {
                    lNote.velocity = (lNote.velocity || 0.8) * 0.4;
                }
            });
        });
    },

    applyRhythmicHumanization(groove: GrooveObject) {
        Object.keys(groove).forEach(ch => {
            if (['ch1_kick', 'ch2_sub', 'ch3_midBass', 'ch12_hhClosed'].includes(ch)) return;

            const track = (groove as any)[ch];
            if (!Array.isArray(track)) return;

            track.forEach((n: any) => {
                if ((n.startTick || 0) % 480 !== 0) {
                    n.startTick = (n.startTick || 0) + (Math.floor(Math.random() * 8) - 4);
                }
                n.velocity = Math.min(1.0, (n.velocity || 0.8) * (0.92 + Math.random() * 0.16));
            });
        });
    },
    
    applyVelocityHumanization(groove: GrooveObject, params: any) {
        const target = params.targetTrack || 'ch4_leadA';
        const amount = params.amount || 0.1;
        const track = (groove as any)[target] as NoteEvent[];
        if(track) {
            track.forEach(n => {
                const noise = (Math.random() - 0.5) * amount;
                n.velocity = Math.max(0.1, Math.min(1.0, n.velocity + noise));
            });
        }
    },

    fixNoteOverlaps(groove: GrooveObject) {
        Object.values(groove).forEach(track => {
            if (!Array.isArray(track)) return;
            const validNotes = track.filter((n: any) => n && typeof n.startTick === 'number');
            validNotes.sort((a: any, b: any) => a.startTick - b.startTick);
            
            for (let i = 0; i < validNotes.length - 1; i++) {
                const current = validNotes[i];
                const next = validNotes[i+1];
                if (current.startTick + (current.durationTicks || 120) > next.startTick) {
                    const newDur = next.startTick - current.startTick - 2;
                    if (newDur > 0) current.durationTicks = newDur;
                }
            }
        });
    },

    alignToGlobalScale(groove: GrooveObject, params: any) {
        const rootKey = params.root || groove.key || "F#";
        const scaleType = params.mode || groove.scale || "Phrygian";
        
        const getScalePcs = (root: string, scale: string): number[] => {
            const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const rootIdx = NOTES.indexOf(root);
            if (rootIdx === -1) return [0,2,4,5,7,9,11]; 

            let intervals = [0, 2, 4, 5, 7, 9, 11]; 
            if (scale.includes('Phrygian')) intervals = [0, 1, 3, 5, 7, 8, 10];
            else if (scale.includes('Minor')) intervals = [0, 2, 3, 5, 7, 8, 10];
            else if (scale.includes('Harmonic')) intervals = [0, 2, 3, 5, 7, 8, 11];
            else if (scale.includes('Dorian')) intervals = [0, 2, 3, 5, 7, 9, 10];

            return intervals.map(i => (rootIdx + i) % 12);
        };

        const allowedPcs = getScalePcs(rootKey, scaleType);
        const melodicTracks: ChannelKey[] = ['ch4_leadA', 'ch5_leadB', 'ch6_arpA', 'ch7_arpB', 'ch14_acid', 'ch15_pad', 'ch3_midBass'];

        melodicTracks.forEach(ch => {
            const notes = (groove as any)[ch];
            if (!notes || !Array.isArray(notes)) return;

            notes.forEach((n: any) => {
                if (!n.note) return;
                const noteName = Array.isArray(n.note) ? n.note[0] : n.note;
                const midi = theoryEngine.getMidiNote(noteName);
                const pc = midi % 12;

                if (!allowedPcs.includes(pc)) {
                    let nearest = midi;
                    for (let i = 1; i <= 6; i++) {
                        if (allowedPcs.includes((midi + i) % 12)) {
                            nearest = midi + i;
                            break;
                        }
                        if (allowedPcs.includes((midi - i + 12) % 12)) {
                            nearest = midi - i;
                            break;
                        }
                    }
                    n.note = theoryEngine.midiToNote(nearest);
                }
            });
        });
    }
};
