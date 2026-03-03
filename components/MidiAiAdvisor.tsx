import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
    Send, Loader2, Zap, Trash2, Activity, Copy, Check, 
    ChevronDown, Cpu, Paperclip, Microscope, 
    ShieldCheck, Terminal, AlertTriangle, Play, Wrench, Layers
} from 'lucide-react';
import { GrooveObject, NoteEvent } from '../types';
import { advisorHistoryService, ChatMessage } from '../services/advisorHistoryService';
import { engineProfileService } from '../services/engineProfileService';
import { optimizationService } from '../services/optimizationService';
import { midiAI } from '../services/aiMidiAnalyzer';

interface MidiAiAdvisorProps {
    isOpen: boolean;
    onToggle: () => void;
    currentProject?: GrooveObject | null;
    onUpdateProject?: (groove: GrooveObject) => void;
    onNavigate?: (view: string) => void; // New prop for navigation
}

// --- SYSTEM STATE ANALYZER ---
const analyzeSystemState = (groove: GrooveObject | null | undefined) => {
    if (!groove) return "NO_PROJECT_LOADED";

    const analysis = midiAI.analyzeGroove(groove);
    const activeTracks = Object.keys(groove).filter(k => k.startsWith('ch') && (groove as any)[k]?.length > 0);
    const hasKick = activeTracks.includes('ch1_kick');
    const hasBass = activeTracks.includes('ch2_sub');
    
    return JSON.stringify({
        status: "ACTIVE",
        projectID: groove.id,
        meta: { 
            genre: groove.genre, 
            bpm: groove.bpm, 
            key: `${groove.key} ${groove.scale}` 
        },
        health: {
            kick_bass_lock: hasKick && hasBass ? "OK" : "CRITICAL_MISSING",
            active_channels: activeTracks.length
        },
        musical_metrics: {
            melodic_range: analysis.melodicProfile.rangeSpread,
            rhythmic_density: analysis.rhythmProfile.density.toFixed(2),
            syncopation: analysis.rhythmProfile.syncoPationLevel.toFixed(2),
            chromaticism: analysis.harmonicProfile.chromaticUsage.toFixed(2),
            avg_velocity: analysis.dynamicProfile.avgVelocity.toFixed(0)
        },
        structure: groove.structureMap?.map(s => s.type) || ["UNKNOWN"]
    });
};

