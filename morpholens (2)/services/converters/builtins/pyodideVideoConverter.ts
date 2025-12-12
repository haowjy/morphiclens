
import { FileConverter, PreviewResult } from "../types";
import { pyodideService } from "../../pyodideService";

export class PyodideVideoConverter implements FileConverter {
    id = 'pyodide-video-converter';
    name = 'Pyodide Video Converter (OpenCV)';
    outputMimeType = 'image/gif';

    canConvert(mimeType: string, filename: string): boolean {
        const ext = filename.split('.').pop()?.toLowerCase();
        // Support common formats. 
        // OpenCV (built with ffmpeg) can often read these containers in Pyodide.
        return [
            'video/x-matroska', 
            'video/avi', 
            'video/quicktime',
            'video/x-msvideo'
        ].includes(mimeType) || 
        ['mkv', 'avi', 'mov'].includes(ext || '');
    }

    async convert(blob: Blob, mimeType: string, filename: string = 'video.avi'): Promise<PreviewResult> {
        await pyodideService.initialize();
        
        // Generate a unique temp path
        const tempPath = `/.session/__temp_vid_${Date.now()}_${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        
        // Mount the blob to VFS manually since we don't have an AppFile here
        const dummyFile = {
            id: 'temp-vid',
            name: filename,
            type: 'VIDEO',
            category: 'session',
            virtualPath: tempPath,
            url: URL.createObjectURL(blob)
        };
        
        // Use the existing mount mechanism
        await pyodideService.mountFile(dummyFile as any);
        
        try {
            // Perform conversion in Python
            const gifBlob = await pyodideService.convertVideoToGif(tempPath);
            
            // Clean up VFS if possible (optional)
            // window.pyodide.FS.unlink(tempPath)

            return {
                blob: gifBlob,
                mimeType: 'image/gif',
                url: URL.createObjectURL(gifBlob)
            };
        } catch (e) {
            console.error("Pyodide Video Conversion failed", e);
            throw new Error("Video conversion failed. Ensure OpenCV is loaded.");
        } finally {
            URL.revokeObjectURL(dummyFile.url);
        }
    }
}
