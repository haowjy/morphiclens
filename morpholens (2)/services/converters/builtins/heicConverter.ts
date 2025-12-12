
import { FileConverter, PreviewResult } from "../types";
// @ts-ignore
import heic2any from "heic2any";

export class HeicConverter implements FileConverter {
    id = 'heic-converter';
    name = 'HEIC Converter';
    outputMimeType = 'image/png';

    canConvert(mimeType: string, filename: string): boolean {
        return mimeType === 'image/heic' || 
               mimeType === 'image/heif' || 
               filename.toLowerCase().endsWith('.heic') || 
               filename.toLowerCase().endsWith('.heif');
    }

    async convert(blob: Blob, mimeType: string): Promise<PreviewResult> {
        try {
            const resultBlob = await heic2any({
                blob,
                toType: "image/png",
                quality: 0.8
            });

            // resultBlob can be Blob or Blob[]
            const finalBlob = Array.isArray(resultBlob) ? resultBlob[0] : resultBlob;

            return {
                blob: finalBlob,
                mimeType: 'image/png',
                url: URL.createObjectURL(finalBlob)
            };
        } catch (e) {
            console.error("HEIC conversion failed", e);
            throw new Error("HEIC conversion failed");
        }
    }
}
