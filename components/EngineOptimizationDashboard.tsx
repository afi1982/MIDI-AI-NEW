
import React, { useState, useRef, useEffect } from 'react';
import { STYLE_PROFILES, rollbackProfile, resetProfileToFactory, StyleProfileKey } from '../services/profileService';
import { midiAI, MidiAnalysis, LearnedStyle } from '../services/aiMidiAnalyzer';
import { Cpu, Upload, Zap, TrendingUp, AlertCircle, CheckCircle, Download } from 'lucide-react';

interface EngineOptimizationDashboardProps {
    currentProfileId: StyleProfileKey;
    onClose: () => void;
    onApplyLearnedStyle?: (events: any[]) => void; // Callback to export learned melody
}

const EngineOptimizationDashboard: React.FC<EngineOptimizationDashboardProps> = ({ 
    currentProfileId, 
    onClose,
    onApplyLearnedStyle 
}) => {
    const profile = STYLE_PROFILES[currentProfileId];
    const history = [...profile.versionHistory].reverse();
    
    const [analyses, setAnalyses] = useState<MidiAnalysis[]>([]);
    const [learnedStyle, setLearnedStyle] = useState<LearnedStyle | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'ai'>('ai');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Load existing AI data
        setAnalyses(midiAI.getAnalyses());
        setLearnedStyle(midiAI.getCurrentStyle());
    }, []);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsAnalyzing(true);

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const analysis = await midiAI.analyzeMidiFile(file);
                setAnalyses(prev => [...prev, analysis]);
            }
        } catch (error) {
            alert('Error analyzing files: ' + error);
        } finally {
            setIsAnalyzing(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleOptimizeProfile = async () => {
        if (analyses.length === 0) {
            alert('Upload MIDI files first');
            return;
        }

        setIsOptimizing(true);
        
        try {
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const style = midiAI.learnStyle(profile.label);
            setLearnedStyle(style);
            
            alert(`Optimization complete!\n\nAnalyzed ${style.trainingFiles} files\n${Object.keys(style.learnedParams.intervalWeights).length} interval patterns\n${style.learnedParams.motifLibrary.length} motifs`);
        } catch (error) {
            alert('Processing error: ' + error);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleGenerateFromAI = async () => {
        if (!learnedStyle) {
            alert('Run learning first');
            return;
        }

        setIsGenerating(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const generatedEvents = midiAI.generateFromLearnedStyle(8);
            
            if (onApplyLearnedStyle) {
                onApplyLearnedStyle(generatedEvents);
            }
            
            alert(`Melody created successfully!\n\n${generatedEvents.length} notes\nBased on ${learnedStyle.trainingFiles} source files`);
        } catch (error) {
            alert('Generation error: ' + error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleClearAI = () => {
        if (confirm('Delete all engine source data?')) {
            midiAI.clearAll();
            setAnalyses([]);
            setLearnedStyle(null);
        }
    };

    const handleRollback = () => {
        if (confirm("Revert to previous version? This cannot be undone.")) {
            rollbackProfile(currentProfileId);
            onClose();
        }
    };

    const handleReset = () => {
        if (confirm("RESET TO FACTORY DEFAULTS? All learning data will be lost.")) {
            resetProfileToFactory(currentProfileId);
            onClose();
        }
    };

    return (
        <div className="absolute inset-0 z-[250] bg-black/95 backdrop-blur-xl p-6 flex items-center justify-center animate-in slide-in-from-bottom-10">
            <div className="w-full max-w-4xl h-[85vh] bg-[#0A0A0B] border border-studio-border rounded-2xl flex flex-col shadow-2xl overflow-hidden">
                
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-start bg-[#111] shrink-0">
                    <div>
                        <h2 className="text-2xl font-display font-black text-white uppercase tracking-tighter">
                            Engine <span className="text-studio-accent">Settings</span>
                        </h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-0.5 bg-white/10 rounded text-[9px] font-bold uppercase text-white">{profile.label}</span>
                            {learnedStyle && (
                                <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-[9px] font-bold uppercase text-purple-400">
                                    ENGINE SYNCED ({learnedStyle.trainingFiles} files)
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">&times;</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10 bg-[#0A0A0B] shrink-0">
                    <button
                        onClick={() => setActiveTab('ai')}
                        className={`flex-1 py-3 px-4 text-xs font-bold uppercase transition-colors ${
                            activeTab === 'ai' 
                                ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-500' 
                                : 'text-gray-500 hover:text-white'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Cpu className="w-4 h-4" />
                            AI Learning
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`flex-1 py-3 px-4 text-xs font-bold uppercase transition-colors ${
                            activeTab === 'profile' 
                                ? 'bg-blue-500/20 text-blue-400 border-b-2 border-blue-500' 
                                : 'text-gray-500 hover:text-white'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            History
                        </div>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {activeTab === 'ai' ? (
                        // ===== AI Refinement Tab =====
                        <div className="p-6 space-y-6">
                            
                            {/* Upload Section */}
                            <div className="bg-black/50 p-6 rounded-xl border border-purple-500/20">
                                <h3 className="text-sm font-bold uppercase text-purple-400 mb-4 flex items-center gap-2">
                                    <Upload className="w-4 h-4" />
                                    Upload MIDI Files
                                </h3>
                                
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".mid,.midi"
                                    multiple
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="ai-midi-upload"
                                />
                                
                                <label
                                    htmlFor="ai-midi-upload"
                                    className={`flex items-center justify-center gap-3 w-full py-4 px-6 rounded-lg font-bold text-sm cursor-pointer transition-all ${
                                        isAnalyzing
                                            ? 'bg-gray-700 cursor-wait'
                                            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white'
                                    }`}
                                >
                                    <Upload className="w-5 h-5" />
                                    {isAnalyzing ? 'Analyzing...' : 'Upload MIDI'}
                                </label>
                                
                                <p className="text-[10px] text-gray-500 mt-3 text-center">
                                    💡 Upload melodies you like - the engine will learn the style and create new ones.
                                </p>
                            </div>

                            {/* Stats */}
                            {analyses.length > 0 && (
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-black/50 p-4 rounded-xl border border-white/5">
                                        <div className="text-gray-500 text-[10px] uppercase font-bold mb-2">Training Files</div>
                                        <div className="text-3xl font-black text-white">{analyses.length}</div>
                                    </div>
                                    <div className="bg-black/50 p-4 rounded-xl border border-white/5">
                                        <div className="text-gray-500 text-[10px] uppercase font-bold mb-2">Patterns Found</div>
                                        <div className="text-3xl font-black text-purple-400">
                                            {learnedStyle ? learnedStyle.learnedParams.motifLibrary.length : 0}
                                        </div>
                                    </div>
                                    <div className="bg-black/50 p-4 rounded-xl border border-white/5">
                                        <div className="text-gray-500 text-[10px] uppercase font-bold mb-2">AI Status</div>
                                        <div className={`text-xs font-bold uppercase ${learnedStyle ? 'text-green-400' : 'text-yellow-400'}`}>
                                            {learnedStyle ? '✓ TRAINED' : '⧗ READY'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Analyzed Files */}
                            {analyses.length > 0 && (
                                <div className="bg-black/50 p-4 rounded-xl border border-white/5">
                                    <h3 className="text-xs font-bold uppercase text-gray-400 mb-3">Analyzed Files</h3>
                                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                        {analyses.map((analysis, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-white/5">
                                                <div className="flex-1">
                                                    <div className="text-xs font-mono text-white">{analysis.fileName}</div>
                                                    <div className="flex gap-3 mt-1 text-[9px] text-gray-500">
                                                        <span>Density: {(analysis.rhythmProfile.density * 100).toFixed(0)}%</span>
                                                        <span>Scale: {analysis.harmonicProfile.scaleType}</span>
                                                        <span>Velocity: {analysis.dynamicProfile.velocityRange.join('-')}</span>
                                                    </div>
                                                </div>
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Learn Button */}
                            {analyses.length > 0 && !learnedStyle && (
                                <button
                                    onClick={handleOptimizeProfile}
                                    disabled={isOptimizing}
                                    className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-wait rounded-lg font-bold text-sm transition-all text-white"
                                >
                                    <Cpu className="w-5 h-5" />
                                    {isOptimizing ? 'Processing...' : `Sync Engine (${analyses.length} files)`}
                                </button>
                            )}

                            {/* Learned Style Info */}
                            {learnedStyle && (
                                <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-6 rounded-xl border border-purple-500/30">
                                    <h3 className="text-sm font-bold uppercase text-purple-400 mb-4 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" />
                                        AI Trained Successfully
                                    </h3>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-4 text-gray-300">
                                        <div>
                                            <div className="text-[9px] text-gray-500 uppercase mb-1">Interval Patterns</div>
                                            <div className="text-xs font-mono text-white">
                                                {Object.keys(learnedStyle.learnedParams.intervalWeights).slice(0, 5).join(', ')}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] text-gray-500 uppercase mb-1">Legato Amount</div>
                                            <div className="text-xs font-mono text-white">
                                                {(learnedStyle.learnedParams.legatoAmount * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] text-gray-500 uppercase mb-1">Density Target</div>
                                            <div className="text-xs font-mono text-white">
                                                {(learnedStyle.learnedParams.densityTarget * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] text-gray-500 uppercase mb-1">Velocity Range</div>
                                            <div className="text-xs font-mono text-white">
                                                {learnedStyle.learnedParams.velocityPreset.min}-{learnedStyle.learnedParams.velocityPreset.max}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleGenerateFromAI}
                                        disabled={isGenerating}
                                        className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-wait rounded-lg font-bold text-sm transition-all text-white"
                                    >
                                        <Zap className="w-5 h-5" />
                                        {isGenerating ? 'Generating...' : 'Create from AI'}
                                    </button>
                                </div>
                            )}

                            {/* Clear Button */}
                            {analyses.length > 0 && (
                                <button
                                    onClick={handleClearAI}
                                    className="w-full py-2 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-xs font-bold uppercase text-red-400 transition-all"
                                >
                                    🗑️ Clear AI Data
                                </button>
                            )}
                        </div>
                    ) : (
                        // ===== Profile History Tab =====
                        <div className="p-6 space-y-6">
                            {/* Metrics Visualization */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="bg-black/50 p-4 rounded-xl border border-white/5">
                                    <h3 className="text-xs text-gray-500 font-bold uppercase mb-4">Current Parameters</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between text-[10px] uppercase text-gray-400 mb-1">
                                                <span>Swing</span>
                                                <span className="text-white">{profile.parameters.swing.toFixed(2)}</span>
                                            </div>
                                            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500" style={{ width: `${profile.parameters.swing * 200}%` }}></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[10px] uppercase text-gray-400 mb-1">
                                                <span>Groove Intensity</span>
                                                <span className="text-white">{profile.parameters.grooveIntensity.toFixed(2)}</span>
                                            </div>
                                            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-purple-500" style={{ width: `${profile.parameters.grooveIntensity * 100}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-black/50 p-4 rounded-xl border border-white/5 flex flex-col justify-center items-center text-center">
                                    <div className="text-4xl mb-2 text-white">⚙️</div>
                                    <h3 className="text-white font-bold uppercase text-sm">Engine Active</h3>
                                    <p className="text-gray-500 text-[10px] mt-2 max-w-[200px]">
                                        The engine is observing your feedback and optimizing {profile.label} parameters automatically.
                                    </p>
                                </div>
                            </div>

                            {/* History List */}
                            <div>
                                <h3 className="text-xs text-gray-500 font-bold uppercase mb-4">Optimization Log</h3>
                                <div className="space-y-3">
                                    {history.map((ver, idx) => (
                                        <div key={ver.versionId} className="flex gap-4 p-3 rounded-lg border border-white/5 hover:bg-white/5 transition-colors group">
                                            <div className="flex flex-col items-center pt-1">
                                                <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-studio-accent animate-pulse' : 'bg-gray-700'}`}></div>
                                                {idx !== history.length - 1 && <div className="w-px h-full bg-white/5 mt-1"></div>}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className={`text-xs font-bold font-mono ${idx === 0 ? 'text-white' : 'text-gray-500'}`}>{ver.versionId}</span>
                                                    <span className="text-[9px] text-gray-600">{new Date(ver.timestamp).toLocaleTimeString()}</span>
                                                </div>
                                                <p className="text-[10px] text-gray-300 bg-white/5 p-2 rounded border border-white/5 font-mono">
                                                    {ver.changeLog}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-6 border-t border-white/10 bg-[#111] flex justify-between shrink-0">
                    <button 
                        onClick={handleReset}
                        className="text-[9px] text-red-500 hover:text-red-400 font-bold uppercase tracking-widest px-4 py-2 border border-red-900/30 rounded hover:bg-red-900/10"
                    >
                        Factory Reset
                    </button>
                    
                    <button 
                        onClick={handleRollback}
                        disabled={history.length <= 1}
                        className="text-[9px] text-white bg-gray-700 hover:bg-gray-600 font-bold uppercase tracking-widest px-6 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Rollback Version
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EngineOptimizationDashboard;
