
import { ai } from "./client";
import { AppFile, FileType } from "../../types";
import { needsConversion, getConverter } from "../converters/registry";

const FILE_EXPIRATION_MS = 46 * 60 * 60 * 1000; // ~46h to be safe

export function getMimeType(file: AppFile): string {
    if (file.mimeType) return file.mimeType;
    const name = file.name.toLowerCase();
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.pdf')) return 'application/pdf';
    return 'application/octet-stream';
}

/**
 * Uploads a file to Gemini File API and returns the URI.
 * Handles format conversion automatically if needed.
 */
export async function ensureFileUploaded(
    file: AppFile,
    onUploadSuccess?: (id: string, metadata: any) => void
): Promise<{ uri: string; mimeType: string } | null> {
    if (!ai) return null;

    // 1. Check existing URI in provider metadata
    const googleMeta = file.providerMetadata?.google;
    if (googleMeta) {
        const now = Date.now();
        // Reuse if not expired
        if ((now - googleMeta.uploadTimestamp) < FILE_EXPIRATION_MS) {
            return { uri: googleMeta.uri, mimeType: googleMeta.mimeType };
        }
        console.log(`[FileManager] Expired URI for ${file.name}. Re-uploading.`);
    }

    try {
        let blobToUpload: Blob;
        let mimeTypeToUpload = getMimeType(file);

        // 2. Check for Conversion
        if (file.preview) {
             console.log(`[FileManager] Using existing preview for ${file.name}`);
             const res = await fetch(file.preview.url);
             blobToUpload = await res.blob();
             mimeTypeToUpload = file.preview.mimeType;
        } 
        else if (needsConversion(mimeTypeToUpload, file.name)) {
             console.log(`[FileManager] Converting ${file.name} before upload...`);
             const converter = getConverter(mimeTypeToUpload, file.name);
             if (converter) {
                 const res = await fetch(file.url);
                 const originalBlob = await res.blob();
                 const result = await converter.convert(originalBlob, mimeTypeToUpload, file.name);
                 blobToUpload = result.blob;
                 mimeTypeToUpload = result.mimeType;
             } else {
                 // Fallback: try uploading original and hope for best?
                 const res = await fetch(file.url);
                 blobToUpload = await res.blob();
             }
        } else {
            const res = await fetch(file.url);
            blobToUpload = await res.blob();
        }

        console.log(`[FileManager] Uploading ${file.name} (${mimeTypeToUpload}) to File API...`);

        // Upload to Gemini
        const uploadResult = await ai.files.upload({
            file: blobToUpload,
            config: { mimeType: mimeTypeToUpload }
        });
        
        const uri = uploadResult.uri;
        console.log(`[FileManager] Upload complete: ${uri}`);

        // Update state via callback
        if (onUploadSuccess) {
            onUploadSuccess(file.id, {
                google: {
                    uri,
                    mimeType: mimeTypeToUpload,
                    uploadTimestamp: Date.now()
                }
            });
        }
        
        return { uri, mimeType: mimeTypeToUpload };

    } catch (e) {
        console.error(`[FileManager] Failed to upload ${file.name}`, e);
        return null;
    }
}
// Deprecated: IsUploadable is now handled by needsConversion logic implicitly
// We keep it for legacy compat if needed, but ensureFileUploaded is the main entry.
export function isUploadable(file: AppFile): boolean {
    return true; // We try to upload everything now via conversion
}
