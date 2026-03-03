
import React from 'react';
import { DetailedAnalysisReport } from '../types';

interface AnalysisDashboardProps {
  report: DetailedAnalysisReport;
  grooveName: string;
}

const ScoreBadge: React.FC<{ score: number, label: string }> = ({ score, label }) => {
    let color = 'text-green-400 border-green-400/30 bg-green-900/10';
    if (score < 80) color = 'text-orange-400 border-orange-400/30 bg-orange-900/10';

    return (
        <div className={`flex flex-col items-center justify-center p-2 rounded border ${color} min-w-[70px]`}>
            <span className="text-xl font-display font-bold">{score}</span>
            <span className="text-[8px] uppercase tracking-widest opacity-80 mt-1">{label}</span>
        </div>
    );
};

const DataRow: React.FC<{ label: string, value: string }> = ({ label, value }) => (
    <div className="flex justify-between items-center py-2 border-b border-studio-border last:border-0">
        <span className="text-studio-dim font-bold text-[9px] uppercase tracking-wider">{label}</span>
        <span className="text-white font-mono text-[10px]">{value}</span>
    </div>
);

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ report, grooveName }) => {
  return (
    <div className="flex flex-col gap-6 font-sans text-gray-300">
        
        {/* HEADER */}
        <div className="flex justify-between items-start border-b border-studio-border pb-4">
            <div>
                <h2 className="text-lg font-display font-bold text-white uppercase tracking-tight">
                    ENGINEERING <span className="text-studio-accent">REPORT</span>
                </h2>
                <p className="text-[10px] text-studio-dim font-mono mt-1">{grooveName}</p>
            </div>
            <ScoreBadge score={report.overallScore} label="QA SCORE" />
        </div>

        {/* NARRATIVE */}
        <div className="bg-black/40 border border-studio-border rounded p-4 relative">
             <div className="absolute top-0 left-0 w-1 h-full bg-studio-accent"></div>
             <p className="text-xs text-gray-400 font-mono leading-relaxed pl-2">
                "{report.creativeNarrative || "Analyzing track structure..."}"
             </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* COMPOSITION BLUEPRINT */}
            <div className="bg-studio-surface border border-studio-border rounded p-4">
                 <h3 className="text-[10px] font-bold text-white uppercase tracking-widest mb-3">Composition Blueprint</h3>
                 <div className="flex flex-col">
                     <DataRow label="Bass Structure" value={report.compositionFeatures?.bassPattern || "Analyzing..."} />
                     <DataRow label="Melodic Flow" value={report.compositionFeatures?.melodicContour || "Analyzing..."} />
                     <DataRow label="Energy State" value={report.compositionFeatures?.energyLevel || "Analyzing..."} />
                     <DataRow label="Note Variety" value={`${report.trackDetails.lead?.varietyScore ?? 0}%`} />
                 </div>
            </div>

            {/* HARMONIC FLOW */}
            <div className="bg-studio-surface border border-studio-border rounded p-4 flex flex-col">
                 <h3 className="text-[10px] font-bold text-white uppercase tracking-widest mb-3">Harmonic Grid</h3>
                 <div className="grid grid-cols-4 gap-2">
                     {(report.harmonicFlow || []).slice(0,8).map((bar, i) => (
                         <div key={i} className={`h-12 rounded flex flex-col items-center justify-center border border-white/5 bg-black`}>
                             <span className="text-[8px] text-studio-dim mb-0.5">BAR {bar.barIndex}</span>
                             <span className={`text-xs font-bold font-mono ${bar.conflict ? 'text-red-500' : 'text-white'}`}>{bar.detectedChord}</span>
                         </div>
                     ))}
                 </div>
            </div>
        </div>

        {/* LOGS */}
        <div className="border border-red-900/30 bg-red-900/5 rounded p-3">
             <h3 className="text-[9px] font-bold text-red-400 uppercase tracking-widest mb-2">Conflicts Detected</h3>
             {(!report.mixingIssues || report.mixingIssues.length === 0) ? (
                 <div className="text-green-500 text-[9px] font-mono">ALL SYSTEMS NOMINAL.</div>
             ) : (
                 <ul className="flex flex-col gap-1">
                     {report.mixingIssues.map((err, i) => (
                         <li key={i} className="text-[9px] text-red-300 font-mono">
                             • {err}
                         </li>
                     ))}
                 </ul>
             )}
        </div>
    </div>
  );
};

export default AnalysisDashboard;
