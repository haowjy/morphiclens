
import { AgentMode } from './types';
import { MorphoLensMode } from './builtins/morpholens';

const MODE_REGISTRY: Map<string, AgentMode> = new Map();

// Register Default Mode
const defaultMode = new MorphoLensMode();
MODE_REGISTRY.set(defaultMode.id, defaultMode);

export const getMode = (id: string): AgentMode | undefined => {
  return MODE_REGISTRY.get(id);
};

export const getDefaultMode = (): AgentMode => {
  return defaultMode;
};

export const registerMode = (mode: AgentMode) => {
  MODE_REGISTRY.set(mode.id, mode);
};

export const getAllModes = (): AgentMode[] => {
  return Array.from(MODE_REGISTRY.values());
};
