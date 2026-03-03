
// services/innovationService.ts

export interface DevelopmentProposal {
    id: string;
    title: string;
    description: string;
    category: 'TOOL' | 'CODE' | 'UI' | 'LOGIC';
    priority: 'LOW' | 'MED' | 'HIGH';
    status: 'PROPOSED' | 'DISCUSSING' | 'ACCEPTED' | 'REJECTED';
    timestamp: number;
    technicalSpec?: string;
}

const STORAGE_KEY = 'MIDI_AI_INNOVATIONS_V1';

class InnovationService {
    private proposals: DevelopmentProposal[] = [];
    private listeners: ((proposals: DevelopmentProposal[]) => void)[] = [];

    constructor() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            this.proposals = JSON.parse(saved);
        }
    }

    public getProposals() {
        return [...this.proposals].sort((a, b) => b.timestamp - a.timestamp);
    }

    public subscribe(callback: (proposals: DevelopmentProposal[]) => void) {
        this.listeners.push(callback);
        callback(this.getProposals());
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notify() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.proposals));
        this.listeners.forEach(l => l(this.getProposals()));
    }

    public addProposal(proposal: Omit<DevelopmentProposal, 'id' | 'timestamp' | 'status'>) {
        // מניעת כפילויות לפי כותרת
        if (this.proposals.find(p => p.title === proposal.title)) return;

        const newProposal: DevelopmentProposal = {
            ...proposal,
            id: `PROP-${Date.now()}`,
            timestamp: Date.now(),
            status: 'PROPOSED'
        };
        this.proposals.unshift(newProposal);
        this.notify();
    }

    public updateStatus(id: string, status: DevelopmentProposal['status']) {
        const p = this.proposals.find(prop => prop.id === id);
        if (p) {
            p.status = status;
            this.notify();
        }
    }

    public clearAll() {
        this.proposals = [];
        this.notify();
    }
}

export const innovationService = new InnovationService();
