
import { GrooveObject, ChannelKey } from '../types';

export interface RoadmapStep {
    bar: number;
    section: string;
    action: string;
    tipHebrew: string;
    tipEnglish: string;
    type: 'AUTOMATION' | 'FX' | 'STRUCTURE' | 'MIXING';
}

export interface VstRecommendation {
    channel: string;
    vst: string;
    presetType: string;
    processingTip: string;
}

export const productionGuideService = {
    
    generateRoadmap: (groove: GrooveObject): RoadmapStep[] => {
        const steps: RoadmapStep[] = [];
        const bpm = groove.bpm;
        const key = groove.key;
        
        // 1. INTRO ANALYSIS
        steps.push({
            bar: 0,
            section: 'INTRO',
            action: 'Atmosphere Setup',
            tipHebrew: `התחל עם פילטר סגור ב-Pad (ערוץ 15). פתח אותו לאט עד תיבה 16.`,
            tipEnglish: `Start with a closed Filter Cutoff on the Pad (Ch 15). Open slowly until Bar 16.`,
            type: 'AUTOMATION'
        });

        // 2. KICK ENTRY
        steps.push({
            bar: 16,
            section: 'BUILD_1',
            action: 'Kick & Bass Lock',
            tipHebrew: `ודא שה-Kick וה-Bass (ערוצים 1-2) יושבים במונו. בדוק פאזה.`,
            tipEnglish: `Ensure Kick & Bass (Ch 1-2) are Mono. Check phase alignment.`,
            type: 'MIXING'
        });

        // 3. ACID AUTOMATION (If present)
        if (groove.ch14_acid && groove.ch14_acid.length > 0) {
            steps.push({
                bar: 24,
                section: 'ACID RAMP',
                action: '303 Tension',
                tipHebrew: `זה הזמן להעלות את ה-Resonance של ה-Acid לקראת הדרופ.`,
                tipEnglish: `Raise the Acid Resonance to build tension before the drop.`,
                type: 'AUTOMATION'
            });
        }

        // 4. DROP 1
        steps.push({
            bar: 32,
            section: 'DROP 1',
            action: 'Full Power',
            tipHebrew: `שחרר את ה-Sidechain על הלידים. זה הדרופ הראשון.`,
            tipEnglish: `Release full energy. Ensure Leads are ducking (Sidechain) against the Kick.`,
            type: 'STRUCTURE'
        });

        // 5. BREAKDOWN
        steps.push({
            bar: 64,
            section: 'BREAK',
            action: 'Silence & FX',
            tipHebrew: `חתוך את ה-Kick. הוסף ריוורב ארוך (Hall) על ה-FX בתיבה 63.`,
            tipEnglish: `Cut the Kick. Add a long Hall Reverb tail on the FX at Bar 63.`,
            type: 'FX'
        });

        // 6. PEAK
        steps.push({
            bar: 96,
            section: 'PEAK',
            action: 'Melodic Climax',
            tipHebrew: `השיא של הטראק ב-${key} ${groove.scale}. כל האלמנטים פתוחים.`,
            tipEnglish: `Track climax in ${key} ${groove.scale}. All filters open.`,
            type: 'STRUCTURE'
        });

        return steps.sort((a, b) => a.bar - b.bar);
    },

    getVstRecommendations: (groove: GrooveObject): VstRecommendation[] => {
        const recs: VstRecommendation[] = [];

        // Rhythm
        recs.push({ channel: 'Kick/Bass (1-3)', vst: 'Serum / Vital', presetType: 'Sine/Saw', processingTip: 'Mono below 150Hz. Strict Sidechain.' });
        
        // Leads
        if (groove.ch4_leadA?.length > 0) {
            recs.push({ channel: 'Lead A (4)', vst: 'Spire / Sylenth1', presetType: 'Saw Lead', processingTip: 'Ping-Pong Delay (1/8d) + OTT.' });
        }

        // Acid
        if (groove.ch14_acid?.length > 0) {
            recs.push({ channel: 'Acid (14)', vst: 'Phoscyon 2 / ABL3', presetType: '303 TB', processingTip: 'Distortion (Tube) + High Resonance.' });
        }

        // Atmosphere
        recs.push({ channel: 'Pad (15)', vst: 'Omnisphere / Pigments', presetType: 'Choir/String', processingTip: 'Sidechain + Low Cut @ 300Hz.' });

        return recs;
    }
};
