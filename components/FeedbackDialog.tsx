import React, { useState } from 'react';
import { FeedbackTag } from '../types';

interface FeedbackDialogProps {
    onSubmit: (rating: number, tags: FeedbackTag[]) => void;
    onClose: () => void;
}

const TAGS: { id: FeedbackTag; label: string }[] = [
    { id: 'BORING', label: 'Boring' },
    { id: 'NO_HOOK', label: 'No Hook' },
    { id: 'WEAK_DROP', label: 'Weak Drop' },
    { id: 'EMPTY_BREAK', label: 'Empty Break' },
    { id: 'TOO_REPETITIVE', label: 'Too Repetitive' },
    { id: 'GOOD_GROOVE', label: 'Good Groove' },
    { id: 'PERFECT_ENERGY', label: 'Perfect Energy' },
];

const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ onSubmit, onClose }) => {
    const [rating, setRating] = useState<number>(0);
    const [selectedTags, setSelectedTags] = useState<FeedbackTag[]>([]);

    const toggleTag = (tag: FeedbackTag) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(selectedTags.filter(t => t !== tag));
        } else {
            setSelectedTags([...selectedTags, tag]);
        }
    };

    const handleSubmit = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (rating === 0) return;
        onSubmit(rating, selectedTags);
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in zoom-in-95 duration-200">
            <div className="w-full max-w-md bg-studio-panel border border-studio-border rounded-2xl p-8 shadow-[0_0_50px_rgba(0,0,0,1)] relative overflow-hidden pointer-events-auto">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-studio-accent to-purple-600"></div>
                
                <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight mb-2 text-center">
                    Refine the Production Engine
                </h2>
                <p className="text-center text-[10px] text-studio-dim font-mono mb-8 uppercase tracking-[0.2em]">
                    Your feedback optimizes style profiles V38 Elite
                </p>

                {/* Stars */}
                <div className="flex justify-center gap-4 mb-10">
                    {[1, 2, 3, 4, 5].map(star => (
                        <button 
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            className={`text-4xl transition-all hover:scale-125 cursor-pointer select-none active:scale-95 ${rating >= star ? 'text-studio-accent drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'text-zinc-800 hover:text-zinc-600'}`}
                        >
                            ★
                        </button>
                    ))}
                </div>

                {/* Tags */}
                <div className="grid grid-cols-2 gap-2 mb-10">
                    {TAGS.map(tag => (
                        <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTag(tag.id)}
                            className={`
                                py-3 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer select-none
                                ${selectedTags.includes(tag.id) 
                                    ? 'bg-studio-accent text-black border-studio-accent shadow-glow' 
                                    : 'bg-white/5 border-white/10 text-zinc-500 hover:text-white hover:border-white/30'}
                            `}
                        >
                            {tag.label}
                        </button>
                    ))}
                </div>

                <div className="flex gap-4">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-4 bg-transparent text-zinc-600 font-bold uppercase text-xs hover:text-white transition-colors cursor-pointer"
                    >
                        Skip
                    </button>
                    <button 
                        type="button"
                        onClick={handleSubmit}
                        disabled={rating === 0}
                        className={`flex-1 py-4 font-black uppercase text-xs rounded-xl shadow-glow transition-all cursor-pointer
                            ${rating > 0 ? 'bg-white text-black hover:bg-studio-accent hover:scale-105 active:scale-95' : 'bg-white/10 text-white/10 opacity-50 cursor-not-allowed'}
                        `}
                    >
                        Submit Feedback
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FeedbackDialog;