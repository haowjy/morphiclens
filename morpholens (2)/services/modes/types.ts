
import { AppFile } from "../../types";
import { FunctionDeclaration } from "@google/genai";

export interface PythonLibraryConfig {
  moduleName: string;           // e.g., 'mlens'
  sourceCode: string;           // Python class/functions definition
  globalAlias?: string;         // Optional global variable name (e.g. 'mlens')
}

export interface ModeContext {
  activeFile: AppFile | null;
  files: AppFile[];
  threadId: string;
}

export interface AgentMode {
  id: string;
  name: string;
  description: string;
  
  /** Base system prompt for this mode */
  getSystemPrompt(): string;

  /** Dynamic context injected per-turn */
  getDynamicContext?(context: ModeContext): string;

  /** Which agent tools are available (IDs) */
  getAvailableTools(): string[];

  /** Python environment setup */
  getPythonLibrary(): PythonLibraryConfig;
  
  /** PyPI packages to install */
  getRequiredPackages(): string[];
}
