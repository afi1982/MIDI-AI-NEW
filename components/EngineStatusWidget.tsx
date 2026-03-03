
import React, { useEffect, useState } from 'react';
import { globalEngineService } from '../services/globalEngineService';
import { securityService } from '../services/securityService';
import { Activity, Globe, Lock, Cpu, ShieldCheck } from 'lucide-react';

export const EngineStatusWidget: React.FC = () => {
    const [engineStatus, setEngineStatus] = useState<any>({ online: false });
    const [secStatus, setSecStatus] = useState<any>({ secure: false });

    useEffect(() => {
        // Initial sync
        globalEngineService.syncWithWorld().then(() => {
            setEngineStatus(globalEngineService.getStatus());
        });
        setSecStatus(securityService.getStatus());

        // Poll for liveness
        const interval = setInterval(() => {
            setEngineStatus(globalEngineService.getStatus());
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center gap-4 bg-black/40 border border-white/5 rounded-full px-4 py-2 backdrop-blur-md">
            
            {/* Global Engine Status */}
            <div className="flex items-center gap-2 border-r border-white/10 pr-4">
                <div className="relative">
                    <Globe size={14} className="text-studio-accent" />
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                </div>
                <div className="flex flex-col leading-none">
                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">Global Engine</span>
                    <span className="text-[9px] text-white font-mono">{engineStatus.online ? "CONNECTED" : "SYNCING..."}</span>
                </div>
            </div>

            {/* Engine Model Status */}
            <div className="flex items-center gap-2 border-r border-white/10 pr-4 hidden md:flex">
                <Cpu size={14} className="text-sky-400" />
                <div className="flex flex-col leading-none">
                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">Engine Model</span>
                    <span className="text-[9px] text-white font-mono">GEMINI-3-PRO</span>
                </div>
            </div>

            {/* Security Status */}
            <div className="flex items-center gap-2">
                <ShieldCheck size={14} className={secStatus.secure ? "text-green-400" : "text-yellow-500"} />
                <div className="flex flex-col leading-none">
                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">Security</span>
                    <span className="text-[9px] text-white font-mono">{secStatus.algorithm || "INIT"}</span>
                </div>
            </div>

        </div>
    );
};
