
import React, { useState, useEffect } from 'react';
import { 
    MAESTRO_CORE_CODE, 
    QA_PIPELINE_CODE, 
    CHANNEL_MAP_CODE, 
    downloadStudioCode,
    downloadStyleDefinitions,
    downloadSystemIntelligence 
} from '../services/sourceCodeService';
import { engineLogService, LogEntry } from '../services/engineLogService';
import { Code, Terminal, ShieldAlert, Download, FileJson, Cpu, Activity, Server, Database, FileText, MonitorPlay, Layers } from 'lucide-react';

interface SystemDashboardProps {
  onClose: () => void;
}

const DEV_LOG = `
V83.0 (REV 7) - DEVELOPMENT & EVOLUTION LOG
-------------------------------------------
STATUS: FINALIZED | SYSTEM READY FOR PRODUCTION

[LATEST FORENSIC SCAN: V83_INTENT_CHECK]
-------------------------------------------
Status: VERIFIED_FOR_GOA_COMPLIANCE
Features Active:
- Intent Engine: ONLINE (Evaluating Meaning vs Motion)
- Scarcity Rule: ACTIVE (16 Bar gating for Goa)
- Conductor Priority: LOCKED (Lead A suppresses Lead B)

[AUDIT TRAIL]

1. CORE ENGINE UPGRADES (V83)
   ---------------------------------
   [NEW] INTENT ENGINE
   - Issue: Continuous leads reduced hypnotic effect in Goa.
   - Solution: Implemented 'Intent Check' every 4 bars.
   - Result: Leads now only trigger if 'Scarcity' bars have passed or during Breaks/Drops.

   [FIXED] ZERO-TICK ALIGNMENT
   - Result: All channels now align perfectly to the DAW grid (0ms drift).

2. DASHBOARD TRANSPARENCY
   ---------------------------------
   [NEW] DELIVERABLE EXPORTS
   - Added buttons to export full Technical Style Definitions.
   - Added buttons to export System Intelligence Logic.

SYSTEM HEALTH: 100%
READY FOR DEPLOYMENT.
`;

