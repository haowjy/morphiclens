
import { useState, useEffect, useCallback } from 'react';
import { AppFile } from '../../../types';
import { getConverter, needsConversion } from '../../../services/converters/registry';
import { PreviewResult } from '../../../services/converters/types';

interface UseFilePreviewResult {
    previewUrl: string | null;
    previewMimeType: string | null;
    status: 'idle' | 'converting' | 'ready' | 'error';
    error: string | null;
    generatePreview: (file: AppFile) => Promise<PreviewResult | null>;
}

export function useFilePreview(file?: AppFile): UseFilePreviewResult {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'converting' | 'ready' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);

    // Initial load from file if available
    useEffect(() => {
        if (!file) return;
        if (file.preview) {
            setPreviewUrl(file.preview.url);
            setPreviewMimeType(file.preview.mimeType);
            setStatus('ready');
        } else if (!needsConversion(file.mimeType || '', file.name)) {
            setPreviewUrl(file.url);
            setPreviewMimeType(file.mimeType || 'application/octet-stream');
            setStatus('ready');
        } else {
            // Needs conversion but no preview yet
            setStatus('idle');
        }
    }, [file]);

    const generatePreview = useCallback(async (targetFile: AppFile) => {
        // If already has preview, return it
        if (targetFile.preview) {
            return {
                blob: new Blob(), // We don't have blob here easily, but URL is what matters
                url: targetFile.preview.url,
                mimeType: targetFile.preview.mimeType
            };
        }
        
        if (!needsConversion(targetFile.mimeType || '', targetFile.name)) {
             return {
                 blob: new Blob(), // Placeholder
                 url: targetFile.url,
                 mimeType: targetFile.mimeType || ''
             };
        }

        const converter = getConverter(targetFile.mimeType || '', targetFile.name);
        if (!converter) {
            setError("No suitable converter found");
            setStatus('error');
            return null;
        }

        try {
            setStatus('converting');
            let blob: Blob;
            if (targetFile.url) {
                const res = await fetch(targetFile.url);
                blob = await res.blob();
            } else {
                throw new Error("File has no URL");
            }

            const result = await converter.convert(blob, targetFile.mimeType || '', targetFile.name);
            
            setPreviewUrl(result.url);
            setPreviewMimeType(result.mimeType);
            setStatus('ready');
            return result;
        } catch (e) {
            console.error("Preview generation failed", e);
            setError(e instanceof Error ? e.message : "Conversion failed");
            setStatus('error');
            return null;
        }
    }, []);

    // Auto-trigger if file provided and needs conversion?
    // Better to let component trigger it to control side effects
    
    return { previewUrl, previewMimeType, status, error, generatePreview };
}
