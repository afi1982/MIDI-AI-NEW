
import { ProjectRecord, GrooveObject, UserProfile } from '../types';

const STORAGE_KEY_GUEST = 'emg_projects_guest';

class PersistenceService {
    
    private getStorageKey(user: UserProfile): string {
        // CRITICAL: Ensure distinct storage per user (Data Safety & Isolation)
        if (user.isGuest) return STORAGE_KEY_GUEST;
        return `emg_projects_${user.id}`;
    }

    /**
     * V56 MIGRATION UTILITY
     * Ensures old projects loaded from storage have the full 15-channel structure required by the new engine.
     */
    private migrateLegacyProject(record: ProjectRecord): ProjectRecord {
        const g = record.groove;
        
        // Check if migration is needed (e.g. missing ch1_kick but has kick)
        if (!g.ch1_kick && (g as any).kick) {
            console.log(`[Persistence] Migrating legacy project: ${record.name}`);
            
            // Map legacy simple keys to Elite V56 keys
            g.ch1_kick = (g as any).kick || [];
            g.ch2_sub = (g as any).bass || (g as any).subBass || [];
            g.ch3_midBass = (g as any).midBass || [];
            g.ch4_leadA = (g as any).leadMain || (g as any).lead || [];
            g.ch5_leadB = (g as any).leadSupport || [];
            g.ch6_arpA = (g as any).arp || [];
            g.ch7_arpB = []; // Init empty if not present
            g.ch8_snare = (g as any).snare || [];
            g.ch9_clap = (g as any).clap || [];
            g.ch10_percLoop = (g as any).perc || (g as any).perc1 || [];
            g.ch11_percTribal = (g as any).perc2 || [];
            g.ch12_hhClosed = (g as any).hhClosed || (g as any).hihat || [];
            g.ch13_hhOpen = (g as any).hhOpen || [];
            g.ch14_acid = (g as any).acid || (g as any).leadAcid || [];
            g.ch15_pad = (g as any).pad || (g as any).atmos || [];
            // ch16_fx removed as it is not part of the standard 15 channels
            
            // Update version metadata
            if (!g.meta) g.meta = {} as any;
            g.meta!.profileVersion = (g.meta!.profileVersion || "") + " [MIGRATED]";
        }
        
        // Ensure all arrays exist to prevent UI crashes
        const ensure = (k: string) => { if(!(g as any)[k]) (g as any)[k] = []; };
        const eliteKeys = ['ch1_kick', 'ch2_sub', 'ch3_midBass', 'ch4_leadA', 'ch5_leadB', 'ch6_arpA', 'ch7_arpB', 'ch8_snare', 'ch9_clap', 'ch10_percLoop', 'ch11_percTribal', 'ch12_hhClosed', 'ch13_hhOpen', 'ch14_acid', 'ch15_pad'];
        eliteKeys.forEach(ensure);

        return record;
    }

    public async saveProject(user: UserProfile, groove: GrooveObject): Promise<ProjectRecord> {
        const record: ProjectRecord = {
            id: groove.id || Date.now().toString(),
            userId: user.id,
            name: groove.name || "Untitled Project",
            timestamp: Date.now(),
            metadata: {
                genre: groove.genre || 'Unknown',
                bpm: groove.bpm,
                key: groove.key,
                scale: groove.scale,
                energyMode: groove.energyMode || 'Standard',
                profileVersion: groove.meta?.profileVersion || 'v1.0'
            },
            groove: groove,
            qaScore: groove.qaReport?.score || 0,
            qaStatus: groove.qaReport?.passed ? 'PASS' : 'FAIL'
        };

        const key = this.getStorageKey(user);
        let existing = this.loadFromStorage(key);
        
        // Upsert logic
        const index = existing.findIndex(p => p.id === record.id);
        if (index >= 0) {
            existing[index] = record;
        } else {
            existing.unshift(record); // Add to top
        }

        // CRITICAL: QUOTA MANAGEMENT
        try {
            const payload = JSON.stringify(existing);
            localStorage.setItem(key, payload);
            console.log(`[Persistence] Saved project ${record.id} for user ${user.name}`);
        } catch (e: any) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.warn("[Persistence] Storage Quota Exceeded! Attempting to prune old projects...");
                // Emergency Pruning: Keep only top 10 most recent projects
                const pruned = existing.slice(0, 10);
                try {
                    localStorage.setItem(key, JSON.stringify(pruned));
                    alert("Storage full. Older projects were removed to save this one.");
                } catch (retryErr) {
                    console.error("CRITICAL: Failed to save even after pruning.", retryErr);
                    alert("Failed to save project. Browser storage is full.");
                }
            } else {
                console.error("CRITICAL: Storage Error", e);
            }
        }
        
        return record;
    }

    public async getProjects(user: UserProfile): Promise<ProjectRecord[]> {
        const key = this.getStorageKey(user);
        const projects = this.loadFromStorage(key);
        // Run migration on load to ensure compatibility with new versions
        return projects.map(p => this.migrateLegacyProject(p));
    }

    public async deleteProject(user: UserProfile, projectId: string): Promise<void> {
        if (!projectId) return;
        const key = this.getStorageKey(user);
        const existing = this.loadFromStorage(key);
        
        const updated = existing.filter(p => p.id !== projectId);
        localStorage.setItem(key, JSON.stringify(updated));
    }

    public async duplicateProject(user: UserProfile, projectId: string): Promise<void> {
        const key = this.getStorageKey(user);
        const existing = this.loadFromStorage(key);
        const original = existing.find(p => p.id === projectId);
        
        if (original) {
            const copy: ProjectRecord = {
                ...original,
                id: `${Date.now()}_copy`,
                name: `${original.name} (Copy)`,
                timestamp: Date.now()
            };
            existing.unshift(copy);
            try {
                localStorage.setItem(key, JSON.stringify(existing));
            } catch (e) {
                alert("Cannot duplicate: Storage full.");
            }
        }
    }

    private loadFromStorage(key: string): ProjectRecord[] {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return [];
            
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                console.warn("Storage corruption detected: expected array. Attempting to salvage.");
                // If it's a single object, wrap it
                if (typeof parsed === 'object' && parsed !== null && parsed.id) {
                    return [parsed];
                }
                return [];
            }
            return parsed;
        } catch (e) {
            console.error("Failed to load projects", e);
            return [];
        }
    }
}

export default new PersistenceService();