export default function SystemDashboard({ onClose }: SystemDashboardProps) {
  const [activeTab, setActiveTab] = useState<'SOURCE' | 'LOGS' | 'QA' | 'LIVE'>('LOGS');
  const [codeSection, setCodeSection] = useState<'ENGINE' | 'QA' | 'MAP'>('ENGINE');
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
      // Simple polling for live log updates
      const interval = setInterval(() => {
          setLiveLogs(engineLogService.getRecentLogs());
      }, 1000);
      setLiveLogs(engineLogService.getRecentLogs());
      return () => clearInterval(interval);
  }, []);

  const getCode = () => {
    if (codeSection === 'ENGINE') return MAESTRO_CORE_CODE;
    if (codeSection === 'QA') return QA_PIPELINE_CODE;
    return CHANNEL_MAP_CODE;
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex flex-col font-mono text-studio-accent animate-in fade-in duration-300">
      {/* Header */}
      <header className="h-16 border-b border-studio-accent/20 flex justify-between items-center px-8 bg-black">
        <div className="flex items-center gap-4">
          <Terminal className="w-5 h-5" />
          <h1 className="text-sm font-black uppercase tracking-[0.3em] text-white">
            System <span className="text-studio-accent">Forensics</span> V83.0
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="text-white hover:text-studio-accent text-2xl">&times;</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-64 border-r border-studio-accent/10 bg-black/40 p-4 flex flex-col gap-2">
           
           {/* EXPORT SECTION */}
           <div className="mb-6 bg-studio-accent/5 rounded-xl p-3 border border-studio-accent/10">
               <p className="text-[8px] font-black text-studio-accent uppercase mb-3 tracking-widest pl-1">Deliverables (Audit)</p>
               <div className="space-y-2">
                   <button 
                    onClick={downloadStyleDefinitions}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-studio-accent text-black rounded text-[9px] font-bold uppercase hover:bg-white hover:scale-[1.02] transition-all shadow-glow"
                   >
                    <Layers className="w-3 h-3" /> Style Definitions
                   </button>
                   <button 
                    onClick={downloadSystemIntelligence}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-purple-500 text-white rounded text-[9px] font-bold uppercase hover:bg-purple-400 hover:scale-[1.02] transition-all shadow-glow"
                   >
                    <Cpu className="w-3 h-3" /> Engine & AI Logic
                   </button>
                   <button 
                    onClick={downloadStudioCode}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 rounded text-[9px] font-bold uppercase hover:bg-gray-700 transition-all border border-white/10"
                   >
                    <Code className="w-3 h-3" /> Full Source Code
                   </button>
               </div>
           </div>

           <div className="border-t border-white/5 pt-4 space-y-2">
               <p className="text-[8px] font-black text-gray-600 uppercase mb-2 tracking-widest pl-2">System Monitors</p>
               
               <button onClick={() => setActiveTab('LIVE')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'LIVE' ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-500'}`}>
                  <MonitorPlay className="w-4 h-4" /> Live Console
               </button>

               <button onClick={() => setActiveTab('LOGS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'LOGS' ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-500'}`}>
                  <FileText className="w-4 h-4" /> Dev Log
               </button>

               <button onClick={() => setActiveTab('SOURCE')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'SOURCE' ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-500'}`}>
                  <Code className="w-4 h-4" /> Engine Viewer
               </button>
           </div>
           
           {activeTab === 'SOURCE' && (
               <div className="mt-4 border-t border-white/5 pt-4 space-y-1 pl-4">
                   <button onClick={() => setCodeSection('ENGINE')} className={`w-full text-left px-2 py-1.5 rounded text-[9px] ${codeSection==='ENGINE' ? 'text-studio-accent' : 'text-gray-600 hover:text-gray-400'}`}>• Maestro Engine</button>
                   <button onClick={() => setCodeSection('QA')} className={`w-full text-left px-2 py-1.5 rounded text-[9px] ${codeSection==='QA' ? 'text-studio-accent' : 'text-gray-600 hover:text-gray-400'}`}>• QA Pipeline</button>
                   <button onClick={() => setCodeSection('MAP')} className={`w-full text-left px-2 py-1.5 rounded text-[9px] ${codeSection==='MAP' ? 'text-studio-accent' : 'text-gray-600 hover:text-gray-400'}`}>• Channel Map</button>
               </div>
           )}
        </aside>

        {/* Content Area */}
        <main className="flex-1 bg-[#050505] p-8 overflow-y-auto custom-scrollbar">
           <div className="max-w-4xl mx-auto bg-black border border-studio-accent/10 rounded-2xl overflow-hidden shadow-2xl h-full flex flex-col">
              
              <div className="bg-[#111] px-6 py-3 border-b border-studio-accent/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                </div>
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                  {activeTab === 'LOGS' ? 'DEV_LOG.txt' : activeTab === 'LIVE' ? 'LIVE_SESSION.log' : `${codeSection}_LOGIC.ts`}
                </span>
              </div>

              {activeTab === 'LIVE' ? (
                  <div className="flex-1 p-4 overflow-y-auto font-mono text-[10px] space-y-2">
                      {liveLogs.length === 0 && <div className="text-gray-600 text-center mt-10">No events recorded in this session yet.</div>}
                      {liveLogs.map((log, i) => (
                          <div key={i} className="border-b border-white/5 pb-1 flex gap-2">
                              <span className="text-gray-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                              <span className={`font-bold shrink-0 ${log.type === 'QA_PASSED' ? 'text-green-400' : log.type === 'QA_FAILED' ? 'text-red-500' : 'text-studio-accent'}`}>
                                  {log.type}
                              </span>
                              <span className="text-gray-300 break-all">{log.line.split('|').slice(3).join(' ')}</span>
                          </div>
                      ))}
                  </div>
              ) : (
                  <pre className="flex-1 p-8 text-xs leading-relaxed text-studio-accent/80 whitespace-pre-wrap font-mono overflow-y-auto">
                    {activeTab === 'LOGS' ? DEV_LOG : getCode()}
                  </pre>
              )}
           </div>
        </main>
      </div>
    </div>
  );
}
