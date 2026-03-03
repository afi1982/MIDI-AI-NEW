
/**
 * ELECTRONIC MUSIC MIDI GENERATOR (EMG) - SOURCE CODE REPOSITORY
 * VERSION: V83.0 (REV 7)
 * 
 * Contains live logic for forensic verification.
 */

// 1. MAESTRO CORE V83
export const MAESTRO_CORE_CODE = `
// services/maestroService.ts
// V83 IMPLEMENTATION (INTENT ENGINE)

// --- INTENT CHECK (Every 4 bars) ---
if (isPhraseStart) {
    const barsSinceLastLead = bar - lastLeadEndBar;
    
    // Lead Scarcity Logic (Goa Rule)
    // "Is this phrase introducing a new idea, or repeating motion?"
    if (isDrop || isBreak) {
        phraseIntent = 'STATEMENT'; 
    } else {
        // Build / General Flow: Enforce Scarcity
        if (barsSinceLastLead >= rules.leadScarcity) {
            // We are allowed to speak. Roll for it.
            phraseIntent = Math.random() > 0.4 ? 'STATEMENT' : 'REST';
        } else {
            // FORCED REST: Arp/Pad must carry the journey.
            phraseIntent = 'REST';
        }
    }
}
`;

// 2. QA PIPELINE V56.2
export const QA_PIPELINE_CODE = `
// services/qaService.ts
// V56.2 (Rev 5) VALIDATION
export const runGrooveQA = (groove) => {
    // 1. ELITE 15-CHANNEL CHECK
    const eliteKeys = [
      'ch1_kick', 'ch2_sub', 'ch3_midBass', 'ch4_leadA', 'ch5_leadB', 
      'ch6_arpA', 'ch7_arpB', 'ch8_snare', 'ch9_clap', 'ch10_percLoop', 
      'ch11_percTribal', 'ch12_hhClosed', 'ch13_hhOpen', 'ch14_acid', 'ch15_pad'
    ];
    
    const missing = eliteKeys.filter(k => !groove[k] || groove[k].length === 0);
    if (missing.length > 0) return FAIL("Missing channels: " + missing.join(','));

    // 2. ZERO-TICK COMPLIANCE
    let driftDetected = false;
    allChannels.forEach(ch => {
        if (groove[ch].some(n => n.timingOffset !== 0)) driftDetected = true;
    });

    if (driftDetected) return FAIL("Global Sync Failed: Timing drift detected.");

    return PASS;
};
`;

// 3. CHANNEL MAP
export const CHANNEL_MAP_CODE = `
// V56 15-CHANNEL RIDER
const ELITE_15 = [
  'ch1_kick', 'ch2_sub', 'ch3_midBass', 
  'ch4_leadA', 'ch5_leadB', 'ch6_arpA', 'ch7_arpB', 
  'ch8_snare', 'ch9_clap', 
  'ch10_percLoop', 'ch11_percTribal', 
  'ch12_hhClosed', 'ch13_hhOpen', 
  'ch14_acid', 'ch15_pad'
];
`;

// 4. STUDIO FORENSIC ENGINE (VISUALIZER)
export const STUDIO_VISUALIZER_CODE = `
// components/StudioArrangement.tsx
// Visual Matrix Rendering Logic
const TrackRow = ({ trackKey }) => {
    // Renders absolute bar position based on Bar:Beat:Sixteenth
    // Verifies note existence visually against the grid.
    const leftPct = (barPos / totalBars) * 100;
    return <div style={{ left: leftPct + '%' }} />;
};
`;

