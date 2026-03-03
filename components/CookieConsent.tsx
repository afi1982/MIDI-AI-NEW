
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Info, Cookie } from 'lucide-react';

export const CookieConsent: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // בדיקה האם המשתמש כבר אישר בעבר
        const consent = localStorage.getItem('EMG_COOKIE_CONSENT');
        if (!consent) {
            // השהיה קלה להצגת הבאנר לאחר טעינת הדף
            setTimeout(() => setIsVisible(true), 1500);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('EMG_COOKIE_CONSENT', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div 
            role="alert" 
            aria-live="polite" 
            className="fixed bottom-0 left-0 right-0 z-[10000] bg-[#050505]/95 backdrop-blur-xl border-t border-sky-500/50 p-6 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-full duration-700 font-sans" 
        >
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                
                <div className="flex items-center gap-5">
                    <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-2xl hidden md:flex items-center justify-center shrink-0">
                        <Cookie className="w-8 h-8 text-sky-400" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-white font-black text-lg flex items-center gap-2">
                            Cookie & Privacy Policy
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed max-w-4xl font-medium">
                            This site uses cookies to improve your experience. By continuing to use the site, you agree to our terms of use and privacy policy.
                        </p>
                    </div>
                </div>

                <div className="flex shrink-0 w-full md:w-auto">
                    <button 
                        onClick={handleAccept}
                        className="w-full md:w-auto px-12 py-4 bg-sky-500 hover:bg-white text-black font-black text-sm uppercase tracking-widest rounded-xl transition-all shadow-[0_0_30px_rgba(14,165,233,0.3)] active:scale-95 focus:outline-none whitespace-nowrap"
                    >
                        I Accept & Continue
                    </button>
                </div>
            </div>
        </div>
    );
};
