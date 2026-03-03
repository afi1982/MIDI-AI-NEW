
const LOG_STORAGE_KEY = 'EMG_ENGINE_LOGS_V1';

export interface LogEntry {
    timestamp: string;
    line: string;
    type?: string;
    proof?: any;
}

class EngineLogService {
    private logs: LogEntry[] = [];

    constructor() {
        this.load();
    }

    private load() {
        try {
            const raw = localStorage.getItem(LOG_STORAGE_KEY);
            this.logs = raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error("Failed to load Engine logs", e);
            this.logs = [];
        }
    }

    private save() {
        // Limit to last 2000 entries
        if (this.logs.length > 2000) {
            this.logs = this.logs.slice(-2000);
        }
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.logs));
    }

    public append(event: { type: string; runId?: string; genre?: string; [key: string]: any }) {
        const { type, runId, genre, ...details } = event;
        const now = new Date().toISOString();
        
        let detailStr = Object.entries(details)
            .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
            .join(' | ');

        const line = `[${now}] ${type} | ${genre || 'N/A'} | ${runId || 'SYSTEM'} | ${detailStr}`;
        
        console.log(`[EngineLog] ${line}`);
        
        this.logs.push({ 
            timestamp: now, 
            line,
            type,
            proof: details 
        });
        this.save();
    }

    /**
     * Legacy wrapper
     */
    public log(event: string, genre: string, ...details: string[]) {
        this.append({ type: event, genre, message: details.join(" ") });
    }

    public getLogsAsText(): string {
        if (this.logs.length === 0) return "ENGINE LOG EMPTY - NO EVENTS RECORDED.";
        
        const header = `EMG NEURAL ENGINE LOG (V38.5 PIPELINE)\nGenerated: ${new Date().toLocaleString()}\nEvents: ${this.logs.length}\n--------------------------------------------------------------------------------`;
        return header + "\n" + this.logs.map(l => l.line).join('\n');
    }
    
    public getRecentLogs(): LogEntry[] {
        return [...this.logs].reverse(); // Newest first
    }
    
    public clearLogs() {
        this.logs = [];
        this.save();
    }
}

export const engineLogService = new EngineLogService();
export const engineLog = engineLogService; // Alias for pipeline compatibility
