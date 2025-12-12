
/**
 * Agent Response Parser
 * Responsible for extracting tool calls and code blocks from the raw LLM text stream
 * during the runtime (not UI rendering).
 */

export function extractPythonBlocks(text: string): string[] {
    // Matches 3 or 4 backticks: ```python:run ... ``` or ````python:run ... ````
    // The \1 ensures the closing backticks match the length of the opening backticks
    const pythonBlockRegex = /(`{3,4})python:run([\s\S]*?)\1/g;
    const blocks: string[] = [];
    let match;
    
    while ((match = pythonBlockRegex.exec(text)) !== null) {
        if (match[2]) {
            blocks.push(match[2].trim());
        }
    }
    
    return blocks;
}
