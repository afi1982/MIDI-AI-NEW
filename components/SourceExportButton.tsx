
import React from 'react';
import { FileText } from 'lucide-react';
import { downloadPageSource } from '../services/pageSourceService.ts';

interface SourceExportButtonProps {
    pageKey: string;
    label?: string;
}

export const SourceExportButton: React.FC<SourceExportButtonProps> = ({ pageKey, label = "Page Logic" }) => {
    return (
        <button 
            onClick={() => downloadPageSource(pageKey)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-all group"
            title="Download Source Code & Logic Explanation"
        >
            <FileText size={12} className="text-gray-500 group-hover:text-studio-accent" />
            {label}
        </button>
    );
};
