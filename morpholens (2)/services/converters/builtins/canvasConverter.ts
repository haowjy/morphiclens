
import { FileConverter, PreviewResult } from "../types";

export class CanvasConverter implements FileConverter {
    id = 'canvas-converter';
    name = 'Canvas Converter';
    outputMimeType = 'image/png';

    canConvert(mimeType: string, filename: string): boolean {
        // Formats browsers can render but Gemini might not like, or we want normalized
        return [
            'image/bmp',
            'image/svg+xml',
            'image/x-icon', // ico
            'image/vnd.microsoft.icon'
        ].includes(mimeType) || filename.endsWith('.bmp') || filename.endsWith('.svg') || filename.endsWith('.ico');
    }

    async convert(blob: Blob, mimeType: string): Promise<PreviewResult> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }
                ctx.drawImage(img, 0, 0);
                
                canvas.toBlob((newBlob) => {
                    URL.revokeObjectURL(url);
                    if (newBlob) {
                        resolve({
                            blob: newBlob,
                            mimeType: 'image/png',
                            url: URL.createObjectURL(newBlob)
                        });
                    } else {
                        reject(new Error("Canvas toBlob failed"));
                    }
                }, 'image/png');
            };
            
            img.onerror = (e) => {
                URL.revokeObjectURL(url);
                reject(new Error("Failed to load image for canvas conversion"));
            };
            
            img.src = url;
        });
    }
}
