
import { AgentTool } from "./types";
import { pythonTool } from "./pythonTool";
import { imageGenTool } from "./imageGenTool";

// Registry of all active tools
export const TOOLS: AgentTool[] = [
    pythonTool, 
    imageGenTool
];

export const TOOL_DECLARATIONS = TOOLS.map(t => t.declaration);

export const getTool = (name: string): AgentTool | undefined => {
    return TOOLS.find(t => t.name === name);
};
