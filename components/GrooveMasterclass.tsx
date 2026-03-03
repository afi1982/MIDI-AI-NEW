
import React, { useState } from 'react';
import { ChannelKey } from '../types';
import { downloadStudioCode } from '../services/sourceCodeService';

// --- DATA MODELS ---

type ZoneId = 'HIT' | 'MOVE' | 'FLOW' | 'ACCENT' | 'STORY' | 'TRANSITION';
type ValidationResult = 'CORRECT' | 'ACCEPTABLE' | 'INCORRECT' | 'STRICT_FAIL';
type ChannelCategory = 'FOUNDATION' | 'RHYTHM' | 'MELODY' | 'FX';
type MasterclassPhase = 'MENU' | 'BRIEFING' | 'ACTION' | 'DEBRIEF' | 'LEVEL_COMPLETE';
type DifficultyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

interface ZoneDef {
    id: ZoneId;
    label: string;
    tagline: string;
    color: string;
    icon: string;
}

interface ChannelEduDef {
    id: ChannelKey;
    label: string;
    category: ChannelCategory;
    roleName: string; 
    definition: string; 
    goldenRule: string; 
    correct: ZoneId[];
    acceptable: ZoneId[];
    feedback: {
        CORRECT: string;
        ACCEPTABLE: string;
        WRONG: string;
    }
}

// --- CONFIGURATION ---

const ZONES: ZoneDef[] = [
    { id: 'HIT', label: 'THE HIT', tagline: 'Immediate Impact', color: 'border-red-500 hover:bg-red-500/10', icon: '💥' },
    { id: 'MOVE', label: 'THE MOVE', tagline: 'Driving Force', color: 'border-blue-500 hover:bg-blue-500/10', icon: '🏃' },
    { id: 'FLOW', label: 'THE FLOW', tagline: 'The Glue', color: 'border-purple-500 hover:bg-purple-500/10', icon: '🌊' },
    { id: 'ACCENT', label: 'THE ACCENT', tagline: 'Rhythmic Spike', color: 'border-yellow-500 hover:bg-yellow-500/10', icon: '✨' },
    { id: 'STORY', label: 'THE STORY', tagline: 'Emotional Core', color: 'border-pink-500 hover:bg-pink-500/10', icon: '📖' },
    { id: 'TRANSITION', label: 'THE SHIFT', tagline: 'Tension & Release', color: 'border-white hover:bg-white/10', icon: '🚀' }
];

// LEVEL DEFINITIONS
// FIX: Updated channel keys to match types.ts architecture (ch1-ch15)
const LEVELS: Record<DifficultyLevel, { label: string; sub: string; channels: ChannelKey[] }> = {
    BEGINNER: {
        label: "Level 1: Foundations",
        sub: "Master the core rules. No ambiguity.",
        /* Fix: Standardized key to ch11_percTribal */
        channels: ['ch1_kick', 'ch2_sub', 'ch12_hhClosed', 'ch8_snare', 'ch11_percTribal']
    },
    INTERMEDIATE: {
        label: "Level 2: The Groove",
        sub: "Understand relationships & texture.",
        /* Fix: Standardized keys to ch10_percLoop, ch11_percTribal, ch15_pad */
        channels: ['ch13_hhOpen', 'ch10_percLoop', 'ch5_leadB', 'ch11_percTribal', 'ch15_pad']
    },
    ADVANCED: {
        label: "Level 3: Creative Flow",
        sub: "Advanced placement & rule breaking.",
        /* Fix: Standardized key to ch15_pad */
        channels: ['ch4_leadA', 'ch14_acid', 'ch6_arpA', 'ch15_pad', 'ch15_pad']
    }
};

