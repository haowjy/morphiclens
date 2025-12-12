
import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Terminal, CheckCircle2, ImageIcon, Clock, Globe, Search, Copy, Check, BrainCircuit } from 'lucide-react';
import { Streamdown } from './Streamdown';
import { cn } from '../../../lib/utils';
import { AppFile, FileType } from '../../../types';
import { FileIcon } from '../../../components/ui/FileIcon';
import { DragItem, useDraggable } from '../../../lib/dnd';
import { Button } from '../../../components/ui/Button';

// --- Shared Components ---

const CopyButton = ({ text, className }: { text: string, className?: string }) => {
    const [copied, setCopied] = useState(false);
    const onCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button 
            onClick={onCopy} 
            className={cn("p-1.5 hover:bg-zinc-200 rounded text-zinc-400 hover:text-zinc-700 transition-colors", className)}
            title="Copy Content"
        >
            {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
        </button>
    );
};

interface AttachmentBlockProps {
    fileIds: string[];
    allFiles: AppFile[];
    onFileClick?: (file: AppFile) => void;
}

export const AttachmentBlock: React.FC<AttachmentBlockProps> = ({ fileIds, allFiles, onFileClick }) => {
    const files = fileIds.map(id => allFiles.find(f => f.id === id)).filter(Boolean) as AppFile[];
    
    if (files.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 mb-3 mt-1">
            {files.map(file => (
                <DraggableAttachmentChip 
                    key={file.id} 
                    file={file} 
                    onClick={() => onFileClick?.(file)} 
                />
            ))}
        </div>
    );
}

interface DraggableAttachmentChipProps {
    file: AppFile;
    onClick?: () => void;
}

const DraggableAttachmentChip: React.FC<DraggableAttachmentChipProps> = ({ file, onClick }) => {
    const dragItem: DragItem = {
        type: 'FILE',
        id: file.id,
        fileType: file.type,
        origin: 'chat_artifact'
    };
    const { onDragStart, onDragEnd, draggable } = useDraggable(dragItem);

    return (
        <div 
            draggable={draggable}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={onClick}
            className="flex items-center gap-2 bg-white border border-zinc-200 rounded-md p-1.5 pr-3 shadow-sm max-w-[200px] cursor-pointer hover:border-zinc-300 hover:shadow-md transition-all select-none"
        >
            {file.type === FileType.IMAGE ? (
                <div className="h-8 w-8 rounded overflow-hidden bg-zinc-100 border border-zinc-100 flex-shrink-0">
                    <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
                </div>
            ) : (
                <div className="h-8 w-8 rounded bg-zinc-50 flex items-center justify-center flex-shrink-0">
                    <FileIcon type={file.type} size={16} />
                </div>
            )}
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-zinc-900 truncate" title={file.name}>
                    {file.name}
                </p>
                <p className="text-[9px] text-zinc-500 uppercase">
                    {file.type}
                </p>
            </div>
        </div>
    );
};