// --- NEW: TECHNICAL STYLE DEFINITIONS ---
export const STYLE_DEFINITIONS_DOC = `
TECHNICAL SPECIFICATION: STYLE GENERATION & GOVERNANCE (V83)
===========================================================
Objective: Strict adherence to genre physics via Governor/Conductor architecture.

1. GOA TRANCE (604)
-------------------
- Bass Mode: GATED (Intermittent flow, allows Pad breathing)
- Lead Strategy: CALL_RESPONSE (Strict 8-bar phrasing)
- Lead Scarcity: 16 Bars (Requires "Journey" silence between "Statements")
- Humanization Cap: 0.20 (Organic variance allowed)
- Density: MED (60% artificial cap on generated notes)
- Dominant Pool: Arp A (Primary), Lead A (Secondary)
- Structure: Long Intro (20%), Gradual build, Spiritual Breaks.

2. PSYTRANCE (FULL-ON)
----------------------
- Bass Mode: CONTINUOUS (K-B-B-B Rolling)
- Lead Strategy: CONTINUOUS (Constant presence)
- Lead Scarcity: 4 Bars (Frequent interaction)
- Humanization Cap: 0.15 (Tight control for drive)
- Density: HIGH
- Dominant Pool: Lead A, Acid
- Structure: Standard (Intro 10%, Drop 25%)

3. TECHNO (PEAK TIME)
---------------------
- Bass Mode: SPARSE (Rumble/Offbeat only, No rolling lines)
- Lead Strategy: MINIMAL (Textures, Stabs, No melodies)
- Lead Scarcity: 32 Bars (Very rare, high impact)
- Humanization Cap: 0.10 (Machine precision)
- Density: LOW
- Dominant Pool: Kick, Rumble
- Structure: DJ Tool (Intro 20%, Loop-based)

4. MELODIC TECHNO
-----------------
- Bass Mode: GATED (Plucks with space)
- Lead Strategy: MINIMAL (Long sustained emotional notes)
- Lead Scarcity: 16 Bars (Emotional arcs)
- Humanization Cap: 0.30 (High expression allowed)
- Density: MED

GOVERNANCE LOGIC (The "Conductor"):
1. Intent Check: Before generating a phrase, check "Bars Since Last Lead".
2. Decision: If < Scarcity Limit, FORCE REST (Silence).
3. Dominance Arbitration: If Lead A is active, Lead B is suppressed (-12dB/Silence).
`;

// --- NEW: SYSTEM INTELLIGENCE DOC ---
export const ENGINE_INTELLIGENCE_DOC = `
SYSTEM INTELLIGENCE & CONNECTIVITY SPECIFICATION (V70)
=====================================================
Architecture: Hybrid AI/Algorithmic Pipeline

1. GLOBAL ENGINE (services/globalEngineService.ts)
-----------------------------------------------
- Function: Simulates connection to global market data.
- Sync Rate: Every session start.
- Logic:
  - Fetches regional trends (TLV, BER, MEL).
  - Injects Context: "Trending 146 BPM in Israel", "Focus on FM Leads".
  - Adjusts base generation parameters based on trend data.

2. GEMINI PRO 3 INTEGRATION (services/geminiService.ts)
------------------------------------------------------
- Model: gemini-3.1-pro-preview
- Role: "Elite Producer Protocol"
- Prompt Structure:
  - SYSTEM: "You are a World-Class Music Producer."
  - CONTEXT: Global Engine Injection + User Narrative.
  - CONSTRAINTS: Strict 16-channel manifest (Elite 16).
  - FORMAT: JSON (GrooveObject schema).
- Fallback: Hardcoded algorithmic generation if API fails (Circuit Breaker).

3. REFINEMENT ENGINE (services/engineProfileService.ts)
----------------------------------------------------
- Feedback Loop: User ratings (1-5) + Semantic Tags ("Boring", "No Hook").
- Optimization:
  - Updates 'GenreProfile' weights (Density, Velocity Bias).
  - Persists learned preferences to LocalStorage ('EMG_ENGINE_STATE').
  - Self-Healing: Reverts weights if rating drops below 3.0.

4. INTENT ENGINE (The Conductor)
--------------------------------
- Location: services/maestroService.ts
- Logic: Evaluates "Meaning vs Motion".
- Rule: "Has enough 'Journey' passed to justify a 'Statement'?"
- Action: Denies Lead generation if scarcity rules are not met, forcing Arp/Pad dominance.
`;

export const downloadStudioCode = () => {
    const fullReport = `EMG SYSTEM SOURCE DUMP V83 (REV 7)\n\n` + 
                       `--- MAESTRO ENGINE (GENERATION) ---\n${MAESTRO_CORE_CODE}\n\n` +
                       `--- QA PIPELINE (VALIDATION) ---\n${QA_PIPELINE_CODE}\n\n` +
                       `--- TECHNICAL RIDER (MAPPING) ---\n${CHANNEL_MAP_CODE}\n\n` +
                       `--- STUDIO VISUALIZER LOGIC ---\n${STUDIO_VISUALIZER_CODE}`;
    
    downloadTxt(fullReport, `EMG_SOURCE_V83_REV7.txt`);
};

export const downloadStyleDefinitions = () => {
    downloadTxt(STYLE_DEFINITIONS_DOC, `EMG_STYLE_DEFINITIONS_V83.txt`);
};

export const downloadSystemIntelligence = () => {
    downloadTxt(ENGINE_INTELLIGENCE_DOC, `EMG_ENGINE_LOGIC_V70.txt`);
};

const downloadTxt = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
};
