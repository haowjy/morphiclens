
import { AppFile } from '../types';

/**
 * Determines if a file is safe/suitable for client-side text extraction.
 */
export function isTextExtractable(file: AppFile): boolean {
    const name = file.name.toLowerCase();
    const type = file.mimeType || '';

    if (name.endsWith('.pdf')) return false; // Handled by Gemini API natively
    
    // Note: .docx is NOT extractable here. The Agent should use Python (python-docx) to read it.
    
    // Code / Data
    if (name.endsWith('.json') || name.endsWith('.csv') || name.endsWith('.xml')) return true;
    if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.py')) return true;
    if (name.endsWith('.md') || name.endsWith('.txt')) return true;

    if (type.startsWith('text/')) return true;
    
    return false;
}

/**
 * Extracts raw text content from an AppFile blob.
 */
export async function extractTextFromFile(file: AppFile): Promise<string> {
    try {
        let blob: Blob;
        
        // Fetch if it's a URL (blob url or remote)
        if (file.url) {
            const res = await fetch(file.url);
            blob = await res.blob();
        } else {
            throw new Error("File has no URL");
        }

        return await extractPlainText(blob);

    } catch (e) {
        console.error(`[FileParser] Failed to extract text from ${file.name}`, e);
        return `[System Error: Could not read file content for ${file.name}]`;
    }
}

async function extractPlainText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || "");
        reader.onerror = (e) => reject(e);
        reader.readAsText(blob);
    });
}