const CHANNEL_SYLLABUS: Record<ChannelKey, ChannelEduDef> = {
    ch1_kick: {
        id: 'ch1_kick', label: 'Kick Drum', category: 'FOUNDATION',
        roleName: 'The Anchor',
        definition: "The heaviest element. It defines the grid and provides the pulse.",
        goldenRule: "The Kick demands attention. It usually owns the 'HIT' zone.",
        correct: ['HIT'], acceptable: [],
        feedback: {
            CORRECT: "Correct. The kick defines the starting point of the groove. Everything else moves around it.",
            ACCEPTABLE: "",
            WRONG: "Not quite. If the kick doesn't hit hard on the grid, the track loses its heartbeat."
        }
    },
    ch2_sub: {
        id: 'ch2_sub', label: 'Sub Bass', category: 'FOUNDATION',
        roleName: 'The Body',
        definition: "Pure low-end energy that physically moves the listener.",
        goldenRule: "Sub Bass must breathe. It usually follows the Kick.",
        correct: ['MOVE'], acceptable: ['FLOW'],
        feedback: {
            CORRECT: "Spot on. The bass drives the motion immediately after the kick.",
            ACCEPTABLE: "This works for rolling basslines, but usually we want more drive.",
            WRONG: "Careful. Placing sub bass on the Hit clashes with the Kick's frequencies."
        }
    },
    ch3_midBass: {
        id: 'ch3_midBass', label: 'Mid Bass', category: 'FOUNDATION',
        roleName: 'The Grit',
        definition: "The audible texture of the bass line.",
        goldenRule: "Layers on top of the Sub Bass to help it cut through.",
        correct: ['MOVE'], acceptable: ['FLOW'],
        feedback: {
            CORRECT: "Yes. Mid bass adds grit to the driving force.",
            ACCEPTABLE: "Acceptable as a texture layer, but lacks power.",
            WRONG: "Too heavy to be an accent, too weak to be a hit."
        }
    },
    ch8_snare: {
        id: 'ch8_snare', label: 'Snare', category: 'RHYTHM',
        roleName: 'The Snap',
        definition: "Sharp, mid-range hit that creates the backbeat.",
        goldenRule: "The Snare provides the 'Counter-Punch' to the Kick.",
        correct: ['ACCENT'], acceptable: ['TRANSITION'],
        feedback: {
            CORRECT: "Correct. The snare accents the backbeat (2 and 4), creating the rhythm.",
            ACCEPTABLE: "Okay for build-ups, but not for the main groove.",
            WRONG: "Snares are too sharp for flow or foundation."
        }
    },
    ch9_clap: {
        id: 'ch9_clap', label: 'Clap', category: 'RHYTHM',
        roleName: 'The Width',
        definition: "A wide, splashy hit used to layer the rhythm.",
        goldenRule: "Layered with Snare or used to accentuate the loop.",
        correct: ['ACCENT'], acceptable: ['STORY'],
        feedback: {
            CORRECT: "Perfect. Claps widen the stereo image on the rhythmic accents.",
            ACCEPTABLE: "Creative use, but unconventional.",
            WRONG: "Claps need to snap, not flow."
        }
    },
    ch12_hhClosed: {
        id: 'ch12_hhClosed', label: 'Closed Hat', category: 'RHYTHM',
        roleName: 'The Clock',
        definition: "Fast, ticking metallic sound. Keeps the time.",
        goldenRule: "The 'Grid' that holds other drums together.",
        correct: ['FLOW'], acceptable: ['MOVE'],
        feedback: {
            CORRECT: "Exactly. Closed hats create the constant flow that glues the drums.",
            ACCEPTABLE: "Adds drive, but can feel too busy if it overpowers the bass.",
            WRONG: "Hi-hats are too weak to be hits or accents."
        }
    },
    ch13_hhOpen: {
        id: 'ch13_hhOpen', label: 'Open Hat', category: 'RHYTHM',
        roleName: 'The Lift',
        definition: "Longer metallic sound. Creates the 'Up' feeling.",
        goldenRule: "Usually lives on the 'Off-Beat' (the 'and' of 1 & 2).",
        correct: ['ACCENT'], acceptable: ['TRANSITION'],
        feedback: {
            CORRECT: "Yes! Open hats lift the energy on the off-beat accent.",
            ACCEPTABLE: "Good for transitions, but the off-beat is their home.",
            WRONG: "Dragging an open hat kills the momentum."
        }
    },
    /* Fix: Renamed ch10_perc1 to ch10_percLoop to match manifest */
    ch10_percLoop: {
        id: 'ch10_percLoop', label: 'Tribal Perc', category: 'RHYTHM',
        roleName: 'The Motion',
        definition: "Organic drums (bongos, toms) that add human feel.",
        goldenRule: "Percussion fills the gaps between the main drums.",
        correct: ['MOVE'], acceptable: ['FLOW'],
        feedback: {
            CORRECT: "Nice. Percussion adds complex motion between the main beats.",
            ACCEPTABLE: "Works as a background loop, but better as a driver.",
            WRONG: "Don't let percussion clash with the main kick/snare hits."
        }
    },
    ch4_leadA: {
        id: 'ch4_leadA', label: 'Main Lead', category: 'MELODY',
        roleName: 'The Protagonist',
        definition: "The main voice of the track. It sings the hook.",
        goldenRule: "The Lead tells the story. Give it space to be heard.",
        correct: ['STORY'], acceptable: ['ACCENT'],
        feedback: {
            CORRECT: "Correct. The lead carries the melody and emotional story.",
            ACCEPTABLE: "Rhythmic stabs work, but they aren't the main story.",
            WRONG: "Melodies need space. Don't bury them in the rhythm section."
        }
    },
    ch14_acid: {
        id: 'ch14_acid', label: 'Acid 303', category: 'MELODY',
        roleName: 'The Hypnotist',
        definition: "Resonant, squelchy synth lines that evolve over time.",
        goldenRule: "Acid bridges the gap between Rhythm and Melody.",
        correct: ['MOVE', 'STORY'], acceptable: ['ACCENT'],
        feedback: {
            CORRECT: "Yes. Acid lines drive the track forward with hypnotic motion.",
            ACCEPTABLE: "Good for accents, but Acid wants to roll.",
            WRONG: "Acid is too busy to be a static hit."
        }
    },
    /* Fix: Renamed ch15_atmos to ch15_pad to match manifest */
    ch15_pad: {
        id: 'ch15_pad', label: 'Atmosphere', category: 'MELODY',
        roleName: 'The Horizon',
        definition: "Long, sustained chords that set the mood.",
        goldenRule: "Pads sit in the back, filling the empty space.",
        correct: ['STORY'], acceptable: ['FLOW'],
        feedback: {
            CORRECT: "Perfect. Pads provide the emotional context/story.",
            ACCEPTABLE: "Okay as a texture, but usually static.",
            WRONG: "Pads have no impact. They belong in the background."
        }
    },
    ch6_arpA: {
        id: 'ch6_arpA', label: 'Arpeggio', category: 'MELODY',
        roleName: 'The Current',
        definition: "Fast, repeating sequence of notes.",
        goldenRule: "Arpeggio create a sense of speed without being heavy.",
        correct: ['FLOW'], acceptable: ['STORY'],
        feedback: {
            CORRECT: "Nice. Arps create a river of sound (Flow).",
            ACCEPTABLE: "Can double as a melody, but usually repetitive.",
            WRONG: "Too fast for impact or accents."
        }
    },
    ch5_leadB: { id: 'ch5_leadB', label: 'Lead B', category: 'MELODY', roleName: '', definition: '', goldenRule: '', correct: [], acceptable: [], feedback: { CORRECT: '', ACCEPTABLE: '', WRONG: '' } },
    ch7_arpB: { id: 'ch7_arpB', label: 'Arp B', category: 'MELODY', roleName: '', definition: '', goldenRule: '', correct: [], acceptable: [], feedback: { CORRECT: '', ACCEPTABLE: '', WRONG: '' } },
    /* Fix: Renamed ch11_perc2 to ch11_percTribal */
    ch11_percTribal: { id: 'ch11_percTribal', label: 'Perc 2', category: 'RHYTHM', roleName: '', definition: '', goldenRule: '', correct: [], acceptable: [], feedback: { CORRECT: '', ACCEPTABLE: '', WRONG: '' } },
    ch16_synth: { id: 'ch16_synth', label: 'Synth FX', category: 'FX', roleName: '', definition: '', goldenRule: '', correct: [], acceptable: [], feedback: { CORRECT: '', ACCEPTABLE: '', WRONG: '' } }
};

