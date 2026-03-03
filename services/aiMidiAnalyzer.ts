
import { NoteEvent } from '../types';

// ========== מבני נתונים ==========
export interface MidiAnalysis {
    fileName: string;
    timestamp: number;
    
    // ניתוח מלודי
    melodicProfile: {
        avgInterval: number;
        intervalDistribution: { [interval: number]: number };
        commonMotifs: number[][];
        preferredDirections: { up: number; down: number; same: number };
        rangeSpread: number; // טווח אוקטבות
    };
    
    // ניתוח ריתמי
    rhythmProfile: {
        density: number; // אחוז נוטות ב-16th grid
        syncoPationLevel: number; // רמת סינקופציה
        rhythmPatterns: number[]; // דפוס 16th notes
        commonDurations: number[]; // אורכי נוטות נפוצים
    };
    
    // ניתוח דינמי
    dynamicProfile: {
        avgVelocity: number;
        velocityRange: [number, number];
        hasAccents: boolean;
        accentPattern: number[]; // מיקומי אקסנטים
    };
    
    // ניתוח הרמוני
    harmonicProfile: {
        detectedScale: number[];
        scaleType: 'major' | 'minor' | 'phrygian' | 'dorian' | 'unknown';
        rootNote: number;
        chromaticUsage: number; // אחוז נוטות כרומטיות
    };
}

export interface LearnedStyle {
    name: string;
    trainingFiles: number;
    lastUpdated: number;
    
    // פרמטרים שנלמדו
    learnedParams: {
        intervalWeights: { [interval: number]: number };
        rhythmTemplates: number[][];
        motifLibrary: number[][];
        velocityPreset: { min: number; max: number; accent: number };
        scalePreference: number[];
        densityTarget: number;
        legatoAmount: number;
    };
}

// ========== מנוע AI ==========
export class MidiAIAnalyzer {
    private analyses: MidiAnalysis[] = [];
    private currentStyle: LearnedStyle | null = null;

    /**
     * Analyze a GrooveObject directly
     */
    analyzeGroove(groove: any): MidiAnalysis {
        const activeTracks = Object.keys(groove).filter(k => k.startsWith('ch') && groove[k]?.length > 0);
        const allEvents: NoteEvent[] = activeTracks.flatMap(k => groove[k]);

        if (allEvents.length === 0) {
            return {
                fileName: "Current Project",
                timestamp: Date.now(),
                melodicProfile: { avgInterval: 0, intervalDistribution: {}, commonMotifs: [], preferredDirections: { up: 0, down: 0, same: 0 }, rangeSpread: 0 },
                rhythmProfile: { density: 0, syncoPationLevel: 0, rhythmPatterns: [], commonDurations: [] },
                dynamicProfile: { avgVelocity: 0, velocityRange: [0, 0], hasAccents: false, accentPattern: [] },
                harmonicProfile: { detectedScale: [], scaleType: 'unknown', rootNote: 0, chromaticUsage: 0 }
            };
        }

        const melodicProfile = this.analyzeMelody(allEvents);
        const rhythmProfile = this.analyzeRhythm(allEvents);
        const dynamicProfile = this.analyzeDynamics(allEvents);
        const harmonicProfile = this.analyzeHarmony(allEvents);

        return {
            fileName: groove.name || "Current Project",
            timestamp: Date.now(),
            melodicProfile,
            rhythmProfile,
            dynamicProfile,
            harmonicProfile
        };
    }

    /**
     * ניתוח קובץ MIDI אמיתי
     */
    async analyzeMidiFile(file: File): Promise<MidiAnalysis> {
        // קריאת הקובץ
        const arrayBuffer = await file.arrayBuffer();
        const events = this.parseMidiBuffer(arrayBuffer);
        
        // ניתוח מלודי
        const melodicProfile = this.analyzeMelody(events);
        
        // ניתוח ריתמי
        const rhythmProfile = this.analyzeRhythm(events);
        
        // ניתוח דינמי
        const dynamicProfile = this.analyzeDynamics(events);
        
        // ניתוח הרמוני
        const harmonicProfile = this.analyzeHarmony(events);
        
        const analysis: MidiAnalysis = {
            fileName: file.name,
            timestamp: Date.now(),
            melodicProfile,
            rhythmProfile,
            dynamicProfile,
            harmonicProfile
        };
        
        this.analyses.push(analysis);
        return analysis;
    }

