
import React, { useState, useCallback, useEffect } from "react";
import { AppFile, AppActionType } from "../../../types";
import { useDragResize } from "../../../lib/hooks";
import { InspectorPanel } from "./InspectorPanel";
import { useFilePreview } from "../../files/hooks/useFilePreview";
import { Loader2, AlertCircle } from "lucide-react";

interface MediaViewerProps {
    file: AppFile;
    dispatch: React.Dispatch<any>;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ file, dispatch }) => {
    const [isInspectorOpen, setIsInspectorOpen] = useState(true);
    const [inspectorHeight, setInspectorHeight] = useState(320);

    const isVideo = file.type === 'VIDEO';

    const { startResizing, isResizing } = useDragResize(
        useCallback((e) => {
            const newHeight = window.innerHeight - e.clientY;
            if (newHeight > 200 && newHeight < window.innerHeight * 0.8) setInspectorHeight(newHeight);
        }, [])
    );

    // Preview Hook Logic (Handles conversion for AVI/MKV etc)
    const { previewUrl, status: previewStatus, error: previewError, generatePreview } = useFilePreview(file);

    useEffect(() => {
        if (previewStatus === 'idle') {
            generatePreview(file).then(res => {
                if (res) {
                    dispatch({ 
                        type: AppActionType.REPLACE_FILE, 
                        payload: { 
                            ...file, 
                            preview: { 
                                url: res.url, 
                                mimeType: res.mimeType, 
                                generatedAt: Date.now() 
                            } 
                        } 
                    });
                }
            });
        }
    }, [file.id, previewStatus, generatePreview, dispatch, file]);

    const isLoading = previewStatus === 'converting' || previewStatus === 'idle';

    return (
        <div className="relative w-full h-full bg-black overflow-hidden flex flex-col">
            {/* Main Player Area */}
            <div 
                className="flex-1 flex items-center justify-center p-8 transition-all duration-100 relative"
                style={{ paddingBottom: isInspectorOpen ? `${inspectorHeight}px` : '3rem' }}
            >
                {isLoading && (
                    <div className="flex flex-col items-center justify-center text-zinc-400">
                        <Loader2 size={32} className="animate-spin mb-2 text-indigo-500" />
                        <span className="text-sm font-medium">Converting Media...</span>
                    </div>
                )}

                {previewError && (
                    <div className="flex flex-col items-center justify-center text-red-400">
                        <AlertCircle size={32} className="mb-2" />
                        <span className="text-sm font-medium">{previewError}</span>
                    </div>
                )}

                {!isLoading && !previewError && previewUrl && (
                    isVideo ? (
                        <video 
                            src={previewUrl} 
                            controls 
                            className="max-w-full max-h-full rounded shadow-2xl border border-zinc-800"
                        />
                    ) : (
                        <div className="bg-zinc-900 p-12 rounded-2xl border border-zinc-800 shadow-2xl flex flex-col items-center gap-6">
                            <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center shadow-inner">
                                <div className="w-4 h-4 rounded-full bg-indigo-500 animate-pulse" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-zinc-200 font-medium mb-1">{file.name}</h3>
                                <p className="text-zinc-500 text-xs font-mono">Audio Playback</p>
                            </div>
                            <audio src={previewUrl} controls className="w-[300px]" />
                        </div>
                    )
                )}
            </div>

            {/* Inspector */}
            <InspectorPanel 
                file={file} 
                isOpen={isInspectorOpen} 
                height={inspectorHeight} 
                onResizeStart={startResizing} 
                onToggle={() => setIsInspectorOpen(!isInspectorOpen)} 
                dispatch={dispatch} 
            />
        </div>
    );
};
