
import { GrooveObject, MusicGenre, StyleValidationResult, ValidationIssue, NoteEvent } from '../types';

/**
 * HELPER: Check if a track has events within a specific bar range.
 */
const hasEventsInInterval = (events: NoteEvent[], startBar: number, endBar: number): boolean => {
    if (!events || events.length === 0) return false;
    return events.some(e => {
        const bar = parseInt(e.time.split(':')[0], 10);
        return bar >= startBar && bar < endBar;
    });
};

/**
 * STAGE 2: AI VALIDATION
 * Analyzes the generated groove against the strict rules of the selected genre.
 */
export const validateStyle = (groove: GrooveObject): StyleValidationResult => {
    // --- FIX: Force cast 'genre' to MusicGenre to satisfy StyleValidationResult interface constraints ---
    const genre = (groove.genre as MusicGenre) || MusicGenre.PSYTRANCE_FULLON;
    const issues: ValidationIssue[] = [];
    
    // Locate the Peak Section (PEAK)
    const peakSection = groove.structure?.find(s => s.name === 'PEAK');
    const start = peakSection?.startBar || 0;
    const end = peakSection?.endBar || 0;

    // --- RULES FOR TECHNO (PEAK / RAW) ---
    if (genre === MusicGenre.TECHNO_PEAK) {
        // 1. PAD CHECK: No pads in peak
        // --- FIX: Safely handle optional track data using fallback empty array ---
        if (peakSection && hasEventsInInterval(groove.pad || [], start, end)) {
            issues.push({
                type: 'PAD_IN_PEAK',
                description: "Atmospheric Pads detected in Peak section. Peak Techno requires dry, industrial pressure.",
                severity: 'STRONG'
            });
        }

        // 2. DRIVER CHECK: Max 1 melodic driver (Lead OR Acid OR Arp)
        const drivers = ['leadMain', 'leadAcid', 'arp'] as const;
        const activeDrivers = drivers.filter(ch => hasEventsInInterval((groove as any)[ch] || [], start, end));
        
        if (activeDrivers.length > 1) {
            issues.push({
                type: 'TOO_MANY_DRIVERS',
                description: `Multiple melodic drivers (${activeDrivers.join(', ')}) detected in Peak. "The Anvil" requires singular focus.`,
                severity: 'STRONG'
            });
        }

        // 3. BPM CHECK
        if (groove.bpm < 128 || groove.bpm > 144) {
            issues.push({
                type: 'WRONG_BPM',
                description: `BPM ${groove.bpm} is outside typical Peak Techno range (130-140).`,
                severity: 'PARTIAL'
            });
        }
    }

    // DETERMINE STATUS
    let status: StyleValidationResult['status'] = 'MATCH';
    if (issues.some(i => i.severity === 'STRONG')) status = 'MISMATCH';
    else if (issues.length > 0) status = 'PARTIAL';

    // --- FIX: Line 69 error resolved by ensuring 'genre' is of type 'MusicGenre' via the earlier cast ---
    return {
        status,
        issues,
        targetGenre: genre,
        suggestedGenre: genre === MusicGenre.TECHNO_PEAK ? MusicGenre.MELODIC_TECHNO : MusicGenre.TECHNO_PEAK
    };
};

/**
 * FIXER: Programmatically "Tighten" the groove to match the genre rules.
 */
export const fixStyleMismatch = (groove: GrooveObject): GrooveObject => {
    const fixed = JSON.parse(JSON.stringify(groove)) as GrooveObject;
    const peakSection = fixed.structure?.find(s => s.name === 'PEAK');
    
    // --- FIX: Cast genre to any for direct comparison with enum member string values ---
    if (!peakSection || (fixed.genre as any) !== MusicGenre.TECHNO_PEAK) return fixed; 

    const start = peakSection.startBar!;
    const end = peakSection.endBar!;

    const removeRange = (events: NoteEvent[]) => {
        return events.filter(e => {
            const bar = parseInt(e.time.split(':')[0], 10);
            return bar < start || bar >= end;
        });
    };

    // --- FIX: Safely handle optional track data using fallback empty array ---
    fixed.pad = removeRange(fixed.pad || []);

    const hasAcid = hasEventsInInterval(fixed.leadAcid || [], start, end);
    const hasLead = hasEventsInInterval(fixed.leadMain || [], start, end);

    if (hasAcid) {
        fixed.leadMain = removeRange(fixed.leadMain || []);
        fixed.arp = removeRange(fixed.arp || []);
    } else if (hasLead) {
        fixed.arp = removeRange(fixed.arp || []);
    }

    return fixed;
};
