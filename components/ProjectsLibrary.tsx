
import React, { useState, useEffect } from 'react';
import { ProjectRecord, UserProfile } from '../types';
import persistenceService from '../services/persistenceService';
import { downloadFullArrangementMidi } from '../services/midiService';

interface ProjectsLibraryProps {
    user: UserProfile;
    onLoad: (project: ProjectRecord) => void;
    onClose: () => void;
}

export const ProjectsLibrary: React.FC<ProjectsLibraryProps> = ({ user, onLoad, onClose }) => {
    const [projects, setProjects] = useState<ProjectRecord[]>([]);
    const [search, setSearch] = useState('');
    const [filterGenre, setFilterGenre] = useState<string>('ALL');

    useEffect(() => {
        loadData();
    }, [user]);

    const loadData = async () => {
        const data = await persistenceService.getProjects(user);
        setProjects(data);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        // CRITICAL FIX: Stop event bubbling immediately to prevent opening the project
        e.stopPropagation();
        e.preventDefault(); 
        
        if (window.confirm('⚠️ PERMANENT DELETION\n\nAre you sure you want to delete this project? This action cannot be undone.')) {
            // FIX: Await deletion first, then reload from source of truth
            try {
                await persistenceService.deleteProject(user, id);
                // Update local state only after successful deletion
                const updatedData = await persistenceService.getProjects(user);
                setProjects(updatedData);
            } catch (error) {
                console.error("Deletion failed:", error);
                alert("Failed to delete project.");
            }
        }
    };

    const handleDuplicate = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        e.preventDefault();
        await persistenceService.duplicateProject(user, id);
        loadData();
    };

    const handleDownload = (e: React.MouseEvent, project: ProjectRecord) => {
        e.stopPropagation();
        e.preventDefault();
        downloadFullArrangementMidi(project.groove);
    };

    const genres = ['ALL', ...Array.from(new Set(projects.map(p => p.metadata.genre)))];
    const filtered = projects.filter(p => (p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search)) && (filterGenre === 'ALL' || p.metadata.genre === filterGenre));

    return (
        <div className="w-full h-full flex flex-col bg-[#050507] text-white font-sans overflow-hidden animate-in slide-in-from-right-10 duration-500">
            <div className="h-20 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-display font-black uppercase tracking-tighter text-white">
                        My <span className="text-studio-accent">Projects</span>
                    </h1>
                </div>
                <button onClick={onClose} className="px-6 py-2 border border-white/10 rounded-lg hover:bg-white/5 text-xs font-bold uppercase tracking-widest transition-all">Back to Studio</button>
            </div>
            <div className="p-6 border-b border-white/5 bg-[#08080A] flex flex-col md:flex-row gap-4 shrink-0">
                <input type="text" placeholder="Search Projects..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 bg-black border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:border-studio-accent outline-none font-mono" />
                <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                    {genres.map(g => (
                        <button key={g} onClick={() => setFilterGenre(g)} className={`px-3 py-2 rounded text-[9px] font-bold uppercase tracking-widest border transition-all whitespace-nowrap ${filterGenre === g ? 'bg-studio-accent text-black border-studio-accent' : 'border-white/10 text-gray-500 hover:text-white'}`}>{g}</button>
                    ))}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(project => (
                        <div 
                            key={project.id} 
                            onClick={() => onLoad(project)} 
                            className="group bg-[#111] border border-white/5 hover:border-studio-accent/50 rounded-xl p-4 cursor-pointer transition-all hover:bg-white/5 relative overflow-hidden"
                        >
                            
                            {/* ACTION BUTTONS */}
                            <div className="absolute top-0 right-0 p-2 z-50 flex gap-2">
                                <button 
                                    onClick={(e) => handleDuplicate(e, project.id)}
                                    className="w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-white/10 rounded text-gray-400 hover:text-white border border-white/5 transition-colors"
                                    title="Duplicate"
                                >
                                    📋
                                </button>
                                <button 
                                    onClick={(e) => handleDelete(e, project.id)}
                                    className="w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-red-900/50 rounded text-gray-400 hover:text-red-500 border border-white/5 transition-colors"
                                    title="Delete"
                                >
                                    🗑️
                                </button>
                            </div>

                            <h3 className="text-sm font-bold text-white font-orbitron mb-1 truncate pr-20">{project.name || 'Untitled Track'}</h3>
                            <p className="text-[9px] text-gray-500 font-mono mb-2">
                                {project.metadata.key} {project.metadata.scale} • {project.metadata.bpm} BPM
                            </p>
                            
                            <div className="mt-4 pt-3 border-t border-white/5 flex gap-2 relative z-10">
                                <button 
                                    onClick={(e) => handleDownload(e, project)}
                                    className="flex-1 py-1.5 bg-white/5 hover:bg-white/20 rounded text-[9px] font-bold uppercase tracking-widest text-white border border-white/10 hover:border-white/30 transition-all"
                                >
                                    Download
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProjectsLibrary;