interface ThinkingBlockProps {
    content: string;
    isStreaming?: boolean;
    collapseOnFinish?: boolean;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ 
    content, 
    isStreaming,
    collapseOnFinish = true 
}) => {
    // Default to open if streaming, or if we have content but no specific finish instruction
    // If collapseOnFinish is false (e.g. no other content), we start open.
    const [isOpen, setIsOpen] = useState(isStreaming || (!!content && !collapseOnFinish));

    useEffect(() => {
        if (isStreaming) {
            setIsOpen(true);
        } else if (!isStreaming && collapseOnFinish) {
            // Auto collapse when done if we have an answer to show
            setIsOpen(false);
        }
    }, [isStreaming, collapseOnFinish]);

    // Don't render empty thinking blocks unless streaming
    if (!content && !isStreaming) return null;

    return (
        <div className="mb-3 w-full max-w-2xl">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 transition-colors py-1.5 px-2 -ml-2 rounded-md w-full text-left group",
                    isOpen ? "bg-zinc-50/50" : "hover:bg-zinc-50"
                )}
            >
                <div className={cn("text-zinc-400 transition-transform duration-200", isOpen && "rotate-90")}>
                    <ChevronRight size={14} />
                </div>
                
                <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider select-none text-zinc-500 group-hover:text-zinc-700">
                    <BrainCircuit size={12} className={cn("transition-colors", isStreaming ? "text-indigo-500 animate-pulse" : "text-zinc-400")} />
                    <span>Thinking Process</span>
                </div>

                {isStreaming && (
                    <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse ml-2" />
                )}
            </button>
            
            {isOpen && (
                <div className="pl-6 pr-4 py-3 border-l-2 border-indigo-100 ml-1.5 my-1 bg-white/50 rounded-r-md">
                    {content ? (
                        <Streamdown className="text-sm prose-p:text-zinc-600 prose-li:text-zinc-600 prose-strong:text-zinc-700 prose-code:text-zinc-500 leading-relaxed font-normal">
                            {content}
                        </Streamdown>
                    ) : (
                        <div className="flex items-center gap-2 text-zinc-400 italic text-sm">
                            <span className="animate-pulse">Thinking...</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

interface ToolBlockProps {
    name: string;
    args: Record<string, any>;
    result?: string;
    generatedImages?: { id: string; name: string; url: string; type: FileType }[];
    isStreaming: boolean;
    onFileClick?: (file: AppFile) => void;
}

export const ToolBlock: React.FC<ToolBlockProps> = ({ name, args, result, generatedImages = [], isStreaming, onFileClick }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [isInputOpen, setIsInputOpen] = useState(true);
    const [isOutputOpen, setIsOutputOpen] = useState(false);

    useEffect(() => {
        if (isStreaming) {
            setIsOpen(true);
            setIsInputOpen(true);
            setIsOutputOpen(false); 
        } else if (result) {
            setIsOpen(true);
            setIsInputOpen(false); 
            setIsOutputOpen(true); 
        }
    }, [isStreaming, result]);

    const isPython = name === 'run_python';
    const displayCode = isPython ? args['code'] : JSON.stringify(args, null, 2);
    const displayName = isPython ? 'Python Interpreter' : name;
    
    let statusIcon = <Clock size={12} />;
    let statusText = "Pending";
    let statusColor = "text-zinc-400 bg-zinc-100";

    if (isStreaming) {
        statusIcon = (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
        );
        statusText = "Running";
        statusColor = "text-indigo-600 bg-indigo-100";
    } else if (result) {
        statusIcon = <CheckCircle2 size={12} />;
        statusText = "Executed";
        statusColor = "text-emerald-600 bg-emerald-100";
    }

    return (
        <div className="my-3 w-full max-w-2xl font-mono text-sm border border-zinc-200 rounded-md overflow-hidden bg-white shadow-sm transition-all duration-200">
            {/* Header */}
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="bg-zinc-50/50 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-zinc-100/80 transition-colors select-none"
            >
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "p-1 rounded-sm",
                        isStreaming ? "bg-indigo-100 text-indigo-600" : "bg-zinc-200 text-zinc-600"
                    )}>
                        <Terminal size={12} />
                    </div>
                    <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                        {displayName}
                    </span>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full", statusColor)}>
                        {statusIcon}
                        <span className="text-[10px] font-medium uppercase">{statusText}</span>
                    </div>
                    
                    <div className="text-zinc-400">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                </div>
            </div>

            {/* Body */}
            {isOpen && (
                <div className="border-t border-zinc-200">
                    
                    {/* INPUT */}
                    <div className="bg-white">
                         <div 
                            onClick={() => setIsInputOpen(!isInputOpen)}
                            className="px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-zinc-50 select-none border-b border-transparent hover:border-zinc-100 transition-colors group"
                        >
                             <div className="flex items-center gap-2">
                                <div className="text-zinc-400">
                                    {isInputOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                </div>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Input</span>
                             </div>
                             {isInputOpen && (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <CopyButton text={displayCode} />
                                </div>
                             )}
                         </div>
                         
                         {isInputOpen && (
                            <div className="px-3 pb-3 pt-1">
                                <div className="bg-zinc-50 border border-zinc-100 rounded p-2 overflow-x-auto relative group/code">
                                    <pre className="text-xs text-zinc-600 leading-relaxed whitespace-pre-wrap break-all">
                                        <code>{displayCode}</code>
                                    </pre>
                                </div>
                            </div>
                         )}
                    </div>

                    {/* RESULT */}
                    {(result || isOutputOpen) && (
                        <div className="border-t border-zinc-100 bg-zinc-50/30">
                            <div 
                                onClick={() => setIsOutputOpen(!isOutputOpen)}
                                className="px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-zinc-100 select-none group"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="text-zinc-400">
                                        {isOutputOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    </div>
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Result</span>
                                </div>
                                {isOutputOpen && result && (
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <CopyButton text={result} />
                                    </div>
                                )}
                            </div>

                            {isOutputOpen && (
                                <div className="px-3 pb-3 pt-1">
                                    <div className="bg-[#1e1e1e] rounded p-3 overflow-x-auto shadow-inner border border-zinc-800 relative group/result">
                                        <pre className="text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap break-all">
                                            {result || <span className="text-zinc-600 italic">No output...</span>}
                                        </pre>
                                    </div>

                                    {/* Generated Images Section */}
                                    {generatedImages.length > 0 && (
                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {generatedImages.map((img) => (
                                                <DraggableGeneratedImage 
                                                    key={img.id} 
                                                    img={img} 
                                                    onClick={() => onFileClick?.(img as unknown as AppFile)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

interface DraggableGeneratedImageProps {
    img: { id: string; name: string; url: string; type: FileType };
    onClick?: () => void;
}

// Helper for draggable images in tool output
const DraggableGeneratedImage: React.FC<DraggableGeneratedImageProps> = ({ img, onClick }) => {
    const dragItem: DragItem = {
        type: 'FILE',
        id: img.id,
        fileType: img.type,
        origin: 'chat_artifact'
    };
    const { onDragStart, onDragEnd, draggable } = useDraggable(dragItem);

    return (
        <div 
            draggable={draggable}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={onClick}
            className="relative group border border-zinc-200 rounded-md overflow-hidden bg-zinc-100 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
        >
            <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
                <ImageIcon size={10} />
                {img.name}
            </div>
            <img src={img.url} alt={img.name} className="w-full h-auto object-contain max-h-[200px]" />
        </div>
    );
}

export interface GroundingBlockProps {
    metadata: {
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
        webSearchQueries?: string[];
    };
}

export const GroundingBlock: React.FC<GroundingBlockProps> = ({ metadata }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!metadata.groundingChunks || metadata.groundingChunks.length === 0) return null;

    const sources = metadata.groundingChunks
        .filter(c => c.web)
        .map(c => c.web!);

    if (sources.length === 0) return null;

    return (
        <div className="my-3 w-full max-w-2xl border border-zinc-200/60 rounded-lg overflow-hidden bg-white shadow-sm transition-all hover:shadow-md group">
             {/* Header */}
             <div 
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors select-none",
                    isOpen ? "bg-zinc-50 border-b border-zinc-100" : "bg-white hover:bg-zinc-50"
                )}
             >
                 <div className="flex items-center gap-3">
                     <div className={cn(
                         "flex items-center justify-center w-6 h-6 rounded-md border transition-colors",
                         isOpen ? "bg-white border-zinc-200 text-zinc-700" : "bg-zinc-50 border-zinc-200 text-zinc-400 group-hover:border-zinc-300"
                     )}>
                        <Globe size={13} />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-xs font-semibold text-zinc-800 leading-tight">
                            Sources
                        </span>
                        {!isOpen && (
                            <span className="text-[10px] text-zinc-400 font-medium leading-tight">
                                {sources.length} citations found
                            </span>
                        )}
                     </div>
                 </div>

                 <div className="text-zinc-400 group-hover:text-zinc-600 transition-colors">
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                 </div>
             </div>

             {/* List */}
             {isOpen && (
                 <div className="p-1 bg-white">
                     <div className="flex flex-col">
                         {sources.map((source, i) => {
                             let hostname = "";
                             try { hostname = new URL(source.uri || '').hostname.replace('www.', ''); } catch(e) {}
                             
                             return (
                                <a 
                                    key={i} 
                                    href={source.uri} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-start gap-3 px-3 py-2.5 hover:bg-zinc-50 transition-colors group/link border-b border-zinc-50 last:border-0"
                                >
                                    <span className="mt-0.5 flex-shrink-0 w-4 text-[10px] font-mono text-zinc-400 select-none">
                                        {i + 1}.
                                    </span>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-zinc-700 leading-snug group-hover/link:text-blue-600 transition-colors">
                                            {source.title || source.uri || 'Untitled'}
                                        </div>
                                        <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                                            {hostname}
                                        </div>
                                    </div>
                                    
                                    <div className="mt-0.5 opacity-0 group-hover/link:opacity-100 text-zinc-300 pr-1 transition-opacity">
                                        <Search size={12} />
                                    </div>
                                </a>
                             );
                         })}
                     </div>
                 </div>
             )}
        </div>
    );
};