export const MidiAiAdvisor: React.FC<MidiAiAdvisorProps> = ({ isOpen, onToggle, currentProject, onUpdateProject, onNavigate }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [systemState, setSystemState] = useState<string>("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // --- MASTER PROMPT ---
  const MASTER_INSTRUCTION = `
    IDENTITY: You are the "MASTER CONTROL" (The Architect) of the Elite Studio.
    YOU ARE NOT A CHATBOT. YOU ARE THE OPERATING SYSTEM.
    
    YOUR CAPABILITIES:
    1. **ANALYZE:** Read the [SYSTEM_STATE] JSON. Look at musical_metrics (density, syncopation, chromaticism).
    2. **EXECUTE:** Fix MIDI data or suggest orchestration improvements.
    3. **NAVIGATE:** You can control the screen.
    
    ORCHESTRATION REFINEMENT:
    If the user asks to "refine orchestration" or "improve harmony/rhythm":
    - Analyze the musical_metrics.
    - Suggest specific changes (e.g., "Increase syncopation in the lead", "Add more harmonic variety").
    - Provide a "SYSTEM_SYNC" or "SCALE_QUANTIZE" command if appropriate.
    
    NAVIGATE COMMANDS (Output strictly as JSON):
    If user asks "Where is the architecture page?" or "Show me specs", output:
    { "operation": "NAVIGATE", "view": "ARCHITECTURE" }
    
    If user asks to go to Studio/Jobs/Create:
    { "operation": "NAVIGATE", "view": "STUDIO" } (or JOBS/CREATE)
    
    FIX COMMANDS (Output strictly as JSON):
    {
      "operation": "SYSTEM_SYNC" | "SCALE_QUANTIZE" | "VELOCITY_HUMANIZE",
      "params": { ... },
      "explanation": "Short label for the button"
    }
    
    TONE: Professional, Helpful, English.
    ALWAYS prioritize JSON commands over text if action is needed.
  `;

  useEffect(() => {
      const unsub = advisorHistoryService.subscribe(setMessages);
      return () => unsub();
  }, []);

  useEffect(() => {
      if (isOpen && currentProject) {
          const state = analyzeSystemState(currentProject);
          setSystemState(state);
          scrollToBottom();
      }
  }, [isOpen, currentProject, messages]);

  const scrollToBottom = () => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
  };

  const handleSend = async () => {
      if (!input.trim()) return;
      const userText = input;
      setInput('');
      
      const userMsg: ChatMessage = { role: 'user', text: userText, timestamp: Date.now() };
      advisorHistoryService.saveMessage(userMsg);
      
      setIsTyping(true);

      try {
          // Initialize AI right before usage
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          // CONTEXT INJECTION
          const context = `
            [SYSTEM_STATE]: ${systemState}
            [ENGINE_MEMORY]: ${engineProfileService.getShortTermMemory()}
            [USER_INPUT]: ${userText}
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-3-pro-preview',
              contents: [{ role: 'user', parts: [{ text: context }] }],
              config: { systemInstruction: MASTER_INSTRUCTION, temperature: 0.4 }
          });

          const responseText = response.text || "System Malfunction.";
          
          // Check for NAVIGATE command immediately
          if (responseText.includes('"operation": "NAVIGATE"')) {
              const match = responseText.match(/\{[\s\S]*"operation": "NAVIGATE"[\s\S]*\}/);
              if (match) {
                  executeCommand(match[0]);
                  advisorHistoryService.saveMessage({
                      role: 'model',
                      text: "✅ Navigating...",
                      timestamp: Date.now()
                  });
              } else {
                  advisorHistoryService.saveMessage({
                      role: 'model',
                      text: responseText,
                      timestamp: Date.now(),
                      isDevSpec: true
                  });
              }
          } else {
              advisorHistoryService.saveMessage({
                  role: 'model',
                  text: responseText,
                  timestamp: Date.now(),
                  isDevSpec: responseText.includes('"operation":')
              });
          }

      } catch (e: any) {
          advisorHistoryService.saveMessage({ role: 'model', text: `ERROR: ${e.message}`, timestamp: Date.now() });
      } finally {
          setIsTyping(false);
      }
  };

  const executeCommand = (jsonString: string) => {
      try {
          // Extract JSON from potential text wrapping
          const match = jsonString.match(/\{[\s\S]*"operation"[\s\S]*\}/);
          if (!match) return;
          
          const cmd = JSON.parse(match[0]);
          
          if (cmd.operation === 'NAVIGATE' && onNavigate) {
              onNavigate(cmd.view);
              if (window.innerWidth < 768) onToggle(); // Close chat on mobile after nav
              return;
          }

          if (!onUpdateProject || !currentProject) return;

          const updatedGroove = optimizationService.applyCommand(currentProject, cmd);
          onUpdateProject(updatedGroove);
          
          advisorHistoryService.saveMessage({
              role: 'model',
              text: `✅ **SYSTEM ACTION:** Executed ${cmd.operation} successfully.`,
              timestamp: Date.now(),
              isSystemPush: true
          });
      } catch (e) {
          console.error(e);
          alert("Failed to execute command.");
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-[#050507] text-white font-sans animate-in slide-in-from-right duration-300">
        
        {/* HEADER */}
        <div className="h-16 bg-[#0E0E10] border-b border-white/10 flex items-center justify-between px-6 shrink-0 shadow-xl">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-500/10 rounded-lg flex items-center justify-center border border-sky-500/30">
                    <Cpu className="text-sky-400" size={20} />
                </div>
                <div>
                    <h1 className="text-lg font-black uppercase tracking-tighter text-white">AI <span className="text-sky-500">Assistant</span></h1>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-[9px] text-gray-500 font-mono uppercase">System Online • Monitoring</span>
                    </div>
                </div>
            </div>
            <button onClick={onToggle} className="p-2 hover:bg-white/10 rounded-full transition-all">
                <ChevronDown />
            </button>
        </div>

        {/* TERMINAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-[#050507]" ref={scrollContainerRef}>
            
            {/* WELCOME / STATUS */}
            <div className="bg-[#111] border border-white/10 rounded-2xl p-6 mb-8">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Activity size={14} /> Active Project Analysis
                    </h3>
                    <span className="text-[9px] font-mono text-gray-600">{new Date().toLocaleTimeString()}</span>
                </div>
                {currentProject ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 bg-black/40 rounded-lg border border-white/5">
                            <span className="block text-[9px] text-gray-500 uppercase">Identity</span>
                            <span className="text-sm font-bold text-white">{currentProject.name}</span>
                        </div>
                        <div className="p-3 bg-black/40 rounded-lg border border-white/5">
                            <span className="block text-[9px] text-gray-500 uppercase">Engine</span>
                            <span className="text-sm font-bold text-sky-400">{currentProject.bpm} BPM</span>
                        </div>
                        <div className="p-3 bg-black/40 rounded-lg border border-white/5">
                            <span className="block text-[9px] text-gray-500 uppercase">Key</span>
                            <span className="text-sm font-bold text-purple-400">{currentProject.key} {currentProject.scale}</span>
                        </div>
                        <div className="p-3 bg-black/40 rounded-lg border border-white/5">
                            <span className="block text-[9px] text-gray-500 uppercase">Health</span>
                            <span className="text-sm font-bold text-green-400">Stable</span>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4 text-gray-500 text-xs">NO ACTIVE PROJECT DETECTED IN STUDIO</div>
                )}
            </div>

            {/* MESSAGES */}
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-5 rounded-2xl border relative ${
                        msg.role === 'user' 
                        ? 'bg-[#1A1A1F] border-white/10 text-gray-200' 
                        : 'bg-[#0E0E10] border-sky-500/20 text-gray-300 shadow-[0_0_30px_rgba(14,165,233,0.05)]'
                    }`}>
                        {msg.role === 'model' && (
                            <div className="absolute top-0 left-0 -mt-2 -ml-2 bg-black border border-sky-500/30 text-sky-500 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                Assistant
                            </div>
                        )}
                        <div className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                            {msg.text.replace(/\{[\s\S]*\}/g, '').trim() || (msg.isDevSpec ? "Command Ready..." : "")}
                        </div>

                        {/* ACTION BUTTON (If JSON Detected) */}
                        {msg.isDevSpec && (
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <button 
                                    onClick={() => executeCommand(msg.text)}
                                    className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
                                >
                                    <Wrench size={14} /> Execute System Action
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {isTyping && (
                <div className="flex justify-start">
                    <div className="bg-[#0E0E10] border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                        <Loader2 className="animate-spin text-sky-500" size={16} />
                        <span className="text-xs font-mono text-gray-500 uppercase">Analyzing Logic...</span>
                    </div>
                </div>
            )}
        </div>

        {/* INPUT AREA */}
        <div className="p-4 md:p-6 bg-[#0E0E10] border-t border-white/10 shrink-0">
            <div className="relative flex items-center bg-black border border-white/10 rounded-2xl p-2 pr-4 shadow-lg focus-within:border-sky-500/50 transition-all">
                <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask the assistant (e.g., 'Fix the bass', 'Show system specs')"
                    className="flex-1 bg-transparent border-none outline-none text-white px-4 py-3 text-sm font-medium placeholder:text-gray-600"
                />
                <button 
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center hover:bg-sky-400 hover:text-white transition-all disabled:opacity-50"
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    </div>
  );
};