
import { GoogleGenAI } from "@google/genai";
import { AppFile, ThreadPart, ThreadContent, ChatMode, FileType, Annotation } from "../../types";
import { ai } from "./client";
import { ensureFileUploaded, isUploadable } from "./fileManager";
import { isTextExtractable, extractTextFromFile } from "../fileParsers";
import { pyodideService } from "../pyodideService";
import { TOOL_DECLARATIONS } from "../../features/chat/tools/registry";
import { Role } from "../roles/types";
import { BASE_SYSTEM_PROMPT } from "../../services/roles/builtins";

const DEFAULT_MODEL = 'gemini-2.5-flash'; 

export async function* streamMessageToGemini(
  history: ThreadContent[], 
  newMessage: string | { toolResponse: any, additionalParts?: ThreadPart[] },
  allFiles: AppFile[] = [],
  contextFiles: AppFile[] = [],
  role: Role,
  signal?: AbortSignal,
  onFileStatusUpdate?: (id: string, metadata: any) => void,
  modelId: string = DEFAULT_MODEL 
): AsyncGenerator<ThreadPart[], void, unknown> {
    
  if (!ai) {
    yield [{ text: "API Key not configured." }];
    return;
  }

  console.log(`[Gemini] Starting stream. Model: ${modelId}`);

  try {
    const rolePrompt = role.systemPrompt || "";
    // Enforce transition from thought to text
    const systemInstruction = `${BASE_SYSTEM_PROMPT}\n\n${rolePrompt}\n\nIMPORTANT: If you use the thinking process, you MUST provide a final textual response to the user after your thoughts. Do not stop at the thinking block.`;
    const thinkingBudget = Math.floor(role.manifest.thinkingBudget || 8192);

    const activeTools = TOOL_DECLARATIONS.filter(t => t.name !== 'run_python');
    
    // Construct Tools Configuration
    const toolsConfig: any[] = [];
    
    // 1. Add Function Declarations
    if (activeTools.length > 0) {
        toolsConfig.push({ functionDeclarations: activeTools });
    }
    
    // 2. Add Google Search Grounding
    // Enabled for all supported chat models
    toolsConfig.push({ googleSearch: {} });

    const validHistory: any[] = [];
    
    const processFileForContext = async (fileId: string): Promise<any[]> => {
        const file = allFiles.find(f => f.id === fileId);
        if (!file) return [];
        
        const parts: any[] = [];
        const locationHint = file.virtualPath ? `(Path: ${file.virtualPath})` : ``;

        // 1. Prioritize TIF/Image conversion if a preview exists or it's a TIF
        if (file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff')) {
             try {
                 let uri = file.providerMetadata?.google?.uri;
                 let mimeType = file.providerMetadata?.google?.mimeType;

                 if (!uri || mimeType !== 'image/png') {
                     if (file.preview?.url) {
                         const tempFile: AppFile = { ...file, id: `${file.id}_prev`, type: FileType.IMAGE, url: file.preview.url, mimeType: 'image/png' };
                         const upload = await ensureFileUploaded(tempFile, onFileStatusUpdate);
                         if (upload) {
                             uri = upload.uri;
                             mimeType = upload.mimeType;
                         }
                     } else {
                         await pyodideService.initialize();
                         const blob = await pyodideService.convertImageToPng(file.virtualPath || `/${file.name}`);
                         const url = URL.createObjectURL(blob);
                         const temp: AppFile = { ...file, url, mimeType: 'image/png', name: file.name + '.png' };
                         const upload = await ensureFileUploaded(temp, onFileStatusUpdate);
                         if (upload) {
                             uri = upload.uri;
                             mimeType = upload.mimeType;
                         }
                     }
                 }

                 if (uri && mimeType) {
                     parts.push({ fileData: { fileUri: uri, mimeType: mimeType } });
                 }
             } catch(e) {
                 console.warn("Failed to attach TIF as PNG", e);
             }
        }
        else if (file.preview?.url && file.type === FileType.IMAGE) {
             const tempFile: AppFile = { ...file, id: `${file.id}_prev`, type: FileType.IMAGE, url: file.preview.url, mimeType: file.preview.mimeType };
             const upload = await ensureFileUploaded(tempFile, onFileStatusUpdate);
             if (upload) {
                 parts.push({ fileData: { fileUri: upload.uri, mimeType: upload.mimeType } });
             }
        }
        else if (isUploadable(file)) {
            const upload = await ensureFileUploaded(file, onFileStatusUpdate);
            if (upload) {
                parts.push({ fileData: { fileUri: upload.uri, mimeType: upload.mimeType } });
            }
        }
        else if (isTextExtractable(file)) {
             try {
                 const txt = await extractTextFromFile(file);
                 parts.push({ text: `[FILE: ${file.name}] ${locationHint}\n${txt}` });
             } catch (e) {}
        }
        
        if (parts.length === 0) {
            parts.push({ text: `[Attachment: ${file.name}] ${locationHint}` });
        }

        if (file.type === FileType.IMAGE && file.analysis?.layers) {
            const visibleLayers = file.analysis.layers.filter(l => 
                l.type === 'VECTOR' && 
                l.style.visible && 
                Array.isArray(l.source) && 
                l.source.length > 0
            );

            if (visibleLayers.length > 0) {
                let annotText = `[User Annotations on ${file.name}]:\n`;
                visibleLayers.forEach(layer => {
                    annotText += `Layer: ${layer.name}\n`;
                    (layer.source as Annotation[]).forEach(a => {
                        const label = a.label ? `"${a.label}"` : 'Unlabeled';
                        const geoSummary = Array.isArray(a.geometry[0]) 
                            ? `${(a.geometry as any[]).length} points` 
                            : `[${(a.geometry as number[]).map((n: number) => n.toFixed(3)).join(', ')}]`;
                        annotText += `- ${a.type.toUpperCase()} (${label}): ${geoSummary}\n`;
                    });
                });
                parts.push({ text: annotText });
            }
        }

        return parts;
    };

    for (const item of history) {
        const parts: any[] = [];
        
        // NOTE: We do NOT send 'thought' parts back to the API in the history.
        // The API treats thoughts as internal/ephemeral and will reject them in history
        // with INVALID_ARGUMENT unless accompanied by a valid signature, which is safer to omit.
        
        for (const p of item.parts) {
            if (p.text) parts.push({ text: p.text });
            if (p.fileId) {
                 const f = allFiles.find(x => x.id === p.fileId);
                 if (f) parts.push({ text: `[Attachment: ${f.name}]` });
            }
            if (p.functionCall) {
                parts.push({ functionCall: p.functionCall });
            }
            if (p.functionResponse) {
                parts.push({ functionResponse: p.functionResponse });
            }
        }
        
        const role = item.role;
        
        if (role === 'tool') {
            const toolParts = parts.filter(p => p.functionResponse);
            if (toolParts.length > 0) {
                // Explicitly use 'tool' role for function responses
                validHistory.push({ role: 'tool', parts: toolParts });
            }
        } else {
            validHistory.push({ role, parts });
        }
    }

    const currentParts: any[] = [];
    if (typeof newMessage === 'string') {
        currentParts.push({ text: newMessage });
        for (const f of contextFiles) {
            const parts = await processFileForContext(f.id);
            currentParts.push(...parts);
        }
    } else if (newMessage.toolResponse) {
         if (newMessage.toolResponse.id && newMessage.toolResponse.response) {
            currentParts.push({ functionResponse: newMessage.toolResponse });
         } else {
            currentParts.push({ text: newMessage.toolResponse.result }); 
         }
    }

    // Thinking Configuration
    const isThinkingCapable = modelId.includes('gemini-2.5') || modelId.includes('gemini-3') || modelId.includes('flash-lite');
    const maxBudget = modelId.includes('pro') ? 32768 : 24576;
    const effectiveBudget = Math.min(thinkingBudget, maxBudget);

    if (isThinkingCapable) {
        console.log(`[Gemini] Thinking Budget Configured: ${effectiveBudget} tokens`);
    }

    const chat = ai.chats.create({
        model: modelId,
        history: validHistory,
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.2, 
            maxOutputTokens: 65536,
            safetySettings: [
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
            thinkingConfig: isThinkingCapable ? { 
                thinkingBudget: effectiveBudget,
                includeThoughts: true 
            } : undefined,
            tools: toolsConfig.length > 0 ? toolsConfig : undefined
        }
    });

    const result = await chat.sendMessageStream({ message: currentParts });

    const accumulatedParts: ThreadPart[] = [];
    for await (const chunk of result) {
        if (signal?.aborted) {
            console.log("[Gemini] Stream aborted by user");
            break;
        }
        
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        const grounding = chunk.candidates?.[0]?.groundingMetadata;
        
        // Fix: Only add grounding metadata if it actually has content.
        if (grounding && Object.keys(grounding).length > 0) {
             // Check if specifically searchEntryPoint is the only thing (often just generic info)
             const hasRealData = grounding.groundingChunks?.length || grounding.groundingSupports?.length || grounding.webSearchQueries?.length;
             
             if (hasRealData) {
                 const last = accumulatedParts[accumulatedParts.length - 1];
                 // Avoid duplicate consecutive grounding blocks
                 if (!last || JSON.stringify(last.groundingMetadata) !== JSON.stringify(grounding)) {
                     accumulatedParts.push({ groundingMetadata: grounding });
                 }
             }
        }

        for (const p of parts) {
            const partObj = p as any;

            // Handle Thought
            let thoughtContent: string | null = null;
            
            // Explicit checks for various API structures
            if (typeof partObj.thought === 'string') {
                thoughtContent = partObj.thought;
            } else if (partObj.thought === true && partObj.text) {
                // Some versions send { text: "thinking...", thought: true }
                thoughtContent = partObj.text;
            } else if (typeof partObj.thinking === 'string') {
                // Fallback for potential field name variation
                thoughtContent = partObj.thinking;
            }

            if (thoughtContent !== null) {
                 // Log thought progress (sampled)
                 if (Math.random() > 0.8) console.log(`[Gemini] Thinking... (${thoughtContent.length} chars)`);

                 const last = accumulatedParts[accumulatedParts.length - 1];
                 if (last && last.thought !== undefined) {
                     last.thought += thoughtContent;
                 } else {
                     accumulatedParts.push({ thought: thoughtContent });
                 }
                 
                 // CRITICAL: If identified as thought, do NOT process as text below
                 continue;
            }

            // Handle Text
            if (partObj.text) {
                 console.log(`[Gemini] Text: ${partObj.text.substring(0, 30)}...`);
                 const last = accumulatedParts[accumulatedParts.length - 1];
                 if (last && last.text !== undefined) {
                     last.text += partObj.text;
                 } else {
                     accumulatedParts.push({ text: partObj.text });
                 }
            }

            // Handle Function Calls
            if (partObj.functionCall) {
                 console.log(`[Gemini] Tool Call: ${partObj.functionCall.name}`);
                 const existing = accumulatedParts.find(ap => ap.functionCall?.id === partObj.functionCall.id);
                 if (!existing) {
                     accumulatedParts.push({ 
                         functionCall: {
                             name: partObj.functionCall.name,
                             args: partObj.functionCall.args,
                             id: partObj.functionCall.id || `call_${Date.now()}`
                         }
                     });
                 }
            }
        }
        
        yield [...accumulatedParts];
    }
    console.log("[Gemini] Stream completed successfully");
  } catch (e) {
      console.error("[Gemini] Stream Error", e);
      yield [{ text: `[System Error: ${String(e)}]` }];
  }
}
