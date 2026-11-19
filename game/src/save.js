// Save: cash, mission progress and best wanted level, in this browser only.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: typeof data.cash === 'number' ? data.cash : 0,
      missionIndex: typeof data.missionIndex === 'number' ? data.missionIndex : 0,
      completed: Array.isArray(data.completed) ? data.completed : [],
      bestWanted: typeof data.bestWanted === 'number' ? data.bestWanted : 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Private mode or storage full: the game still plays, it just won't persist.
  }
}

export function newSave() {
  return { cash: 150, missionIndex: 0, completed: [], bestWanted: 0 };
}
