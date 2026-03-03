import { GoogleGenAI } from "@google/genai";
import { GrooveObject } from "../types";
import { advisorHistoryService } from "./advisorHistoryService";
import { innovationService } from "./innovationService";

/**
 * FORENSIC AUDITOR V1.4 (QUOTA OPTIMIZED)
 * Core logic for automated musical audits with better rate-limit handling.
 */
class ForensicAuditorService {
    private lastSnapshot: string = "";
    private timeout: any = null;
    private isAnalyzing: boolean = false;

    private MONITOR_MODEL = 'gemini-3-flash-preview';
    private TEACHER_MODEL = 'gemini-3-pro-preview';

    constructor() {}

    /**
     * Standard observer for manual changes.
     */
    public observe(groove: GrooveObject | null) {
        if (!groove) return;

        let totalNotes = 0;
        const keys = Object.keys(groove).filter(k => k.startsWith('ch'));
        keys.forEach(k => {
            if (Array.isArray((groove as any)[k])) {
                totalNotes += (groove as any)[k].length;
            }
        });

        const currentSnap = JSON.stringify({ 
            bars: groove.totalBars, 
            activeChannelsCount: keys.filter(k => (groove as any)[k].length > 0).length,
            totalEventCount: totalNotes,
            bpm: groove.bpm,
            genre: groove.genre
        });

        if (currentSnap === this.lastSnapshot) return;
        this.lastSnapshot = currentSnap;

        if (this.timeout) clearTimeout(this.timeout);
        // V1.4: Increased idle timeout to 45s to preserve quota
        this.timeout = setTimeout(() => {
            this.analyzeBackground(groove);
        }, 45000); 
    }

    /**
     * MASTER TEACHER AUDIT (IMMEDIATE)
     * Triggered by the Pipeline at the end of every generation.
     */
    public async analyzeGenerationImmediate(groove: GrooveObject) {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        console.log("[ForensicAuditor] Initiating Master Teacher Forensic Audit...");
        
        const prompt = `
        ROLE: World-Class Music Production Master Teacher & Algorithm Architect.
        TASK: Audit the newly generated MIDI track. Be technical, artistic, and direct.
        
        PROJECT DATA:
        - Genre: ${groove.genre}
        - BPM: ${groove.bpm}
        - Key: ${groove.key} ${groove.scale}
        - Active Channels: ${Object.keys(groove).filter(k => k.startsWith('ch') && (groove as any)[k].length > 0).join(', ')}
        
        ORCHESTRATION FOCUS:
        Analyze the relationship between channels. Suggest improvements for:
        1. Melodic Harmony (Counterpoint, layering).
        2. Rhythmic Complexity (Syncopation, ghost notes, polyrhythms).
        3. Dynamic Range (Velocity variation).
        
        OUTPUT FORMAT (JSON ONLY):
        {
            "review": "Detailed orchestration audit in English.",
            "grade": "A-E",
            "score": 0-100,
            "improvement": "One specific actionable step for the user.",
            "innovation": { "title": "...", "description": "...", "category": "LOGIC", "priority": "HIGH" } | null
        }
        `;

        try {
            // Attempt with Pro first, fallback to Flash on rate limit
            let response;
            try {
                response = await ai.models.generateContent({
                    model: this.TEACHER_MODEL,
                    contents: { parts: [{ text: prompt }] },
                    config: { responseMimeType: "application/json" }
                });
            } catch (proError: any) {
                if (proError.message?.includes('429') || proError.status === 'RESOURCE_EXHAUSTED') {
                    console.warn("[ForensicAuditor] Pro exhausted, falling back to Flash for Audit.");
                    response = await ai.models.generateContent({
                        model: this.MONITOR_MODEL,
                        contents: { parts: [{ text: prompt }] },
                        config: { responseMimeType: "application/json" }
                    });
                } else throw proError;
            }

            if (response.text) {
                const result = JSON.parse(response.text.replace(/```json\n?|```/g, ""));
                
                let masterMessage = `🎓 **Master Teacher Audit:**\n\n${result.review}\n\n**Musical Score:** ${result.score}/100 (${result.grade})\n**Improvement Step:** ${result.improvement}`;
                
                advisorHistoryService.saveMessage({
                    role: 'model',
                    text: masterMessage,
                    timestamp: Date.now(),
                    isSystemPush: true
                });

                if (result.innovation) {
                    innovationService.addProposal(result.innovation);
                }
            }
        } catch (e) {
            console.error("[ForensicAuditor] Immediate Audit Failed", e);
        }
    }

    private async analyzeBackground(groove: GrooveObject) {
        if (this.isAnalyzing) return;
        this.isAnalyzing = true;

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `
            ROLE: Background Studio Assistant.
            CONTEXT: User is idle. Project: ${groove.genre} @ ${groove.bpm}.
            TASK: Short studio tip for orchestration or arrangement.
            OUTPUT JSON: { "message": "..." }
            `;

            const response = await ai.models.generateContent({
                model: this.MONITOR_MODEL,
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: "application/json" }
            });

            if (response.text) {
                const result = JSON.parse(response.text.replace(/```json\n?|```/g, ""));
                if (result.message) {
                    advisorHistoryService.saveMessage({
                        role: 'model',
                        text: `💡 **Studio Tip:** ${result.message}`,
                        timestamp: Date.now(),
                        isSystemPush: true
                    });
                }
            }
        } catch (e) {
            // Silent fail for background quota errors
        } finally {
            this.isAnalyzing = false;
        }
    }
}

export const forensicAuditorService = new ForensicAuditorService();
