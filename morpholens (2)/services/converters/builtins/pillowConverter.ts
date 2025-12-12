
import { FileConverter, PreviewResult } from "../types";
import { pyodideService } from "../../pyodideService";

export class PillowConverter implements FileConverter {
    id = 'pillow-converter';
    name = 'Pillow Converter (Python)';
    outputMimeType = 'image/png';

    canConvert(mimeType: string, filename: string): boolean {
        const ext = filename.split('.').pop()?.toLowerCase();
        // Formats Pillow handles well that browsers don't
        return [
            'image/tiff', 
            'image/x-tiff',
            'image/vnd.adobe.photoshop'
        ].includes(mimeType) || 
        ext === 'tif' || 
        ext === 'tiff' || 
        ext === 'psd' ||
        ext === 'tga';
    }

    async convert(blob: Blob, mimeType: string, filename: string = 'temp.dat'): Promise<PreviewResult> {
        await pyodideService.initialize();
        
        // 1. Mount the source blob to a temp path
        // We can't pass blob directly to simple python script without mounting
        const buffer = await blob.arrayBuffer();
        const tempPath = `/.session/__temp_convert_${Date.now()}_${filename}`;
        
        // Write file to Pyodide FS
        // Accessing pyodide instance via service hack or extending service
        // We'll extend pyodideService with a generic writeFile if needed, 
        // but for now we can use the `convertImageToPng` which assumes file is on VFS.
        // Let's manually write it using the global pyodide object if available or add helper to service.
        
        // NOTE: In `pyodideService.ts`, `pyodide` is private. 
        // But `mountFile` uses `AppFile`. We have a Blob here. 
        // Let's create a temporary AppFile-like object to use `mountFile` logic if we can,
        // OR rely on `pyodideService` exposing a helper.
        // `pyodideService` has `pyodide` private but we can add a method or use a hack.
        // Actually `pyodideService` is a singleton instance. 
        
        // Better approach: Update `pyodideService` to allow writing raw bytes?
        // For now, we assume `pyodideService` is loaded globally on window by the service loader or we use a helper.
        
        // Let's use `pyodideService.convertImageToPng` but we need the file in VFS.
        // We can simulate an AppFile for `mountFile`.
        
        const tempFile = {
            id: 'temp',
            name: filename,
            url: URL.createObjectURL(blob),
            type: 'IMAGE' as any,
            category: 'session' as any,
            virtualPath: tempPath
        };
        
        try {
            await pyodideService.mountFile(tempFile as any);
            const pngBlob = await pyodideService.convertImageToPng(tempPath);
            
            // Clean up?
            // window.pyodide.FS.unlink(tempPath) // if exposed
            
            return {
                blob: pngBlob,
                mimeType: 'image/png',
                url: URL.createObjectURL(pngBlob)
            };
        } catch (e) {
            console.error("Pillow conversion failed", e);
            throw e;
        } finally {
            URL.revokeObjectURL(tempFile.url);
        }
    }
}
