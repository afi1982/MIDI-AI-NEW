
import { useState, useCallback } from 'react';
import { GrooveObject, HistorySnapshot } from '../types';

export const useProjectHistory = (initialState: GrooveObject | null) => {
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // Initialize history when a new project is loaded if history is empty
  const initializeHistory = useCallback((groove: GrooveObject) => {
    const snapshot: HistorySnapshot = {
      id: Date.now(),
      label: 'Project Initialized',
      payload: JSON.parse(JSON.stringify(groove)),
      timestamp: new Date().toISOString()
    };
    setHistory([snapshot]);
    setCurrentIndex(0);
  }, []);

  const saveSnapshot = useCallback((data: GrooveObject, label: string) => {
    setHistory(prev => {
      // If we are in the middle of history, cut off the future
      const past = prev.slice(0, currentIndex + 1);
      const snapshot: HistorySnapshot = {
        id: Date.now(),
        label: label,
        payload: JSON.parse(JSON.stringify(data)),
        timestamp: new Date().toISOString()
      };
      const newHistory = [...past, snapshot];
      // Limit history size to 50
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setCurrentIndex(prev => Math.min(prev + 1, 49)); // Clamp to updated history length
  }, [currentIndex]);

  const undo = useCallback((): GrooveObject | null => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      return history[newIndex].payload;
    }
    return null;
  }, [currentIndex, history]);

  const redo = useCallback((): GrooveObject | null => {
    if (currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      return history[newIndex].payload;
    }
    return null;
  }, [currentIndex, history]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return {
    history,
    currentIndex,
    saveSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    initializeHistory
  };
};
