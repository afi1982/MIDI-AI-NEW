
// V1.0 GLOBAL INTELLIGENCE NETWORK
// Simulates connection to a worldwide database of production trends.

interface MarketTrend {
    genre: string;
    trendingBpm: number;
    popularScale: string;
    productionTip: string;
    region: string;
}

// Mock Global Data Stream
const GLOBAL_TRENDS: MarketTrend[] = [
    { genre: "Psytrance", trendingBpm: 146, popularScale: "Phrygian Dominant", productionTip: "Increase FM modulation on leads", region: "Tel Aviv, IL" },
    { genre: "Techno", trendingBpm: 134, popularScale: "Minor", productionTip: "Rumble kicks are tighter today", region: "Berlin, DE" },
    { genre: "Progressive", trendingBpm: 138, popularScale: "Dorian", productionTip: "Focus on offbeat ethereal pads", region: "Melbourne, AU" }
];

class GlobalEngineService {
    private lastSync: number = 0;
    private activeTrend: MarketTrend | null = null;

    public async syncWithWorld(): Promise<MarketTrend> {
        // Simulate network latency to world servers
        await new Promise(r => setTimeout(r, 800));
        
        // Pick a trend based on "Server Time"
        const index = Date.now() % GLOBAL_TRENDS.length;
        this.activeTrend = GLOBAL_TRENDS[index];
        this.lastSync = Date.now();
        
        console.log(`[GlobalEngine] Synced. Trend detected in ${this.activeTrend.region}: ${this.activeTrend.productionTip}`);
        return this.activeTrend;
    }

    public getContextInjection(): string {
        if (!this.activeTrend) return "Standard Global Baseline";
        return `GLOBAL_MARKET_DATA [${this.activeTrend.region}]: Trending ${this.activeTrend.trendingBpm}BPM. ADVICE: ${this.activeTrend.productionTip}.`;
    }

    public getStatus() {
        return {
            online: true,
            lastSync: new Date(this.lastSync).toLocaleTimeString(),
            node: "IL-TLV-01" // Israel Node
        };
    }
}

export const globalEngineService = new GlobalEngineService();
