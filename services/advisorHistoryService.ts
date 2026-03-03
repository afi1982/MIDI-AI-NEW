
import { securityService } from './securityService';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isDevSpec?: boolean;
  attachmentName?: string;
  attachmentType?: 'AUDIO' | 'MIDI' | 'SYSTEM_SNAPSHOT';
  snapshotData?: any;
  isSystemPush?: boolean; // New flag for background AI messages
}

const STORAGE_KEY = 'MIDI_AI_ADVISOR_HISTORY_V2';

class AdvisorHistoryService {
  private history: ChatMessage[] = [];
  private listeners: ((messages: ChatMessage[]) => void)[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.history = JSON.parse(raw);
      }
    } catch (e) {
      console.error("[AdvisorHistory] Failed to load history", e);
      this.history = [];
    }
  }

  public subscribe(callback: (messages: ChatMessage[]) => void) {
    this.listeners.push(callback);
    // Send current state immediately
    callback(this.history);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(l => l([...this.history]));
  }

  public getHistory(): ChatMessage[] {
    return [...this.history];
  }

  public async saveMessage(message: ChatMessage) {
    this.history.push(message);
    // Limit to 50 messages
    if (this.history.length > 50) {
      this.history = this.history.slice(-50);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    this.notify(); // Trigger UI updates
  }

  public clearHistory() {
    this.history = [];
    localStorage.removeItem(STORAGE_KEY);
    this.notify();
  }

  public getGeminiHistory() {
    return this.history.map(m => ({
      role: m.role,
      parts: [{ 
        text: (m.snapshotData ? `[SYSTEM_CONTEXT_SNAPSHOT]: ${JSON.stringify(m.snapshotData).substring(0, 10000)}\n\n` : '') + m.text 
      }]
    }));
  }
}

export const advisorHistoryService = new AdvisorHistoryService();
