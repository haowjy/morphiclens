
export type ConversionStatus = 'idle' | 'converting' | 'ready' | 'error';

export interface PreviewResult {
  blob: Blob;
  mimeType: string;
  url: string;  // Object URL for display
}

export interface FileConverter {
  id: string;
  name: string;

  /** Check if this converter supports the given MIME type or filename extension */
  canConvert(mimeType: string, filename: string): boolean;

  /** Target format after conversion */
  outputMimeType: string;

  /** Perform the conversion */
  convert(blob: Blob, mimeType: string, filename?: string): Promise<PreviewResult>;
}
