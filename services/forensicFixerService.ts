import { GoogleGenAI } from "@google/genai";
import { GrooveObject, NoteEvent, ChannelKey } from '../types';
import { optimizationService } from './optimizationService';
import { advisorHistoryService } from './advisorHistoryService';

/**
 * FORENSIC FIXER SERVICE V1.1
 * The "Master Producer" that audits and heals projects before they reach the user.
 * Reinforced with Rate-Limit protection and Fallback logic.
 */
export class ForensicFixerService {
    constructor() {}

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Perform a deep musical audit and apply corrections.
     */
    public async auditAndHeal(groove: GrooveObject): Promise<GrooveObject> {
        // Correct initialization right before usage
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        console.log(`[ForensicFixer] Auditing project: ${groove.name}`);
        
        const summary = {
            target: { genre: groove.genre, key: groove.key, scale: groove.scale, bpm: groove.bpm },
            structure: groove.totalBars + " bars",
            activeTracks: Object.keys(groove).filter(k => k.startsWith('ch') && (groove as any)[k].length > 0)
        };

        const prompt = `
        ROLE: MASTER MUSIC PRODUCER & FORENSIC MIDI AUDITOR.
        TASK: Audit the raw MIDI generation below. Detect musical issues and provide a list of OPTIMIZATION commands to fix them.
        
        CRITERIA:
        - Humanization: If notes are too rigid (0-tick drift), suggest VELOCITY_HUMANIZE or RHYTHMIC_OFFSET.
        - Harmonic Integrity: Ensure all tracks follow ${groove.key} ${groove.scale}.
        - Genre Physics: If this is ${groove.genre}, ensure the Kick/Bass relationship is perfect.
        
        PROJECT: ${JSON.stringify(summary)}

        OUTPUT FORMAT (JSON ARRAY ONLY):
        [
            { "operation": "SCALE_QUANTIZE", "params": { "targetTrack": "ch4_leadA", "root": "${groove.key}", "mode": "${groove.scale}" } },
            { "operation": "VELOCITY_HUMANIZE", "params": { "targetTrack": "ch4_leadA", "amount": 0.15 } }
        ]
        If no critical fixes are needed, return an empty array [].
        `;

        let attempts = 0;
        const maxAttempts = 3;
        let lastError: any = null;

        while (attempts < maxAttempts) {
            try {
                // V1.1 Fix: Fallback to Flash if Pro hits quota or after first failure
                const modelToUse = attempts === 0 ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
                
                const response = await ai.models.generateContent({
                    model: modelToUse,
                    contents: { parts: [{ text: prompt }] },
                    config: { responseMimeType: "application/json" }
                });

                const fixes = JSON.parse(response.text || "[]");
                let healedGroove = JSON.parse(JSON.stringify(groove));

                console.log("[ForensicFixer] Applying Mandatory System Sync Protocol...");
                healedGroove = optimizationService.applyCommand(healedGroove, { operation: 'SYSTEM_SYNC', params: {} });

                if (fixes.length > 0) {
                    fixes.forEach((cmd: any) => {
                        healedGroove = optimizationService.applyCommand(healedGroove, cmd);
                    });

                    advisorHistoryService.saveMessage({
                        role: 'model',
                        text: `🛠️ **תיקון מוזיקלי אוטומטי:** המערכת ביצעה סנכרון מלא (System Sync) וזיהתה ${fixes.length} שיפורים נוספים.`,
                        timestamp: Date.now(),
                        isSystemPush: true
                    });
                } else {
                    advisorHistoryService.saveMessage({
                        role: 'model',
                        text: `✅ **סנכרון הושלם:** הקוד (Convergence Code) הופעל בהצלחה. מערכת התופים והמלודיות נעולים ומסונכרנים.`,
                        timestamp: Date.now(),
                        isSystemPush: true
                    });
                }

                return healedGroove;
            } catch (e: any) {
                attempts++;
                lastError = e;
                const isRateLimit = e.message?.includes('429') || e.status === 'RESOURCE_EXHAUSTED';
                
                if (isRateLimit) {
                    console.warn(`[ForensicFixer] Quota reached (Attempt ${attempts}). Waiting and retrying...`);
                    await this.sleep(2000 * attempts); // Exponential backoff
                } else {
                    console.error("[ForensicFixer] Audit error:", e);
                    break; 
                }
            }
        }

        // Final fallback if all AI attempts fail
        console.warn("[ForensicFixer] Audit exhausted, proceeding with baseline healing protocols only.");
        advisorHistoryService.saveMessage({
            role: 'model',
            text: `⚠️ **עומס במערכת:** המערכת מדלגת על ניתוח AI מעמיק ועוברת לפרוטוקול תיקון בסיסי (Safe-Mode) כדי לא לעכב את היצירה.`,
            timestamp: Date.now(),
            isSystemPush: true
        });
        return optimizationService.applyCommand(groove, { operation: 'SYSTEM_SYNC', params: {} });
    }
}

export const forensicFixerService = new ForensicFixerService();