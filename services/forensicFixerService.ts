diff --git a/services/geminiService.ts b/services/geminiService.ts
index ae7dc9a453d1fff27b87edf7476f582a8a174125..27a040890224c56953c2e2ce9ab34a0b8435b2a3 100644
--- a/services/geminiService.ts
+++ b/services/geminiService.ts
@@ -1,60 +1,74 @@
 
 import { GoogleGenAI } from "@google/genai";
 import { GenerationParams, AetherGenome, ChannelKey } from '../types';
 
 const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
 
 export const generateTranceSequence = async (params: GenerationParams, channels?: ChannelKey[]): Promise<AetherGenome> => {
     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
     const channelList = channels ? channels.join(', ') : 'All Channels';
     
     const prompt = `
-    Act as a Professional Psytrance Music Producer.
-    Generate a full track genome for:
+    Act as a Senior Psytrance + Loop Design Producer.
+    Generate a high-quality 4-bar loop genome for:
     Genre: ${params.genre}
     BPM: ${params.bpm}
     Key: ${params.key} ${params.scale}
     Target Channels: ${channelList}
-    
-    BASSLINE SPECIFICATION (Strictly for ch2_sub and ch3_midBass):
-    - Use a 1/16th Grid (120 Ticks).
-    - Prioritize slots 2, 3, and 4 of each beat (K-B-B-B pattern).
-    - Implement Octave Call and Response: foundation on C1, movement on C2.
-    - Note Gate: 60-84 Ticks (50-70% of slot).
-    - Sidechain: Never place bass on slot 0 (Kick position).
-    
-    Output valid JSON matching this structure:
+
+    CRITICAL QUALITY RULES (applies to Main creation + LOOP flow):
+    1) Tight groove: all notes must sit exactly on 1/16 steps (s = 0..15 per bar).
+    2) Musical key lock: tonal channels must stay in key/scale (no out-of-scale notes).
+    3) Channel role separation:
+       - ch1_kick: 4-on-floor foundation
+       - ch2_sub + ch3_midBass: rolling bass, never on kick slot
+       - lead/arp channels: phrase-based, not random note spam
+       - percussion/hat channels: support groove, controlled density
+    4) Anti-repetition: introduce subtle variation between bars 1-4.
+    5) No empty channels in the requested target list.
+
+    BASSLINE SPECIFICATION (Strict for ch2_sub and ch3_midBass):
+    - Use a 1/16th Grid (120 ticks).
+    - Prioritize slots 1,2,3 of each beat (K-B-B-B behavior).
+    - Note length 60-84 ticks.
+    - Never place bass on step%4==0 (kick positions).
+
+    Output valid JSON only:
     {
       "trackName": "Generated Track",
       "patterns": {
-        "ch1_kick": { "notes": [{"n":"C1","s":0,"v":1,"d":120}, ...] },
-        "ch2_sub": { "notes": [{"n":"F#1","s":1,"v":0.9,"d":70}, {"n":"F#1","s":2,"v":0.9,"d":70}, ...] }
+        "ch1_kick": { "notes": [{"n":"C1","s":0,"v":1,"d":120}] },
+        "ch2_sub": { "notes": [{"n":"F#1","s":1,"v":0.9,"d":72}] }
       }
     }
-    Use 's' for 16th step index (0-15).
-    Ensure patterns are genre-appropriate.
+
+    Constraints:
+    - s must be integer 0..15
+    - v range: 0.35..1.0
+    - d range: 40..240
+    - Return only JSON, no markdown text.
     `;
 
     const models = ["gemini-3-pro-preview", "gemini-3-flash-preview"];
     
     for (const model of models) {
         try {
             const response = await ai.models.generateContent({
                 model: model,
                 contents: { parts: [{ text: prompt }] },
                 config: { responseMimeType: "application/json" }
             });
             
             const result = JSON.parse(response.text || '{}');
             return result;
         } catch (e: any) {
             const isRateLimit = e.message?.includes('429') || e.status === 'RESOURCE_EXHAUSTED';
             if (isRateLimit && model !== models[models.length - 1]) {
                 console.warn(`[GeminiService] ${model} exhausted, falling back to next model...`);
                 await sleep(1000);
                 continue;
             }
             console.error(`AI Generation Failed with ${model}`, e);
         }
     }
     return { trackName: "Fallback", patterns: {} };
