

import { GrooveObject, NoteEvent, ChannelKey } from '../types';
import { theoryEngine } from './theoryEngine';

export interface QAResult {
    passed: boolean;
    score: number;
    subScores: {
        structural: number;
        genre: number;
        lowEnd: number;
        harmonic: number;
        density: number;
        intelligence: number;
    };
    forensicData: {
        fixes: string[];
        warnings: string[];
        activeChannels: string[];
        emptyChannels: string[];
        harmonicConflicts: string[];
        genreViolations: string[];
        channelActivity: Record<string, number>; // Channel -> Active Bar Count
    };
}

const ELITE_KEYS: ChannelKey[] = [
  'ch1_kick', 'ch2_sub', 'ch3_midBass', 'ch4_leadA', 'ch5_leadB', 
  'ch6_arpA', 'ch7_arpB', 'ch8_snare', 'ch9_clap', 'ch10_percLoop', 
  'ch11_percTribal', 'ch12_hhClosed', 'ch13_hhOpen', 'ch14_acid', 'ch15_pad', 'ch16_synth'
];

// Helper to check if a track has notes in a specific bar
const hasNotesInBar = (notes: NoteEvent[], bar: number): boolean => {
    if (!notes) return false;
    return notes.some(n => parseInt(n.time.split(':')[0]) === bar);
};

// Helper to check note density in a section
const getDensityInSection = (notes: NoteEvent[], startBar: number, endBar: number): number => {
    if (!notes || notes.length === 0) return 0;
    let count = 0;
    for (const n of notes) {
        const b = parseInt(n.time.split(':')[0]);
        if (b >= startBar && b < endBar) count++;
    }
    return count / (endBar - startBar);
};