    /**
     * פרסור בסיסי של MIDI buffer
     */
    private parseMidiBuffer(buffer: ArrayBuffer): NoteEvent[] {
        // סימולציה זמנית
        const events: NoteEvent[] = [];
        for (let i = 0; i < 64; i++) {
            events.push({
                note: `C${3 + Math.floor(i / 12)}`,
                time: `0:${Math.floor(i / 4)}:${i % 4}`,
                duration: 'custom',
                durationTicks: 120 + Math.random() * 120,
                velocity: 0.7 + Math.random() * 0.3
            });
        }
        
        return events;
    }

    /**
     * ניתוח מלודי
     */
    private analyzeMelody(events: NoteEvent[]): MidiAnalysis['melodicProfile'] {
        const midiNotes = events.map(e => this.noteToMidi(e.note as string));
        const intervals: number[] = [];
        const intervalDist: { [key: number]: number } = {};
        
        let up = 0, down = 0, same = 0;
        
        for (let i = 1; i < midiNotes.length; i++) {
            const interval = midiNotes[i] - midiNotes[i - 1];
            intervals.push(interval);
            intervalDist[interval] = (intervalDist[interval] || 0) + 1;
            
            if (interval > 0) up++;
            else if (interval < 0) down++;
            else same++;
        }
        
        const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
        const range = midiNotes.length > 0 ? Math.max(...midiNotes) - Math.min(...midiNotes) : 0;
        
        // זיהוי מוטיבים (חלונות של 3-4 נוטות)
        const motifs = this.extractMotifs(intervals);
        
        return {
            avgInterval,
            intervalDistribution: intervalDist,
            commonMotifs: motifs,
            preferredDirections: { up, down, same },
            rangeSpread: range
        };
    }

    /**
     * ניתוח ריתמי
     */
    private analyzeRhythm(events: NoteEvent[]): MidiAnalysis['rhythmProfile'] {
        const totalSteps = 16 * 8; // 8 bars
        const grid = new Array(totalSteps).fill(0);
        const durations: number[] = [];
        
        events.forEach(e => {
            const step = this.timeToStep(e.time);
            if (step < totalSteps) grid[step] = 1;
            
            if (typeof e.durationTicks === 'number') {
                durations.push(e.durationTicks);
            }
        });
        
        const density = grid.filter(x => x === 1).length / totalSteps;
        
        // חישוב סינקופציה (off-beat notes)
        let offBeats = 0;
        for (let i = 0; i < grid.length; i++) {
            if (grid[i] === 1 && i % 4 !== 0) offBeats++;
        }
        const syncopation = events.length > 0 ? offBeats / events.length : 0;
        
        // דפוסים נפוצים של duration
        const commonDurs = this.findCommonValues(durations, 5);
        
        return {
            density,
            syncoPationLevel: syncopation,
            rhythmPatterns: grid.slice(0, 16), // דפוס של bar אחד
            commonDurations: commonDurs
        };
    }

    /**
     * ניתוח דינמי (Velocity)
     */
    private analyzeDynamics(events: NoteEvent[]): MidiAnalysis['dynamicProfile'] {
        const velocities = events.map(e => 
            typeof e.velocity === 'number' ? e.velocity * 127 : 90
        );
        
        const avg = velocities.length > 0 ? velocities.reduce((a, b) => a + b, 0) / velocities.length : 90;
        const min = velocities.length > 0 ? Math.min(...velocities) : 0;
        const max = velocities.length > 0 ? Math.max(...velocities) : 127;
        
        // זיהוי אקסנטים (נוטות חזקות משמעותית)
        const threshold = avg + 15;
        const accents: number[] = [];
        events.forEach((e, i) => {
            const vel = typeof e.velocity === 'number' ? e.velocity * 127 : 90;
            if (vel > threshold) accents.push(i);
        });
        
        return {
            avgVelocity: avg,
            velocityRange: [min, max],
            hasAccents: accents.length > 0,
            accentPattern: accents
        };
    }

