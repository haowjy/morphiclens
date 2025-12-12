
import { FileConverter } from "./types";
import { CanvasConverter } from "./builtins/canvasConverter";
import { PillowConverter } from "./builtins/pillowConverter";
import { HeicConverter } from "./builtins/heicConverter";
import { FFmpegConverter } from "./builtins/ffmpegConverter";

const CONVERTER_REGISTRY: FileConverter[] = [
    new CanvasConverter(),
    new PillowConverter(),
    new HeicConverter(),
    new FFmpegConverter()
];

// Gemini supported native formats that DON'T need conversion
const GEMINI_SUPPORTED = new Set([
    'image/png', 'image/jpeg', 'image/webp', 
    'application/pdf', 'text/plain', 'text/csv', 'text/html', 'text/markdown',
    'video/mp4', 'audio/mpeg', 'audio/wav', 'audio/aac'
]);

export const getConverter = (mimeType: string, filename: string): FileConverter | null => {
    return CONVERTER_REGISTRY.find(c => c.canConvert(mimeType, filename)) || null;
};

export const needsConversion = (mimeType: string, filename: string): boolean => {
    if (GEMINI_SUPPORTED.has(mimeType)) return false;
    return !!getConverter(mimeType, filename);
};
