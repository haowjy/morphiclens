
import { Type } from "@google/genai";
import { AgentTool, ToolContext, ToolResult, GeneratedImage } from "./types";
import { ai } from "../../../services/gemini/client";
import { db } from "../../../lib/db";

export const imageGenTool: AgentTool = {
    name: "generate_image",
    declaration: {
        name: "generate_image",
        description: "Generates an image from a text prompt. Call this tool when the user asks to create, generate, or draw a visual image.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                prompt: { 
                    type: Type.STRING, 
                    description: "Detailed description of the image to generate." 
                },
                reference_file_path: { 
                    type: Type.STRING, 
                    description: "Optional. The exact name or path of a file in the workspace to use as reference (e.g., 'sketch.png')." 
                }
            },
            required: ["prompt"]
        }
    },
    execute: async (args: { prompt: string, reference_file_path?: string }, context: ToolContext): Promise<ToolResult> => {
        if (!ai) return { result: "Error: AI not initialized" };

        try {
            // Determine model from thread config or default
            let modelId = 'gemini-2.5-flash-image';
            if (context.activeThreadId) {
                const thread = await db.threads.get(context.activeThreadId);
                if (thread?.config?.imageModel) {
                    modelId = thread.config.imageModel;
                }
            }

            const parts: any[] = [];
            
            // Handle Reference Image by Name/Path
            if (args.reference_file_path) {
                const query = args.reference_file_path.trim();
                // Try to resolve the file by Name, VirtualPath, or ID
                const refFile = context.files.find(f => 
                    f.name === query || 
                    f.virtualPath === query || 
                    (f.virtualPath && f.virtualPath.endsWith(`/${query}`)) ||
                    f.id === query
                );

                if (refFile) {
                    // Fetch blob
                    const response = await fetch(refFile.preview?.url || refFile.url);
                    const blob = await response.blob();
                    
                    // Convert to Base64
                    const reader = new FileReader();
                    const base64 = await new Promise<string>((resolve) => {
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                    const base64Data = base64.split(',')[1];
                    
                    parts.push({
                        inlineData: {
                            mimeType: refFile.preview?.mimeType || refFile.mimeType || 'image/png',
                            data: base64Data
                        }
                    });
                } else {
                    return { result: `Error: Reference file '${query}' not found in the workspace.` };
                }
            }
            
            parts.push({ text: args.prompt });

            const result = await ai.models.generateContent({
                model: modelId,
                contents: { parts }
            });

            const generatedImages: GeneratedImage[] = [];
            const candidates = result.candidates || [];
            
            for (const candidate of candidates) {
                const contentParts = candidate.content?.parts || [];
                for (const part of contentParts) {
                    if (part.inlineData) {
                        const binaryString = atob(part.inlineData.data);
                        const len = binaryString.length;
                        const bytes = new Uint8Array(len);
                        for (let i = 0; i < len; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        const blob = new Blob([bytes], { type: part.inlineData.mimeType });
                        
                        generatedImages.push({
                            name: `gen_${Date.now()}_${Math.floor(Math.random()*1000)}.png`,
                            blob: blob,
                            category: 'session',
                            virtualPath: `/.session/gen_${Date.now()}.png`
                        });
                    }
                }
            }

            if (generatedImages.length === 0) {
                 return { result: "No images generated." };
            }

            return {
                result: `Successfully generated ${generatedImages.length} image(s).`,
                images: generatedImages
            };

        } catch (e: any) {
            return { result: `Error generating image: ${e.message}`, error: e.message };
        }
    }
};
