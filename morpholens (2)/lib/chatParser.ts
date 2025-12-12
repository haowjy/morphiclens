
import { ThreadTurn, ThreadPart, FileType, AppFile } from "../types";
import { SYSTEM_OUTPUT_PREFIX } from "../constants";

export type UIBlock = 
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string; isStreaming: boolean }
  | { type: 'code'; code: string; result?: string; status: 'pending' | 'running' | 'complete'; generatedImages?: { id: string; name: string; url: string; type: FileType }[] }
  | { type: 'tool'; name: string; args: any; result?: string; status: 'pending' | 'running' | 'complete'; generatedImages?: { id: string; name: string; url: string; type: FileType }[] }
  | { type: 'attachments'; fileIds: string[] }
  | { type: 'grounding'; metadata: any }
  | { type: 'error'; content: string };

/**
 * Parses a ThreadTurn into a list of UIBlocks for rendering.
 * Handles the merging of "python:run" code blocks with their subsequent "System Output" results.
 * Also handles standard Gemini Function Calls.
 */
export function parseTurnToBlocks(turn: ThreadTurn, files: AppFile[] = []): UIBlock[] {
    const blocks: UIBlock[] = [];
    
    // 1. Flatten all parts, but keep track of their origin/role if needed
    // We treat the turn as a linear sequence of events.
    const allParts = turn.contents.flatMap(c => c.parts.map(p => ({ ...p, role: c.role })));
    
    // We'll process text parts linearly, but we need to buffer text to handle the splitting
    let textBuffer = "";
    
    // Helper to flush the text buffer into a Text Block
    const flushText = () => {
        if (textBuffer.trim()) {
            blocks.push({ type: 'text', content: textBuffer });
        }
        textBuffer = "";
    };

    for (let i = 0; i < allParts.length; i++) {
        const part = allParts[i];

        // --- Handle Errors ---
        if (part.error) {
            flushText();
            blocks.push({ type: 'error', content: part.error });
            continue;
        }

        // --- Handle Thinking ---
        if (part.thought) {
            flushText();
            const isLastPart = i === allParts.length - 1;
            blocks.push({ 
                type: 'thinking', 
                content: part.thought, 
                isStreaming: turn.status === 'streaming' && isLastPart 
            });
            continue;
        }

        // --- Handle Tool Calls (Function Calling) ---
        if (part.functionCall) {
            flushText();
            
            const callId = part.functionCall.id;
            let status: 'pending' | 'running' | 'complete' = 'complete';
            let result: string | undefined = undefined;
            
            // Look ahead for the response
            const responsePart = allParts.find(p => p.functionResponse && p.functionResponse.id === callId);
            
            if (responsePart && responsePart.functionResponse) {
                status = 'complete';
                const resp = responsePart.functionResponse.response;
                if (resp.result) result = String(resp.result);
                else if (resp.error) result = `Error: ${resp.error}`;
                else result = JSON.stringify(resp, null, 2);
            } else {
                status = turn.status === 'streaming' ? 'running' : 'pending';
            }

            blocks.push({
                type: 'tool',
                name: part.functionCall.name,
                args: part.functionCall.args,
                status,
                result,
                generatedImages: [] // Attachments are handled separately for generic tools
            });
            continue;
        }

        if (part.functionResponse) {
            continue;
        }

        // --- Handle Grounding Metadata ---
        if (part.groundingMetadata) {
            // Ignore empty grounding metadata to prevent fragmentation of text stream
            if (Object.keys(part.groundingMetadata).length === 0) continue;
            
            flushText();
            blocks.push({ type: 'grounding', metadata: part.groundingMetadata });
            continue;
        }

        // --- Handle Attachments ---
        if (part.fileId) {
            flushText();
            const lastBlock = blocks[blocks.length - 1];
            if (lastBlock && lastBlock.type === 'attachments') {
                lastBlock.fileIds.push(part.fileId);
            } else {
                blocks.push({ type: 'attachments', fileIds: [part.fileId] });
            }
            continue;
        }

        // --- Handle Text (and potential Python Code Blocks inside it) ---
        if (part.text) {
            // Check if this text part is actually a "System Output"
            if (part.text.startsWith(SYSTEM_OUTPUT_PREFIX) || part.text.startsWith('[System]')) {
                 // Logic for handling system output visualization if needed,
                 // but typically it's rendered as text unless consumed by code block below.
            }

            // Append to buffer
            textBuffer += part.text;

            // Now, scan the buffer for completed code blocks
            // Regex for ```python:run ... ``` OR ````python:run ... ```` (3 or 4 backticks)
            const codeBlockRegex = /(`{3,4})python:run([\s\S]*?)\1/g;
            let match;
            let lastIndex = 0;
            
            const segments: UIBlock[] = [];
            let hasMatch = false;

            while ((match = codeBlockRegex.exec(textBuffer)) !== null) {
                hasMatch = true;
                
                // 1. Text before the block
                const textBefore = textBuffer.substring(lastIndex, match.index);
                if (textBefore) segments.push({ type: 'text', content: textBefore });

                // 2. The Code Block (Group 2 capture)
                const codeContent = match[2].trim();
                
                // 3. Look ahead for Result
                let result = undefined;
                let generatedImages: { id: string; name: string; url: string; type: FileType }[] = [];
                let status: 'pending' | 'running' | 'complete' = 'complete';

                if (turn.status === 'streaming' && i === allParts.length - 1) {
                     status = 'running';
                }

                // Look ahead for System Output specifically for this python block
                for (let j = i + 1; j < allParts.length; j++) {
                    const nextPart = allParts[j];
                    if (nextPart.text && nextPart.text.startsWith(SYSTEM_OUTPUT_PREFIX)) {
                        const rawOutput = nextPart.text.replace(SYSTEM_OUTPUT_PREFIX, '').trim();
                        result = rawOutput;
                        
                        const match = rawOutput.match(/\[System\] Generated files: (.*)/);
                        if (match && match[1]) {
                            const fileNames = match[1].split(',').map(s => s.trim());
                            fileNames.forEach(entry => {
                                const nameMatch = entry.match(/^(.*?) \(.*?\)$/);
                                const cleanName = nameMatch ? nameMatch[1] : entry;
                                const file = files.slice().reverse().find(f => f.name === cleanName);
                                if (file) {
                                    generatedImages.push({ 
                                        id: file.id, name: file.name, url: file.url, type: file.type
                                    });
                                }
                            });
                        }
                        
                        status = 'complete';
                        break;
                    }
                }
                
                if (!result && turn.status === 'streaming') status = 'running';

                segments.push({
                    type: 'code',
                    code: codeContent,
                    result,
                    status,
                    generatedImages
                });

                lastIndex = codeBlockRegex.lastIndex;
            }

            if (hasMatch) {
                blocks.push(...segments);
                textBuffer = textBuffer.substring(lastIndex);
            }
            
            // Handle Open Code Blocks (Streaming)
            // Support both 3 and 4 backtick starts
            const openBlockMatch = textBuffer.match(/(`{3,4})python:run([\s\S]*)$/);
            if (openBlockMatch && turn.status === 'streaming') {
                const textBefore = textBuffer.substring(0, openBlockMatch.index!);
                if (textBefore) blocks.push({ type: 'text', content: textBefore });
                
                const codeContent = openBlockMatch[2].trim();
                blocks.push({
                    type: 'code',
                    code: codeContent,
                    status: 'running',
                    result: undefined
                });
                
                textBuffer = "";
            }
        }
    }

    flushText();
    return blocks;
}