const GrooveMasterclass: React.FC = () => {
    // State
    const [level, setLevel] = useState<DifficultyLevel>('BEGINNER');
    const [phase, setPhase] = useState<MasterclassPhase>('MENU');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [feedback, setFeedback] = useState<{ status: ValidationResult, text: string, zoneId: ZoneId } | null>(null);

    // Derived
    const currentChannelKey = LEVELS[level].channels[currentIndex];
    const currentEdu = CHANNEL_SYLLABUS[currentChannelKey];
    const progress = Math.round(((currentIndex) / LEVELS[level].channels.length) * 100);

    // --- HANDLERS ---

    const handleLevelSelect = (lvl: DifficultyLevel) => {
        setLevel(lvl);
        setCurrentIndex(0);
        setPhase('BRIEFING');
    };

    const handleActionStart = () => {
        setPhase('ACTION');
    };

    const handleZoneInteraction = (zoneId: ZoneId) => {
        const rule = currentEdu;
        let result: ValidationResult = 'INCORRECT';
        let text = rule.feedback.WRONG;

        // Validation Logic
        if (rule.correct.includes(zoneId)) {
            result = 'CORRECT';
            text = rule.feedback.CORRECT;
        } else if (rule.acceptable.includes(zoneId)) {
            // LEVEL LOGIC: Strictness check
            if (level === 'BEGINNER') {
                result = 'STRICT_FAIL';
                text = "In the beginning, stick to the Golden Rule. This is acceptable later, but focus on the primary role now.";
            } else {
                result = 'ACCEPTABLE';
                text = rule.feedback.ACCEPTABLE;
            }
        }

        setFeedback({ status: result, text, zoneId });
        setPhase('DEBRIEF');
    };

    const handleNext = () => {
        if (currentIndex < LEVELS[level].channels.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setPhase('BRIEFING');
            setFeedback(null);
        } else {
            setPhase('LEVEL_COMPLETE');
        }
    };

    const handleRetry = () => {
        setPhase('ACTION');
        setFeedback(null);
    };

    const handleBackToMenu = () => {
        setPhase('MENU');
        setCurrentIndex(0);
        setFeedback(null);
    };

    // --- RENDERERS ---

    // 1. MENU
    if (phase === 'MENU') {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-[#050505] p-6 text-center animate-in fade-in">
                <div className="mb-8">
                    <h1 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter mb-2">
                        Production <span className="text-studio-accent">Masterclass</span>
                    </h1>
                    <p className="text-gray-400 uppercase tracking-widest text-xs md:text-sm">Select Your Clearance Level</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
                    {(Object.keys(LEVELS) as DifficultyLevel[]).map(lvl => (
                        <button 
                            key={lvl}
                            onClick={() => handleLevelSelect(lvl)}
                            className="group relative bg-[#111] border border-white/10 hover:border-studio-accent rounded-xl p-8 transition-all hover:bg-white/5 text-left"
                        >
                            <div className="text-xs font-bold text-studio-dim uppercase tracking-widest mb-2 group-hover:text-white">{lvl}</div>
                            <h3 className="text-2xl font-black text-white uppercase mb-2 italic">{LEVELS[lvl].label}</h3>
                            <p className="text-gray-500 text-sm leading-relaxed">{LEVELS[lvl].sub}</p>
                            <div className="mt-6 flex gap-1">
                                {LEVELS[lvl].channels.map(c => (
                                    <div key={c} className="w-1 h-3 bg-studio-accent/30 rounded-full"></div>
                                ))}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // 5. COMPLETION
    if (phase === 'LEVEL_COMPLETE') {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-[#050505] p-8 text-center animate-in zoom-in">
                <div className="mb-6 text-6xl">🏆</div>
                <h1 className="text-4xl font-display font-black text-white uppercase tracking-tighter mb-4">
                    {LEVELS[level].label} <span className="text-studio-accent">Complete</span>
                </h1>
                <p className="text-gray-400 max-w-lg mx-auto leading-relaxed mb-8">
                    You have mastered this section of the syllabus.
                </p>
                <button 
                    onClick={handleBackToMenu}
                    className="bg-studio-accent text-black px-10 py-4 rounded-full font-bold uppercase tracking-widest hover:scale-105 transition-transform shadow-glow"
                >
                    Return to Masterclass
                </button>
            </div>
        );
    }

    // MAIN LEARNING LOOP
    return (
        <div className="flex flex-col h-full bg-[#050505] text-white font-sans overflow-hidden">
            
            {/* TOP BAR */}
            <div className="h-16 border-b border-white/10 bg-[#0A0A0B] flex items-center justify-between px-6 shrink-0 z-20">
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                        {LEVELS[level].label} • Lesson {currentIndex + 1}
                    </span>
                    <h2 className="text-lg font-bold text-white uppercase">{currentEdu.label}</h2>
                </div>
                <div className="w-1/3 hidden md:block bg-white/5 rounded-full h-1 overflow-hidden">
                    <div className="h-full bg-studio-accent transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={downloadStudioCode}
                        className="text-[9px] text-studio-accent border border-studio-accent/30 px-3 py-1 rounded hover:bg-studio-accent hover:text-black uppercase font-bold transition-all"
                    >
                        QA Code
                    </button>
                    <button onClick={handleBackToMenu} className="text-[9px] text-gray-600 hover:text-white uppercase font-bold">Exit</button>
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center p-4">
                
                {/* PHASE 1: BRIEFING */}
                {phase === 'BRIEFING' && (
                    <div className="max-w-md w-full bg-[#111] border border-white/10 rounded-2xl p-8 shadow-2xl animate-in slide-in-from-right-8 duration-300">
                        <span className="text-studio-accent text-xs font-bold uppercase tracking-widest mb-4 block">Target Analysis</span>
                        <h1 className="text-4xl font-display font-black text-white uppercase tracking-tight mb-2">
                            {currentEdu.roleName}
                        </h1>
                        <p className="text-gray-400 text-lg leading-relaxed mb-8 font-light border-b border-white/10 pb-6">
                            {currentEdu.definition}
                        </p>
                        <button 
                            onClick={handleActionStart}
                            className="w-full bg-white text-black py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-studio-accent transition-colors shadow-glow"
                        >
                            Start Masterclass
                        </button>
                    </div>
                )}

                {/* PHASE 2: ACTION (CLICK INTERACTION) */}
                {phase === 'ACTION' && (
                    <div className="w-full max-w-5xl h-full flex flex-col animate-in fade-in duration-300">
                        <div className="text-center mb-8 shrink-0">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                                Where does the <span className="text-studio-accent">{currentEdu.label}</span> belong?
                            </h3>
                            {/* EDUCATIONAL HINT */}
                            <div className="mt-4 inline-block bg-studio-accent/5 border border-studio-accent/20 rounded-lg px-6 py-2">
                                <p className="text-studio-accent text-xs font-mono font-bold uppercase tracking-wider">
                                    HINT: {currentEdu.goldenRule}
                                </p>
                            </div>
                        </div>

                        {/* CLICKABLE ZONES */}
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4 mb-20 md:mb-0">
                            {ZONES.map(zone => (
                                <button 
                                    key={zone.id}
                                    onClick={() => handleZoneInteraction(zone.id)}
                                    className={`
                                        relative rounded-xl border-2 bg-black/40 flex flex-col items-center justify-center group transition-all duration-200
                                        ${zone.color} border-opacity-20 hover:border-opacity-100 hover:scale-[1.02] active:scale-95
                                    `}
                                >
                                    <div className="text-4xl mb-3 grayscale group-hover:grayscale-0 transition-all">{zone.icon}</div>
                                    <h4 className="text-xl font-black text-white uppercase tracking-tight">{zone.label}</h4>
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-1 opacity-60 group-hover:opacity-100">{zone.tagline}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* PHASE 3: DEBRIEF (FEEDBACK) */}
                {phase === 'DEBRIEF' && feedback && (
                    <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-50 duration-200">
                        <div className={`max-w-lg w-full bg-[#111] border-2 rounded-2xl p-8 shadow-2xl text-center ${
                            feedback.status === 'CORRECT' ? 'border-green-500' : 
                            feedback.status === 'ACCEPTABLE' ? 'border-yellow-500' : 'border-red-500'
                        }`}>
                            <div className="text-6xl mb-6">
                                {feedback.status === 'CORRECT' ? '✅' : feedback.status === 'ACCEPTABLE' ? '⚠️' : '❌'}
                            </div>
                            
                            <h2 className={`text-3xl font-black uppercase tracking-tight mb-2 ${
                                feedback.status === 'CORRECT' ? 'text-green-400' : 
                                feedback.status === 'ACCEPTABLE' ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                                {feedback.status === 'CORRECT' ? 'That is Correct' : 
                                 feedback.status === 'ACCEPTABLE' ? 'Acceptable' : 'Incorrect'}
                            </h2>

                            {feedback.status === 'STRICT_FAIL' && (
                                <span className="inline-block bg-red-900/30 text-red-400 text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded mb-4">
                                    Beginner Mode Constraint
                                </span>
                            )}
                            
                            <p className="text-white text-lg leading-relaxed mb-8 border-t border-white/10 pt-6">
                                "{feedback.text}"
                            </p>

                            <div className="flex gap-4 justify-center">
                                {(feedback.status === 'INCORRECT' || feedback.status === 'STRICT_FAIL') ? (
                                    <button 
                                        onClick={handleRetry}
                                        className="bg-white/10 text-white px-8 py-3 rounded-lg font-bold uppercase tracking-widest hover:bg-white/20 transition-colors"
                                    >
                                        Try Again
                                    </button>
                                ) : (
                                    <button 
                                        onClick={handleNext}
                                        className="bg-green-500 text-black px-10 py-4 rounded-xl font-bold uppercase tracking-widest hover:scale-105 transition-transform shadow-glow"
                                    >
                                        Next Lesson →
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default GrooveMasterclass;
