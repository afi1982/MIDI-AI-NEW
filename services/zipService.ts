
import JSZip from 'jszip';
import { GrooveObject, ChannelKey } from '../types';
import { exportMidi } from './midiService';
import { runGrooveQA } from './qaService';
import { reportService } from './reportService';

// Helper to trigger browser download directly
const triggerDownload = (filename: string, content: Blob) => {
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 1000);
};

export const zipService = {
    exportAll: async (params: {
        groove: GrooveObject;
        runId: string;
        genre: string;
        selectedChannels: ChannelKey[];
        includeEngineLogTxt: boolean;
        includeQaReportJson: boolean;
        mode: string;
        fileTag?: string; 
    }) => {
        try {
            // 1. RUN QA
            const qaResult = runGrooveQA(params.groove, params.selectedChannels);

            if (!qaResult.passed) {
                let errorMsg = "⚠️ QA WARNING: TRACK ISSUES DETECTED\n\n";
                errorMsg += "The system detected potential issues:\n";
                qaResult.forensicData.warnings.forEach(w => errorMsg += `• ${w}\n`);
                qaResult.forensicData.genreViolations.forEach(v => errorMsg += `• ${v}\n`);
                
                errorMsg += `\nQA Score: ${qaResult.score}/100\n`;
                errorMsg += "\nDo you want to proceed with export anyway?";
                
                // Allow user to cancel gracefully
                if (!window.confirm(errorMsg)) {
                    throw new Error("USER_CANCELLED_EXPORT");
                }
            }

            // 2. PREPARE DYNAMIC FILENAME
            const zip = new JSZip();
            const cleanName = (params.groove.name || "Untitled").replace(/[^a-zA-Z0-9-_]/g, "_");
            const bpm = params.groove.bpm || 145;
            
            // DYNAMIC IDENTITY LOGIC
            let identityTag = "MULTI_TRACK";
            if (params.selectedChannels.length === 1) {
                // If only one channel, use its name (e.g. KICK)
                identityTag = params.selectedChannels[0].split('_')[1].toUpperCase();
            } else if (params.selectedChannels.length >= 14) {
                // If all or almost all (Elite 15), mark as FULL
                identityTag = "FULL_PROJECT";
            }

            const baseName = `${identityTag}_MIDI_AI_${cleanName}_${bpm}BPM_midiai.com`;

            // 3. GENERATE MIDI
            const masterMidi = exportMidi(params.groove, params.selectedChannels);
            if (masterMidi && masterMidi.bytes.length > 0) {
                zip.file(`${baseName}.mid`, masterMidi.bytes);
            } else {
                console.warn("MIDI Export empty or failed");
                zip.file("ERROR_NO_MIDI.txt", "MIDI Generation failed or resulted in empty file.");
            }

            // 4. GENERATE REPORT
            const reportText = reportService.generateReport(params.groove, qaResult, { 
                runId: params.runId, 
                generationType: params.groove.masterSeed ? "AI_GENERATION" : "MANUAL/HYBRID" 
            });
            zip.file(`${baseName}_REPORT.txt`, reportText);

            // 5. GENERATE JSON (Story Map)
            if (params.includeQaReportJson && params.groove.storyMap) {
                const jsonText = JSON.stringify(params.groove.storyMap, null, 2);
                zip.file(`${baseName}_STORY.json`, jsonText);
            }

            // 6. DOWNLOAD ZIP
            const zipContent = await zip.generateAsync({ type: "blob" });
            triggerDownload(`${baseName}_PACKAGE.zip`, zipContent);

            return {
                mode: "ZIP_PACKAGED",
                files: [],
                urls: {}
            };

        } catch (e: any) {
            // Handle User Cancellation Gracefully
            const msg = (e.message || e.toString() || "").toUpperCase();
            if (msg.includes("USER_CANCELLED") || msg.includes("EXPORT CANCELLED")) {
                console.info("Export flow cancelled by user.");
                return { mode: "CANCELLED", files: [], urls: {} };
            }

            console.error("Export Failed", e);
            alert(`EXPORT ERROR: ${e.message || "Unknown error"}`);
            return { mode: "ERROR", files: [], urls: {} };
        }
    }
};
