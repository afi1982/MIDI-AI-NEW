
import React from 'react';
import { GenerationReportData } from '../types';

interface GenerationReportModalProps {
    report: GenerationReportData;
    onClose: () => void;
    onDownload: () => void;
}

const GenerationReportModal: React.FC<GenerationReportModalProps> = ({ report, onClose, onDownload }) => {
    return (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex items-center justify-center md:p-6 animate-in zoom-in-95 duration-300">
            {/* Main Card: Full height on mobile, constrained on desktop */}
            <div className="w-full h-full md:h-auto md:max-h-[90vh] max-w-3xl bg-[#08080A] border border-studio-border md:rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
                
                {/* Decorative Top Line */}
                <div className="h-1 w-full bg-gradient-to-r from-studio-accent via-blue-600 to-purple-600 shrink-0"></div>

                {/* Header Section (Fixed at top) */}
                <div className="shrink-0 bg-[#08080A] z-10">
                    <div className="p-6 pb-2 text-center">
                        <h2 className="text-2xl md:text-3xl font-display font-black text-white uppercase tracking-tighter mb-1">
                            Session <span className="text-studio-accent">Report</span>
                        </h2>
                        <p className="text-[10px] md:text-xs text-studio-dim font-mono uppercase tracking-[0.3em]">
                            Run ID: {report.seedId.split('-')[1] || report.seedId}
                        </p>
                    </div>

                    {/* Grid Info */}
                    <div className="px-4 md:px-8 py-2 md:py-4 grid grid-cols-4 gap-2 border-b border-white/5">
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                            <div className="text-[8px] md:text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Style</div>
                            <div className="text-[10px] md:text-sm font-bold text-white truncate">{report.profile}</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                            <div className="text-[8px] md:text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">BPM</div>
                            <div className="text-[10px] md:text-sm font-bold text-white">{report.bpmUsed}</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                            <div className="text-[8px] md:text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Key</div>
                            <div className="text-[10px] md:text-sm font-bold text-white truncate">{report.keyScale}</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                            <div className="text-[8px] md:text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Bars</div>
                            <div className="text-[10px] md:text-sm font-bold text-white">{report.totalBars}</div>
                        </div>
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-[#08080A]">
                    
                    {/* Structure */}
                    <div>
                        <h3 className="text-xs text-studio-accent font-bold uppercase tracking-widest mb-4 border-b border-studio-accent/20 pb-2">Structure Map</h3>
                        <div className="space-y-2">
                            {report.structure.map((s, i) => (
                                <div key={i} className="flex justify-between items-center text-[10px] uppercase font-mono text-gray-400">
                                    <span className="text-white">{s.name}</span>
                                    <div className="flex-1 mx-4 h-px bg-white/10"></div>
                                    <span>{s.bars} Bars</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Manifest */}
                    <div>
                        <h3 className="text-xs text-studio-accent font-bold uppercase tracking-widest mb-4 border-b border-studio-accent/20 pb-2">Track Manifest</h3>
                        <div className="space-y-2">
                            {report.tracks.filter(t => t.count > 0).map((t, i) => (
                                <div key={i} className="flex justify-between items-center text-[10px] uppercase font-mono text-gray-400">
                                    <span>{t.name}</span>
                                    <span className="text-studio-dim">{t.count} Events</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Action Bar (Fixed Footer) */}
                <div className="shrink-0 p-4 md:p-6 bg-[#0E0E10] border-t border-white/5 flex flex-col gap-3 pb-safe">
                     <button 
                        onClick={onDownload}
                        className="w-full py-4 bg-white text-black hover:bg-studio-accent font-black text-xs md:text-sm uppercase tracking-[0.2em] rounded-lg shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        <span>⬇</span> Download Files (MIDI + Report)
                    </button>

                     <button 
                        onClick={onClose}
                        className="w-full py-3 bg-transparent border border-white/10 text-gray-500 hover:text-white hover:border-white/30 font-bold text-xs uppercase tracking-widest rounded-lg transition-all"
                    >
                        Close & Start New Session
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GenerationReportModal;