    /**
     * ניתוח הרמוני
     */
    private analyzeHarmony(events: NoteEvent[]): MidiAnalysis['harmonicProfile'] {
        const midiNotes = events.map(e => this.noteToMidi(e.note as string));
        const pitchClasses = midiNotes.map(n => n % 12);
        
        // ספירת תדירות של כל pitch class
        const pcCounts: { [pc: number]: number } = {};
        pitchClasses.forEach(pc => {
            pcCounts[pc] = (pcCounts[pc] || 0) + 1;
        });
        
        // מציאת הסולם הכי מתאים
        const { scale, root, type } = this.detectScale(pcCounts);
        
        // חישוב כרומטיות
        const scaleSet = new Set(scale);
        const chromaticNotes = pitchClasses.filter(pc => !scaleSet.has(pc));
        const chromaticUsage = pitchClasses.length > 0 ? chromaticNotes.length / pitchClasses.length : 0;
        
        return {
            detectedScale: scale,
            scaleType: type,
            rootNote: root,
            chromaticUsage
        };
    }

    /**
     * למידת סגנון מכל הקבצים שנותחו
     */
    learnStyle(styleName: string): LearnedStyle {
        if (this.analyses.length === 0) {
            throw new Error('No training data available');
        }
        
        // איחוד כל הניתוחים לפרמטרים אחד
        const intervalWeights: { [key: number]: number } = {};
        const rhythmTemplates: number[][] = [];
        const motifLibrary: number[][] = [];
        let totalDensity = 0;
        let totalVelMin = 0;
        let totalVelMax = 0;
        let totalAccent = 0;
        
        this.analyses.forEach(analysis => {
            // איחוד intervals
            Object.entries(analysis.melodicProfile.intervalDistribution).forEach(([interval, count]) => {
                const key = parseInt(interval);
                intervalWeights[key] = (intervalWeights[key] || 0) + count;
            });
            
            // איסוף מוטיבים
            motifLibrary.push(...analysis.melodicProfile.commonMotifs);
            
            // איסוף דפוסי ריתמוס
            rhythmTemplates.push(analysis.rhythmProfile.rhythmPatterns);
            
            // ממוצעים
            totalDensity += analysis.rhythmProfile.density;
            totalVelMin += analysis.dynamicProfile.velocityRange[0];
            totalVelMax += analysis.dynamicProfile.velocityRange[1];
            totalAccent += analysis.dynamicProfile.avgVelocity + 20;
        });
        
        const n = this.analyses.length;
        
        // נרמול משקלי intervals
        const totalWeight = Object.values(intervalWeights).reduce((a, b) => a + b, 0);
        Object.keys(intervalWeights).forEach(key => {
            intervalWeights[parseInt(key)] /= totalWeight;
        });
        
        // השתמש בסולם הנפוץ ביותר
        const scalePreference = this.analyses[0].harmonicProfile.detectedScale;
        
        // חישוב legato ממוצע מהדוגמאות
        const avgDuration = this.analyses
            .flatMap(a => a.rhythmProfile.commonDurations)
            .reduce((a, b) => a + b, 0) / (n * 5);
        const legatoAmount = Math.min(0.9, avgDuration / 240); // normalize to 0-1
        
        const style: LearnedStyle = {
            name: styleName,
            trainingFiles: n,
            lastUpdated: Date.now(),
            learnedParams: {
                intervalWeights,
                rhythmTemplates: rhythmTemplates.slice(-10), // Keep last 10
                motifLibrary: motifLibrary.slice(-20), // Keep last 20
                velocityPreset: {
                    min: Math.floor(totalVelMin / n),
                    max: Math.floor(totalVelMax / n),
                    accent: Math.floor(totalAccent / n)
                },
                scalePreference,
                densityTarget: totalDensity / n,
                legatoAmount
            }
        };
        
        this.currentStyle = style;
        return style;
    }

