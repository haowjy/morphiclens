
import { AppState } from "../types";

const STORAGE_KEY = "morpholens_workspace_v1";

export const loadState = (): Partial<AppState> => {
  try {
    if (typeof window === 'undefined') return {};
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return {};
    return JSON.parse(saved);
  } catch (e) {
    console.warn("Failed to load workspace from storage:", e);
    return {};
  }
};

export const saveState = (state: AppState) => {
  try {
    const stateToPersist = {
      files: state.files,
      threads: state.threads,
      turnsByThread: state.turnsByThread,
      activeThreadId: state.activeThreadId,
      // We do not persist activeFileId because blob URLs expire on refresh
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToPersist));
  } catch (e) {
    console.warn("Failed to save workspace to storage:", e);
  }
};

export const clearState = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
    } catch(e) {
        console.error(e);
    }
}