export const runGrooveQA = (groove: GrooveObject, targetScope?: ChannelKey[]): QAResult => {
    // Scoring Buckets (Total 100)
    let sStructural = 20;
    let sGenre = 25;
    let sLowEnd = 20;
    let sHarmonic = 15;
    let sDensity = 10;
    let sIntelligence = 10;

    const fixes: string[] = [];
    const warnings: string[] = [];
    const genreViolations: string[] = [];
    const harmonicConflicts: string[] = [];
    const activeChannels: string[] = [];
    const emptyChannels: string[] = [];
    const channelActivity: Record<string, number> = {};

    const totalBars = groove.totalBars || 64;
    const structure = groove.structure || [
        { name: 'INTRO', startBar: 0, endBar: Math.floor(totalBars * 0.15) },
        { name: 'DROP', startBar: Math.floor(totalBars * 0.3), endBar: Math.floor(totalBars * 0.6) }
    ];

    // --- 1. DATA & ACTIVITY AUDIT ---
    ELITE_KEYS.forEach(key => {
        if (targetScope && !targetScope.includes(key)) return;

        const notes = (groove as any)[key] as NoteEvent[];
        const hasContent = notes && Array.isArray(notes) && notes.length > 0;
        
        let validNoteCount = 0;
        let activeBars = new Set<number>();

        if (hasContent) {
            notes.forEach(n => {
                if ((n.durationTicks || 120) > 0) {
                    validNoteCount++;
                    activeBars.add(parseInt(n.time.split(':')[0]));
                }
            });
        }

        if (validNoteCount > 0) {
            activeChannels.push(key);
            channelActivity[key] = activeBars.size;
            
            // Check timing drift
            if (notes.some(n => (n.timingOffset || 0) !== 0)) {
                warnings.push(`[${key}] Timing drift detected.`);
                sStructural -= 1;
            }
        } else {
            emptyChannels.push(key);
        }
    });

    // --- 2. GENRE SPECIFIC VALIDATION ---
    const genre = groove.genre || "Psytrance";
    const dropSection = structure.find(s => s.name === 'DROP' || (s.name as string) === 'DROP_1') || { startBar: 32, endBar: 64 };
    
    const kickNotes = (groove.ch1_kick || []) as NoteEvent[];
    const subNotes = (groove.ch2_sub || []) as NoteEvent[];
    const leadNotes = (groove.ch4_leadA || []) as NoteEvent[];

    // Only apply complex rules if tracks are in scope
    const checkKick = !targetScope || targetScope.includes('ch1_kick');
    const checkBass = !targetScope || targetScope.includes('ch2_sub');

    if (checkKick && checkBass && activeChannels.includes('ch1_kick') && activeChannels.includes('ch2_sub')) {
        // A. Bass Coverage in Drop
        let kickBarsInDrop = 0;
        let subBarsInDrop = 0;
        
        for (let b = dropSection.startBar; b < dropSection.endBar; b++) {
            if (hasNotesInBar(kickNotes, b)) kickBarsInDrop++;
            if (hasNotesInBar(subNotes, b)) subBarsInDrop++;
        }

        if (kickBarsInDrop > 0) {
            const coverage = subBarsInDrop / kickBarsInDrop;
            
            if (genre.includes("Full-On") && coverage < 0.9) {
                genreViolations.push(`Full-On Rule Violation: Bass coverage in Drop is ${(coverage*100).toFixed(0)}% (Requires 90%).`);
                sGenre -= 10;
                sLowEnd -= 5;
            } else if (coverage < 0.7) {
                warnings.push(`Weak Bass Coverage in Drop (${(coverage*100).toFixed(0)}%).`);
                sLowEnd -= 5;
            }
        } else {
            // No kick in drop?
            if (checkKick) {
                genreViolations.push("Structure Violation: Drop section missing Kick drum.");
                sStructural -= 10;
            }
        }
    }

    // B. Lead Density / Activity
    if (activeChannels.includes('ch4_leadA')) {
        const leadDensityDrop = getDensityInSection(leadNotes, dropSection.startBar, dropSection.endBar);
        if (genre.includes("Techno") && leadDensityDrop > 4) {
             genreViolations.push("Techno Rule Violation: Lead is too busy for Peak Time Techno.");
             sGenre -= 5;
        }
        if (genre.includes("Full-On") && leadDensityDrop < 1) {
             warnings.push("Full-On Suggestion: Lead density in Drop is low.");
             sGenre -= 2;
        }
    }

    // --- 3. HARMONIC VALIDATION (STRICT) ---
    const melodicChannels: ChannelKey[] = ['ch4_leadA', 'ch5_leadB', 'ch6_arpA', 'ch14_acid', 'ch15_pad', 'ch16_synth'];
    const key = groove.key || "F#";
    const scale = groove.scale || "Phrygian";
    let seriousHarmonicFail = false;

    melodicChannels.forEach(ch => {
        if (!activeChannels.includes(ch)) return;
        const notes = (groove as any)[ch] as NoteEvent[];
        let badNotes = 0;
        notes.forEach(n => {
            const noteName = Array.isArray(n.note) ? n.note[0] : n.note;
            if (!theoryEngine.isNoteInScale(noteName, key, scale)) badNotes++;
        });

        if (badNotes > 0) {
            const pct = (badNotes / notes.length);
            if (pct > 0.15) {
                harmonicConflicts.push(`${ch}: ${Math.round(pct*100)}% out of scale`);
                sHarmonic -= 5;
                if (pct > 0.30) {
                    seriousHarmonicFail = true;
                    harmonicConflicts.push(`CRITICAL: ${ch} exceeds 30% dissonance.`);
                }
            }
        }
    });

    // --- 4. SCORING CLAMPS & RESULT ---
    sStructural = Math.max(0, sStructural);
    sGenre = Math.max(0, sGenre);
    sLowEnd = Math.max(0, sLowEnd);
    sHarmonic = Math.max(0, sHarmonic);
    
    // Critical Fail Conditions
    if (checkKick && !activeChannels.includes('ch1_kick')) { warnings.push("CRITICAL: Missing Kick."); sStructural = 0; }
    if (checkBass && !activeChannels.includes('ch2_sub')) { warnings.push("CRITICAL: Missing Sub Bass."); sLowEnd = 0; }
    
    // Strict Harmony Fail
    if (seriousHarmonicFail) {
        sHarmonic = 0;
        warnings.push("CRITICAL: Harmonic Integrity Failure.");
    }

    const finalScore = sStructural + sGenre + sLowEnd + sHarmonic + sDensity + sIntelligence;
    const isCriticalFail = warnings.some(w => w.includes("CRITICAL")) || genreViolations.length > 2;

    return {
        passed: finalScore > 75 && !isCriticalFail,
        score: finalScore,
        subScores: { structural: sStructural, genre: sGenre, lowEnd: sLowEnd, harmonic: sHarmonic, density: sDensity, intelligence: sIntelligence },
        forensicData: {
            fixes,
            warnings,
            genreViolations,
            harmonicConflicts,
            activeChannels,
            emptyChannels,
            channelActivity
        }
    };
};
