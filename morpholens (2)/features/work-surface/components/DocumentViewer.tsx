
import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppFile } from "../../../types";
import { ZoomPanWrapper } from "./ZoomPanWrapper";
import { Loader2, AlertCircle } from "lucide-react";
import { extractTextFromFile } from "../../../services/fileParsers";

// Dynamic imports
// @ts-ignore
import mammoth from "mammoth";
// @ts-ignore
import * as _pdfjsLib from "pdfjs-dist";

// Handle ESM default export vs Named exports difference across environments/CDNs
const pdfjsLib = (_pdfjsLib as any).default || _pdfjsLib;

// Initialize PDF Worker
// We configure this outside the component to ensure it's set before any PDF loads.
// Using unpkg for the worker ensures proper CORS headers are present for the Blob worker to function.
if (typeof window !== 'undefined') {
  if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }
}

interface DocumentViewerProps {
  file: AppFile;
}

const PdfPageRenderer: React.FC<{ pdf: any; pageNumber: number }> = ({ pdf, pageNumber }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = useState<'loading' | 'rendered' | 'error'>('loading');

    useEffect(() => {
        let active = true;
        
        const render = async () => {
            if (!pdf || !canvasRef.current) return;
            try {
                const page = await pdf.getPage(pageNumber);
                if (!active) return;

                const viewport = page.getViewport({ scale: 2.0 }); // Render at 2x for sharpness
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                // Set CSS dimensions to match 1x scale for display
                canvas.style.width = `${viewport.width / 2}px`;
                canvas.style.height = `${viewport.height / 2}px`;

                const renderContext = {
                    canvasContext: context!,
                    viewport: viewport,
                };
                
                await page.render(renderContext).promise;
                if (active) setStatus('rendered');
            } catch (error) {
                console.error(`Error rendering page ${pageNumber}:`, error);
                if (active) setStatus('error');
            }
        };

        render();
        return () => { active = false; };
    }, [pdf, pageNumber]);

    return (
        <div className="relative bg-white shadow-md mb-8 last:mb-0 transition-opacity duration-300">
            <canvas ref={canvasRef} className="block" />
            {status === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                    <Loader2 className="animate-spin text-zinc-400" />
                </div>
            )}
            {status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-400">
                    <AlertCircle size={24} />
                </div>
            )}
        </div>
    );
};

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ file }) => {
  const [content, setContent] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPdf = file.mimeType === 'application/pdf' || file.name.endsWith('.pdf');
  const isDocx = file.name.endsWith('.docx');
  const isMarkdown = file.name.endsWith('.md') || file.type === 'NOTE';

  useEffect(() => {
    let active = true;

    const load = async () => {
        setIsLoading(true);
        setError(null);
        setPdfDoc(null);

        try {
            if (isPdf) {
                // Double check worker is set before loading
                if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                     pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
                }
                
                const loadingTask = pdfjsLib.getDocument(file.url);
                const doc = await loadingTask.promise;
                if (active) {
                    setPdfDoc(doc);
                    setIsLoading(false);
                }
            } else if (isDocx) {
                // Convert DOCX to HTML
                const response = await fetch(file.url);
                const arrayBuffer = await response.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer });
                if (active) setHtmlContent(result.value);
                setIsLoading(false);
            } else {
                // Extract Text/Markdown
                const text = await extractTextFromFile(file);
                if (active) setContent(text);
                setIsLoading(false);
            }
        } catch (e) {
            console.error(e);
            if (active) {
                setError("Failed to load document content.");
                setIsLoading(false);
            }
        }
    };

    load();

    return () => { active = false; };
  }, [file.id, file.url, isDocx, isPdf]);

  // PDF Viewer (Canvas-based)
  if (isPdf && pdfDoc) {
      return (
        <ZoomPanWrapper className="bg-zinc-100">
             <div className="flex flex-col items-center py-10 min-h-full">
                 {Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1).map((pageNum) => (
                     <PdfPageRenderer key={pageNum} pdf={pdfDoc} pageNumber={pageNum} />
                 ))}
             </div>
        </ZoomPanWrapper>
      );
  }

  // Loading state for PDF specifically (handled inside component for others)
  if (isPdf && isLoading) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-zinc-100">
            <Loader2 className="animate-spin text-zinc-400 mb-2" />
            <span className="text-zinc-500 ml-2">Loading PDF...</span>
        </div>
      );
  }

  return (
    <ZoomPanWrapper>
        <div className="w-full h-full overflow-y-auto flex justify-center p-8 bg-zinc-100/50 min-h-full"> 
            {/* Paper Card */}
            <div className="w-full max-w-[850px] bg-white text-zinc-900 shadow-md border border-zinc-200 rounded-sm min-h-[1100px] p-[100px] origin-top">
                
                {isLoading && (
                    <div className="flex items-center justify-center py-20 text-zinc-400">
                        <Loader2 className="animate-spin mr-2" />
                        <span>Processing document...</span>
                    </div>
                )}

                {error && (
                    <div className="text-red-500 p-4 border border-red-100 bg-red-50 rounded">
                        {error}
                    </div>
                )}

                {!isLoading && !error && (
                    <>
                        {/* Header only for non-docx/non-md raw text files to give context */}
                        {!isDocx && !isMarkdown && (
                            <div className="mb-8 pb-4 border-b border-zinc-100">
                                <h1 className="text-2xl font-bold text-zinc-900">{file.name}</h1>
                                <p className="text-xs text-zinc-400 font-mono mt-1">{file.mimeType || 'Plain Text'}</p>
                            </div>
                        )}

                        {/* Content Rendering */}
                        <div className="prose prose-zinc max-w-none prose-headings:font-bold prose-p:leading-7 prose-li:my-0.5">
                            {isDocx && htmlContent ? (
                                <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                            ) : isMarkdown && content ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {content}
                                </ReactMarkdown>
                            ) : (
                                <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-700 bg-zinc-50 p-4 rounded border border-zinc-100">
                                    {content}
                                </pre>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    </ZoomPanWrapper>
  );
};