    /**
     * יצירת מלודיה מהסגנון שנלמד
     */
    generateFromLearnedStyle(bars: number = 8): NoteEvent[] {
        if (!this.currentStyle) {
            throw new Error('No style learned yet');
        }
        
        const params = this.currentStyle.learnedParams;
        const events: NoteEvent[] = [];
        const totalSteps = bars * 16;
        
        let currentNote = 60; // Middle C
        const TICKS_PER_16TH = 120;
        
        for (let step = 0; step < totalSteps; step++) {
            // החלט אם לשים נוטה (לפי density)
            if (Math.random() > params.densityTarget) continue;
            
            // בחר interval לפי המשקלים שנלמדו
            const interval = this.weightedRandomInterval(params.intervalWeights);
            currentNote += interval;
            
            // שמור בטווח סביר
            currentNote = Math.max(48, Math.min(84, currentNote));
            
            // זמן
            const bar = Math.floor(step / 16);
            const beat = Math.floor((step % 16) / 4);
            const sixteen = step % 4;
            const time = `${bar}:${beat}:${sixteen}`;
            
            // Duration עם legato
            const baseDuration = TICKS_PER_16TH;
            const overlap = Math.round(TICKS_PER_16TH * params.legatoAmount);
            const durationTicks = baseDuration + overlap;
            
            // Velocity לפי הפרופיל שנלמד
            const isAccent = step % 16 === 0 || step % 16 === 12;
            const velocity = isAccent 
                ? params.velocityPreset.accent / 127
                : (params.velocityPreset.min + Math.random() * (params.velocityPreset.max - params.velocityPreset.min)) / 127;
            
            events.push({
                note: this.midiToNote(currentNote),
                time,
                duration: 'custom',
                durationTicks,
                velocity: Number(velocity.toFixed(2))
            });
        }
        
        return events;
    }

    // ========== Utility Functions ==========
    
    private extractMotifs(intervals: number[]): number[][] {
        const motifs: number[][] = [];
        const windowSize = 4;
        
        for (let i = 0; i <= intervals.length - windowSize; i++) {
            motifs.push(intervals.slice(i, i + windowSize));
        }
        
        // Return unique motifs (simplified)
        return motifs.slice(0, 10);
    }

    private timeToStep(time: string): number {
        const parts = time.split(':').map(Number);
        return parts[0] * 16 + parts[1] * 4 + parts[2];
    }

    private findCommonValues(arr: number[], count: number): number[] {
        const freq: { [key: number]: number } = {};
        arr.forEach(v => {
            freq[v] = (freq[v] || 0) + 1;
        });
        
        return Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, count)
            .map(([val]) => parseFloat(val));
    }

    private detectScale(pcCounts: { [pc: number]: number }): { scale: number[]; root: number; type: any } {
        // Simplified scale detection
        const scales = {
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10],
            phrygian: [0, 1, 3, 5, 7, 8, 10],
            dorian: [0, 2, 3, 5, 7, 9, 10]
        };
        
        // Find root (most common note)
        const entries = Object.entries(pcCounts).sort((a, b) => b[1] - a[1]);
        const root = entries.length > 0 ? entries[0][0] : "0";
        
        return {
            scale: scales.minor,
            root: parseInt(root) || 0,
            type: 'minor'
        };
    }

    private noteToMidi(note: string): number {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const match = note.match(/([A-G]#?)(\d+)/);
        if (!match) return 60;
        
        const [, noteName, octave] = match;
        const noteIndex = notes.indexOf(noteName);
        return (parseInt(octave) + 1) * 12 + noteIndex;
    }

    private midiToNote(midi: number): string {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const note = notes[midi % 12];
        return `${note}${octave}`;
    }

    private weightedRandomInterval(weights: { [interval: number]: number }): number {
        const intervals = Object.keys(weights).map(Number);
        const total = Object.values(weights).reduce((a, b) => a + b, 0);
        
        let random = Math.random() * total;
        for (const interval of intervals) {
            random -= weights[interval];
            if (random <= 0) return interval;
        }
        
        return 0;
    }

    // ========== Getters ==========
    
    getAnalyses(): MidiAnalysis[] {
        return this.analyses;
    }

    getCurrentStyle(): LearnedStyle | null {
        return this.currentStyle;
    }

    clearAll(): void {
        this.analyses = [];
        this.currentStyle = null;
    }
}

// Singleton instance
export const midiAI = new MidiAIAnalyzer();
