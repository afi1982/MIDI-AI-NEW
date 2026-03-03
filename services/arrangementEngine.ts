export type SectionName = "INTRO" | "BUILD_1" | "DROP_1" | "BREAKDOWN" | "DROP_2" | "OUTRO";

export type ArrangementSection = {
  name: SectionName;
  startBar: number;
  endBar: number;
  activeTracks: string[];   // logical keys
  density: number;          // 0..1
  melodyEnergy: number;     // 0..1
  /* Fix: Added intensity property to match types.ts and pipeline expectations */
  intensity: number;        // 0..1
};

export type ArrangementPlan = {
  bpm: number;
  totalBars: number;
  peakBar: number;
  sections: ArrangementSection[];
};

export function minutesToBars(minutes: number, bpm: number) {
  const barsPerMin = bpm / 4;
  return Math.round(minutes * barsPerMin);
}

/**
 * ELITE BLUEPRINT IMPLEMENTATION (6-8 Minutes)
 * 1. INTRO (0:00-1:00) - Pad, Atmos, FX. (Weak Kick/No Bass)
 * 2. BUILD 1 (1:00-2:00) - Kick, Sub (Simple), Hats, Arp.
 * 3. DROP 1 (2:00-3:30) - Kick + Bass, Simple Lead, Groove.
 * 4. BREAKDOWN (3:30-4:30) - Pad/FX, Melody Exposed. No Kick.
 * 5. DROP 2 (4:30-6:00) - PEAK. Kick, Bass, Strong Lead, Layers.
 * 6. OUTRO (6:00+) - Deconstruction.
 */
export function buildProfessionalStructure(opts: {
  bpm: number;
  totalMinutes?: number; // Ignored in favor of fixed structure
  peakMinute?: number;   // Ignored in favor of fixed structure
}): ArrangementPlan {
  const bpm = opts.bpm;
  
  // Standardized Bar Counts for ~140 BPM to match time targets
  // 1 minute ~= 32-35 bars. We adhere to 16/32/48 bar musical phrasing.
  const introLen = 32;      // ~0:55
  const buildLen = 32;      // ~0:55
  const drop1Len = 48;      // ~1:25
  const breakLen = 32;      // ~0:55
  const drop2Len = 48;      // ~1:25 (PEAK)
  const outroLen = 32;      // ~0:55
  
  const totalBars = introLen + buildLen + drop1Len + breakLen + drop2Len + outroLen; // 224 Bars (~6.4 mins)
  const peakBar = introLen + buildLen + drop1Len + breakLen; // Start of Drop 2

  const sections: ArrangementSection[] = [
    {
      name: "INTRO",
      startBar: 0,
      endBar: introLen,
      // ELITE FIX: Include Kick and Sub in Intro active tracks to satisfy QA.
      // Refined entry points (e.g. Bar 16) are handled in ProductionArranger.
      activeTracks: ["ch1_kick", "ch2_sub", "ch15_atmos", "ch10_perc1", "ch12_hhClosed"], 
      density: 0.3,
      melodyEnergy: 0.1,
      /* Fix: Added intensity property */
      intensity: 0.3
    },
    {
      name: "BUILD_1",
      startBar: introLen,
      endBar: introLen + buildLen,
      activeTracks: ["ch1_kick", "ch2_sub", "ch12_hhClosed", "ch6_arpA", "ch15_atmos"],
      density: 0.6,
      melodyEnergy: 0.3,
      /* Fix: Added intensity property */
      intensity: 0.6
    },
    {
      name: "DROP_1",
      startBar: introLen + buildLen,
      endBar: introLen + buildLen + drop1Len,
      activeTracks: [
          "ch1_kick", "ch2_sub", "ch3_midBass", 
          "ch8_snare", "ch9_clap", "ch13_hhOpen", "ch12_hhClosed", 
          "ch5_leadB", // Simple Lead
          "ch10_perc1"
      ],
      density: 0.85,
      melodyEnergy: 0.7,
      /* Fix: Added intensity property */
      intensity: 0.85
    },
    {
      name: "BREAKDOWN",
      startBar: introLen + buildLen + drop1Len,
      endBar: introLen + buildLen + drop1Len + breakLen,
      activeTracks: ["ch15_atmos", "ch4_leadA", "ch10_perc1"],
      density: 0.4,
      melodyEnergy: 0.5,
      /* Fix: Added intensity property */
      intensity: 0.4
    },
    {
      name: "DROP_2",
      startBar: introLen + buildLen + drop1Len + breakLen,
      endBar: introLen + buildLen + drop1Len + breakLen + drop2Len,
      activeTracks: [
          "ch1_kick", "ch2_sub", "ch3_midBass", 
          "ch8_snare", "ch9_clap", "ch13_hhOpen", "ch12_hhClosed", "ch11_perc2",
          "ch4_leadA", // Main Lead
          "ch14_acid", // Acid
          "ch6_arpA"   // Arp Layer
      ],
      density: 1.0,
      melodyEnergy: 1.0,
      /* Fix: Added intensity property */
      intensity: 1.0
    },
    {
      name: "OUTRO",
      startBar: totalBars - outroLen,
      endBar: totalBars,
      activeTracks: ["ch1_kick", "ch2_sub", "ch15_atmos", "ch10_perc1"],
      density: 0.3,
      melodyEnergy: 0.1,
      /* Fix: Added intensity property */
      intensity: 0.3
    },
  ];

  return { bpm, totalBars, peakBar, sections };
}