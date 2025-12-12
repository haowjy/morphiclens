
import { AppState } from "../types";

const STORAGE_KEY = "morpholens_prefs_v1";

interface UserPreferences {
    activeThreadId: string | null;
    activeFileId: string | null;
    isFilesCollapsed: boolean;
}

export const loadPreferences = (): Partial<UserPreferences> => {
  try {
    if (typeof window === 'undefined') return {};
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return {};
    return JSON.parse(saved);
  } catch (e) {
    console.warn("Failed to load prefs:", e);
    return {};
  }
};

export const savePreferences = (state: AppState) => {
  try {
    const prefs: UserPreferences = {
      activeThreadId: state.activeThreadId,
      activeFileId: state.activeFileId,
      isFilesCollapsed: state.isFilesCollapsed,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn("Failed to save prefs:", e);
  }
};
