
import React, { useState, useEffect } from 'react';
import { innovationService, DevelopmentProposal } from '../services/innovationService';
import { Cpu, Lightbulb, Code, Wrench, MessageSquare, Trash2, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';

interface InnovationsHubProps {
    onDiscuss: (proposal: DevelopmentProposal) => void;
    onClose: () => void;
}

export const InnovationsHub: React.FC<InnovationsHubProps> = ({ onDiscuss, onClose }) => {
    const [proposals, setProposals] = useState<DevelopmentProposal[]>([]);

    useEffect(() => {
        return innovationService.subscribe(setProposals);
    }, []);

    const getIcon = (cat: string) => {
        switch(cat) {
            case 'TOOL': return <Wrench className="text-sky-400" size={20} />;
            case 'CODE': return <Code className="text-purple-400" size={20} />;
            case 'UI': return <Lightbulb className="text-yellow-400" size={20} />;
            default: return <Cpu className="text-gray-400" size={20} />;
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#050507] text-white animate-in fade-in">
            <header className="h-20 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-8 shrink-0">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                        Innovation <span className="text-sky-500">Hub</span>
                    </h1>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Ideas and improvements</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => innovationService.clearAll()} className="p-2 text-gray-600 hover:text-red-400 transition-colors">
                        <Trash2 size={18} />
                    </button>
                    <button onClick={onClose} className="px-6 py-2 border border-white/10 rounded-lg hover:bg-white/5 text-xs font-bold uppercase transition-all">Back</button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-5xl mx-auto space-y-6">
                    {proposals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/5 rounded-3xl opacity-30">
                            <Lightbulb size={48} className="mb-4" />
                            <h3 className="text-xl font-bold">Scanning for ideas...</h3>
                            <p className="text-sm">New development proposals will appear here soon.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {proposals.map(prop => (
                                <div key={prop.id} className="bg-[#111] border border-white/5 rounded-2xl p-6 hover:border-sky-500/30 transition-all group relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-white/5 rounded-xl">{getIcon(prop.category)}</div>
                                        <div className="flex flex-col items-end">
                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                                prop.priority === 'HIGH' ? 'border-red-500/50 text-red-500 bg-red-500/5' : 'border-sky-500/50 text-sky-500'
                                            }`}>
                                                Priority {prop.priority}
                                            </span>
                                            <span className="text-[8px] text-gray-600 mt-1 font-mono">{new Date(prop.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-white mb-2">{prop.title}</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed mb-6">{prop.description}</p>

                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => onDiscuss(prop)}
                                            className="flex-1 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all"
                                        >
                                            <MessageSquare size={14} /> Discuss with Mentor
                                        </button>
                                        <button 
                                            onClick={() => innovationService.updateStatus(prop.id, 'ACCEPTED')}
                                            className="p-3 bg-white/5 hover:bg-green-500/20 text-gray-500 hover:text-green-500 rounded-xl transition-all"
                                            title="Accept Idea"
                                        >
                                            <CheckCircle size={18} />
                                        </button>
                                    </div>
                                    
                                    {prop.status === 'ACCEPTED' && (
                                        <div className="absolute inset-0 bg-green-500/10 border border-green-500/40 pointer-events-none flex items-center justify-center">
                                            <div className="bg-black border border-green-500 px-4 py-2 rounded-full text-green-500 font-bold uppercase text-xs">Approved for Development</div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
