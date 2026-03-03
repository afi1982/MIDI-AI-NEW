
import { GrooveObject } from '../types';

export type ProjectType = 'GENERATED' | 'ANALYZED';

export interface LibraryItem {
  id: string;
  type: ProjectType;
  name: string;
  date: number;
  data: {
    groove?: GrooveObject; // For Generated
    segments?: GrooveObject[]; // For Analyzed
    bpm?: number;
    duration?: number;
  };
}

const STORAGE_KEY = 'TRANCEGEN_LIBRARY_V1';

// --- LOCAL STORAGE (BROWSER) ---

export const saveProjectToLibrary = (item: Omit<LibraryItem, 'id' | 'date'>) => {
  try {
    const existing = getLibrary();
    const newItem: LibraryItem = {
      ...item,
      id: Date.now().toString(),
      date: Date.now()
    };
    
    // Limit to 50 items to prevent LocalStorage quota issues
    const updated = [newItem, ...existing].slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return newItem;
  } catch (e) {
    console.error("Failed to save to library", e);
    return null;
  }
};

export const getLibrary = (): LibraryItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const deleteFromLibrary = (id: string) => {
  const existing = getLibrary();
  const updated = existing.filter(i => i.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const clearLibrary = () => {
  localStorage.removeItem(STORAGE_KEY);
};

// --- FILE SYSTEM (IMPORT/EXPORT) ---

/**
 * EXPORT SESSION (The Saver)
 * Saves the exact state of the GrooveObject to a JSON file.
 */
export const exportSessionToJSON = (groove: GrooveObject) => {
    const sessionData = {
        version: "V17.3",
        timestamp: Date.now(),
        metadata: {
            style: (groove as any).styleKey || "CUSTOM", // Preserve style key if available
            bpm: groove.bpm,
            scale: groove.scale,
            key: groove.key
        },
        groove: groove
    };

    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: "application/json" });
    
    // Robust Download Trigger (DOM Injection)
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none'; // Ensure invisible
    link.href = url;
    link.download = `TranceGen_${groove.name.replace(/\s+/g, '_')}_Session.json`;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }, 200);
};

/**
 * IMPORT SESSION (The Restorer)
 * Loads a JSON file, validates V17.3 compatibility, and returns the GrooveObject.
 */
export const importSessionFromJSON = (file: File): Promise<GrooveObject> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const sessionData = JSON.parse(content);
                
                // Version Validation
                if (sessionData.version !== "V17.3") {
                    console.warn("Version mismatch: Session file might be from an older or newer version.");
                    // We continue anyway, but log warning.
                }

                if (!sessionData.groove) {
                    throw new Error("Invalid Session File: Missing groove data.");
                }

                console.log(`Loading session: ${sessionData.metadata?.style} at ${sessionData.metadata?.bpm} BPM`);
                resolve(sessionData.groove);
            } catch (err) {
                console.error("Error parsing session file", err);
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("File reading failed"));
        reader.readAsText(file);
    });
};