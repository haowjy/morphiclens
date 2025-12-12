
import { FileConverter, PreviewResult } from "../types";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export class FFmpegConverter implements FileConverter {
    id = 'ffmpeg-converter';
    name = 'FFmpeg Converter';
    outputMimeType = 'video/mp4'; 

    private ffmpeg: FFmpeg | null = null;
    private loadingPromise: Promise<void> | null = null;

    canConvert(mimeType: string, filename: string): boolean {
        const ext = filename.split('.').pop()?.toLowerCase();
        // Animated GIF -> MP4
        if (mimeType === 'image/gif' || ext === 'gif') return true;
        // Unsupported Video
        if (['video/x-matroska', 'video/avi', 'video/quicktime'].includes(mimeType) || ['mkv', 'avi', 'mov'].includes(ext || '')) return true;
        // Unsupported Audio
        if (['audio/ogg', 'audio/x-m4a', 'audio/amr'].includes(mimeType) || ['ogg', 'm4a', 'amr'].includes(ext || '')) return true;
        
        return false;
    }

    async load() {
        if (this.ffmpeg) return;
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = (async () => {
            const ffmpeg = new FFmpeg();
            ffmpeg.on('log', ({ message }) => console.log('[FFmpeg]', message));
            
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
            const ffmpegBaseURL = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm';

            try {
                // Create a worker Blob that imports the remote worker script.
                // This bypasses the browser's cross-origin worker restriction while allowing relative imports inside the remote script to work.
                const workerBlob = new Blob(
                    [`import "${ffmpegBaseURL}/worker.js";`],
                    { type: 'text/javascript' }
                );
                const workerURL = URL.createObjectURL(workerBlob);

                await ffmpeg.load({
                    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                    workerURL: workerURL
                });
                
                this.ffmpeg = ffmpeg;
            } catch (e) {
                console.error("FFmpeg Load Error:", e);
                this.loadingPromise = null;
                throw e;
            }
        })();
        return this.loadingPromise;
    }

    async convert(blob: Blob, mimeType: string, filename: string = 'input'): Promise<PreviewResult> {
        await this.load();
        if (!this.ffmpeg) throw new Error("FFmpeg failed to load");

        const ext = filename.split('.').pop() || 'dat';
        const inputFile = `input.${ext}`;
        const isAudio = mimeType.startsWith('audio/');
        const outputFile = isAudio ? 'output.mp3' : 'output.mp4';
        const outMime = isAudio ? 'audio/mpeg' : 'video/mp4';

        await this.ffmpeg.writeFile(inputFile, await fetchFile(blob));

        // Basic conversion args
        let args = ['-i', inputFile, outputFile];
        
        // Special case for GIF to MP4 (needs pixel format)
        if (mimeType === 'image/gif' || ext === 'gif') {
            args = ['-i', inputFile, '-movflags', 'faststart', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', outputFile];
        }

        await this.ffmpeg.exec(args);

        const data = await this.ffmpeg.readFile(outputFile);
        const outBlob = new Blob([data], { type: outMime });

        return {
            blob: outBlob,
            mimeType: outMime,
            url: URL.createObjectURL(outBlob)
        };
    }
}
