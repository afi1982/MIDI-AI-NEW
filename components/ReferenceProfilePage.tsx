
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ReferenceProfileStats } from '../types';
import { referenceAnalysisService } from '../services/referenceAnalysisService';
import { Activity, BarChart2, ShieldCheck, Zap, FileCode, CheckCircle, AlertCircle } from 'lucide-react';

interface ReferenceProfilePageProps {
    onClose: () => void;
    onApplyReference: (stats: ReferenceProfileStats) => void;
}

const StatCard: React.FC<{ label: string, value: string | number, icon: any, color: string }> = ({ label, value, icon: Icon, color }) => (
    <div className={`bg-[#111] border border-white/5 rounded-xl p-4 flex items-center justify-between group hover:border-${color}/50 transition-all`}>
        <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">{label}</div>
            <div className={`text-xl font-black font-mono ${color === 'blue' ? 'text-blue-400' : color === 'green' ? 'text-green-400' : color === 'purple' ? 'text-purple-400' : 'text-yellow-400'}`}>
                {value}
            </div>
        </div>
        <div className={`w-10 h-10 rounded-full bg-${color}-500/10 flex items-center justify-center`}>
            <Icon className={`w-5 h-5 text-${color}-500`} />
        </div>
    </div>
);

export const ReferenceProfilePage: React.FC<ReferenceProfilePageProps> = ({ onClose, onApplyReference }) => {
    const [stats, setStats] = useState<ReferenceProfileStats | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback(async (files: File[]) => {
        const file = files[0];
        if (!file.name.toLowerCase().endsWith('.mid') && !file.name.toLowerCase().endsWith('.midi')) {
            setError("Please upload a valid MIDI file.");
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        try {
            const result = await referenceAnalysisService.extractGovernanceStats(file);
            setStats(result);
        } catch (e: any) {
            setError("Analysis failed. Please ensure the file is a valid MIDI type 0/1.");
        } finally {
            setIsAnalyzing(false);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        maxFiles: 1,
        // Accept removed to improve file picker UX
    } as any);

    return (
        <div className="w-full h-full bg-[#050507] flex flex-col font-sans text-white animate-in fade-in duration-500">
            {/* Header */}
            <div className="h-20 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-8 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-studio-accent/20 rounded-lg flex items-center justify-center border border-studio-accent/30">
                        <Activity className="w-5 h-5 text-studio-accent" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-black uppercase tracking-tighter text-white">
                            Reference <span className="text-studio-accent">Profile</span>
                        </h1>
                        <p className="text-[10px] text-gray-500 font-mono uppercase tracking-[0.3em]">Statistical Style Extraction</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-white uppercase font-bold text-xs tracking-widest">Close</button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 max-w-6xl mx-auto w-full flex flex-col gap-8">
                
                {/* Disclaimer */}
                <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-4 flex gap-4 items-start">
                    <ShieldCheck className="w-6 h-6 text-blue-400 shrink-0 mt-1" />
                    <div>
                        <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wide mb-1">Style-Safe Analysis</h3>
                        <p className="text-xs text-blue-200/60 leading-relaxed max-w-2xl">
                            This tool extracts <strong>statistical behavior only</strong> (density, scarcity, energy curves). 
                            No melodies, note sequences, or artistic content are stored or reused. 
                            We are teaching the system <em>how</em> to speak, not <em>what</em> to say.
                        </p>
                    </div>
                </div>

                {/* Upload Area */}
                {!stats && (
                    <div 
                        {...getRootProps()} 
                        className={`
                            h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all
                            ${isDragActive ? 'border-studio-accent bg-studio-accent/10' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}
                        `}
                    >
                        <input {...getInputProps()} />
                        {isAnalyzing ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-8 h-8 border-2 border-studio-accent border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-xs font-bold text-studio-accent uppercase tracking-widest">Extracting Blueprint...</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3 text-center">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-2">
                                    <FileCode className="w-8 h-8 text-gray-500" />
                                </div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-widest">Drop Reference MIDI</h3>
                                <p className="text-xs text-gray-500 font-mono">Analyzes Lead Scarcity, Density & Energy Profile</p>
                                {error && <p className="text-red-400 text-xs font-bold mt-2 bg-red-900/20 px-3 py-1 rounded">{error}</p>}
                            </div>
                        )}
                    </div>
                )}

                {/* Results Dashboard */}
                {stats && (
                    <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                            <div>
                                <h2 className="text-xl font-bold text-white mb-1">{stats.filename}</h2>
                                <span className="text-[10px] text-green-400 font-mono uppercase bg-green-900/20 px-2 py-1 rounded border border-green-900/30">
                                    Analysis Complete
                                </span>
                            </div>
                            <button 
                                onClick={() => setStats(null)}
                                className="text-xs text-gray-500 hover:text-white underline decoration-gray-700 underline-offset-4"
                            >
                                Analyze Different File
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <StatCard 
                                label="Lead Scarcity" 
                                value={`${stats.leadScarcity} Bars`} 
                                icon={Activity} 
                                color="blue" 
                            />
                            <StatCard 
                                label="Avg Density" 
                                value={`${(stats.avgDensity * 100).toFixed(0)}%`} 
                                icon={BarChart2} 
                                color="purple" 
                            />
                            <StatCard 
                                label="Energy Profile" 
                                value={stats.energyProfile} 
                                icon={Zap} 
                                color="yellow" 
                            />
                        </div>

                        <div className="bg-[#111] border border-white/10 rounded-xl p-6 flex flex-col gap-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Governance Impact</h3>
                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <div className="text-[10px] text-gray-600 font-bold uppercase mb-2">Conductor Logic</div>
                                    <p className="text-xs text-gray-300 leading-relaxed">
                                        Applying this reference will force the <strong>Conductor Engine</strong> to wait 
                                        <span className="text-studio-accent font-bold"> {stats.leadScarcity} bars</span> between major lead statements.
                                        {stats.leadScarcity > 8 && " This indicates a highly progressive/hypnotic structure."}
                                    </p>
                                </div>
                                <div>
                                    <div className="text-[10px] text-gray-600 font-bold uppercase mb-2">Dominant Element</div>
                                    <p className="text-xs text-gray-300 leading-relaxed">
                                        Detected dominant driver: <span className="text-yellow-400 font-bold">{stats.dominantElement}</span>. 
                                        Generation priority will be shifted to focus on this element class.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => onApplyReference(stats)}
                            className="w-full py-5 bg-studio-accent text-black font-black uppercase tracking-[0.2em] rounded-xl hover:bg-white transition-all shadow-[0_0_30px_rgba(6,182,212,0.3)] flex items-center justify-center gap-3"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Use as Style Reference
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
