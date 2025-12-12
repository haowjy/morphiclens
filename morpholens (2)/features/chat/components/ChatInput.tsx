
import React, { useState, useEffect, useRef, useMemo, useImperativeHandle, forwardRef } from "react";
import { Square, Plus, AtSign, X, ChevronDown, Check, ArrowUp, Search, Folder, Paperclip } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";
import { ChatMode, AppFile, FileType, AppActionType } from "../../../types";
import { FileIcon } from "../../../components/ui/FileIcon";
import { db } from "../../../lib/db";
import { useFileUpload } from "../../files/hooks/useFileUpload";
import { FileConflictModal } from "../../files/components/FileConflictModal";
import { useDropZone } from "../../../lib/dnd";
import { RoleSelector } from "./RoleSelector";

export interface ChatInputRef {
    addContextFile: (fileId: string) => void;
}

interface ChatInputProps {
  onSend: (message: string, mode: ChatMode, contextFiles: AppFile[]) => void;
  isLoading: boolean;
  onStop?: () => void;
  activeMode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  availableFiles: AppFile[];
  activeFileId: string | null;
  onFileUpload: (file: AppFile) => void;
  onFileClick?: (file: AppFile) => void;
  activeThreadId?: string | null; 
  dispatch: React.Dispatch<any>;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(({ 
  onSend, 
  isLoading, 
  onStop,
  activeMode,
  onModeChange,
  availableFiles,
  activeFileId,
  onFileUpload,
  onFileClick,
  activeThreadId,
  dispatch
}, ref) => {
  const [inputValue, setInputValue] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [tempUploadedFileIds, setTempUploadedFileIds] = useState<Set<string>>(new Set());
  
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [contextSearchQuery, setContextSearchQuery] = useState("");
  
  // We use activeMode prop here to pass Role ID for now, as prop signature refactor is larger
  // In `ChatPanel` we pass `state.activeRoleId` to `activeMode` prop.
  // We cast the types internally.
  const activeRoleId = activeMode as unknown as string;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { handleUpload, conflict, resolveConflict } = useFileUpload({ files: availableFiles, dispatch });

  useImperativeHandle(ref, () => ({
      addContextFile: (fileId: string) => {
          setSelectedFileIds(prev => new Set(prev).add(fileId));
      }
  }));

  const { handlers: dropHandlers, isOver } = useDropZone({
      onDrop: (item) => {
          setSelectedFileIds(prev => new Set(prev).add(item.id));
      }
  });

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  useEffect(() => {
    if (isContextOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setContextSearchQuery(""); 
    }
  }, [isContextOpen]);

  const handleSend = () => {
    if (!inputValue.trim() && selectedFileIds.size === 0) return;
    const contextFiles = availableFiles.filter(f => selectedFileIds.has(f.id));
    onSend(inputValue, activeMode, contextFiles);
    setInputValue("");
    setSelectedFileIds(new Set()); 
    setTempUploadedFileIds(new Set());
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleStop = () => {
      onStop?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleFile = (id: string) => {
      if (tempUploadedFileIds.has(id)) {
          dispatch({ type: AppActionType.DELETE_FILE, payload: id });
          db.files.delete(id);
          setTempUploadedFileIds(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
          });
          setSelectedFileIds(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
          });
      } else {
          setSelectedFileIds(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
          });
      }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      handleUpload(file, 'session', activeThreadId || undefined, (uploadedFile, action) => {
           setSelectedFileIds(prev => new Set(prev).add(uploadedFile.id));
           if (action === 'add') {
               setTempUploadedFileIds(prev => new Set(prev).add(uploadedFile.id));
           }
      });

      if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const groupedFiles = useMemo(() => {
    const query = contextSearchQuery.toLowerCase();
    const filesOnly = availableFiles.filter(f => f.type !== FileType.FOLDER);
    const filtered = filesOnly.filter(f => f.name.toLowerCase().includes(query));
    const folders = availableFiles.filter(f => f.type === FileType.FOLDER);
    
    const groups: Record<string, AppFile[]> = {
        'Unsorted': [],
        'Session Artifacts': []
    };
    
    folders.forEach(f => { groups[f.name] = []; });

    filtered.forEach(f => {
        if (f.category === 'session') {
            groups['Session Artifacts'].push(f);
        } else {
            const parentFolder = folders.find(folder => f.virtualPath?.startsWith(folder.virtualPath!));
            if (parentFolder) {
                groups[parentFolder.name].push(f);
            } else {
                groups['Unsorted'].push(f);
            }
        }
    });

    return groups;
  }, [availableFiles, contextSearchQuery]);

  const selectedFiles = availableFiles.filter(f => selectedFileIds.has(f.id));
  const isSendDisabled = !inputValue.trim() && selectedFileIds.size === 0 && !isLoading;

  const renderFileGroup = (title: string, files: AppFile[], isFolder = false) => {
      if (!files || files.length === 0) return null;
      return (
          <div className="mb-2">
              <div className="px-3 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-50/80 sticky top-0 z-10 backdrop-blur-sm flex items-center gap-1.5">
                  {isFolder && <Folder size={10} />}
                  {title}
              </div>
              <div className="space-y-0.5 px-1">
                  {files.map(f => (
                    <div 
                        key={f.id}
                        onClick={() => toggleFile(f.id)}
                        className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors group",
                            selectedFileIds.has(f.id) ? "bg-indigo-50 text-indigo-700" : "hover:bg-zinc-100 text-zinc-700"
                        )}
                    >
                        <div className={cn(
                            "w-3 h-3 border rounded-sm flex items-center justify-center flex-shrink-0 transition-colors",
                            selectedFileIds.has(f.id) ? "border-indigo-500 bg-indigo-500" : "border-zinc-300 group-hover:border-zinc-400"
                        )}>
                            {selectedFileIds.has(f.id) && <Check size={8} className="text-white" />}
                        </div>
                        <FileIcon type={f.type} size={12} className={selectedFileIds.has(f.id) ? "text-indigo-600" : "opacity-70"} />
                        <span className="truncate min-w-0">{f.name}</span>
                        {f.category === 'session' && (
                             <span className="ml-auto text-[9px] text-zinc-400 px-1.5 py-0.5 bg-zinc-100 rounded-full group-hover:bg-zinc-200">Session</span>
                        )}
                    </div>
                ))}
              </div>
          </div>
      );
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {conflict && (
          <FileConflictModal 
            filename={conflict.file.name}
            existingFile={conflict.existingFile}
            onReplace={() => resolveConflict('replace')}
            onKeepBoth={() => resolveConflict('keepBoth')}
            onCancel={() => resolveConflict('cancel')}
          />
      )}

      {isContextOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsContextOpen(false)} />
            <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-lg shadow-xl border border-zinc-200 z-50 overflow-hidden animate-in zoom-in-95 fade-in duration-200 flex flex-col">
                <div className="px-3 py-2 border-b border-zinc-100 bg-zinc-50/50 flex-shrink-0">
                    <span className="text-xs font-bold text-zinc-500 uppercase block mb-2">Attach from Workspace</span>
                    <div className="relative">
                        <Search className="absolute left-2 top-1.5 text-zinc-400" size={12} />
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            placeholder="Search files..." 
                            value={contextSearchQuery}
                            onChange={(e) => setContextSearchQuery(e.target.value)}
                            className="w-full pl-7 pr-2 py-1 text-xs bg-white border border-zinc-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-300 text-zinc-800 placeholder:text-zinc-400"
                        />
                    </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-1">
                    {availableFiles.length === 0 ? (
                        <div className="p-4 text-center text-xs text-zinc-400">No files available</div>
                    ) : (
                        <>
                            {Object.entries(groupedFiles).map(([groupName, files]) => {
                                if (groupName === 'Session Artifacts' || groupName === 'Unsorted') return null;
                                return renderFileGroup(groupName, files as AppFile[], true);
                            })}
                            {renderFileGroup("Unsorted", groupedFiles['Unsorted'])}
                            {renderFileGroup("Session Artifacts", groupedFiles['Session Artifacts'])}
                            {Object.values(groupedFiles).every((g: any) => g.length === 0) && (
                                <div className="p-4 text-center text-xs text-zinc-400 italic">
                                    No files match "{contextSearchQuery}"
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
          </>
      )}

      <div 
        {...dropHandlers}
        className={cn(
            "bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.16)] overflow-visible",
            isOver ? "border-indigo-400 ring-4 ring-indigo-50 scale-[1.01]" : "border-zinc-200/60"
        )}
      >
        {isOver && (
            <div className="absolute inset-0 z-50 bg-indigo-50/90 backdrop-blur-sm flex items-center justify-center pointer-events-none rounded-xl">
                <div className="flex flex-col items-center gap-2 text-indigo-600 animate-in zoom-in-95 duration-200">
                    <Paperclip size={32} />
                    <span className="font-semibold text-sm">Drop to Attach</span>
                </div>
            </div>
        )}

        {selectedFiles.length > 0 && (
            <div className="px-3 pt-3 pb-1 flex flex-wrap gap-2">
                {selectedFiles.map(f => (
                    <div 
                        key={f.id} 
                        className="group/chip flex items-center gap-1.5 bg-zinc-100 border border-zinc-200 text-zinc-600 px-2 py-1 rounded-md text-[10px] font-medium animate-in fade-in slide-in-from-bottom-1 cursor-pointer hover:bg-zinc-200 transition-colors"
                        onClick={() => onFileClick?.(f)}
                    >
                        <FileIcon type={f.type} size={10} />
                        <span className="max-w-[100px] truncate">{f.name}</span>
                        <button 
                            onClick={(e) => { e.stopPropagation(); toggleFile(f.id); }}
                            className="ml-0.5 hover:text-red-500 transition-colors p-0.5 rounded-full hover:bg-zinc-300/50"
                        >
                            <X size={10} />
                        </button>
                    </div>
                ))}
            </div>
        )}

        <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or drag files..."
            className="w-full bg-transparent border-none focus:ring-0 px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 min-h-[50px] resize-none focus:outline-none"
            rows={1}
        />

        <div className="flex items-center justify-between px-2 pb-2 pt-1 relative z-50">
            <div className="flex items-center gap-1">
                {/* Role Selector */}
                <RoleSelector 
                    activeRoleId={activeRoleId} 
                    onRoleChange={(roleId) => onModeChange(roleId as unknown as ChatMode)} 
                />

                <div className="w-[1px] h-4 bg-zinc-200 mx-1" />

                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach File"
                >
                    <Plus size={16} />
                </Button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={onFileInputChange} 
                />

                <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                        "h-8 w-8 rounded-lg transition-colors",
                        isContextOpen ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                    )}
                    onClick={() => setIsContextOpen(!isContextOpen)}
                    title="Add Context (@)"
                >
                    <AtSign size={16} />
                </Button>
            </div>

            <Button
                variant={!isSendDisabled ? "primary" : "ghost"}
                size="icon"
                className={cn(
                    "h-8 w-8 rounded-lg transition-all duration-200",
                    !isSendDisabled ? "bg-zinc-900 text-white hover:bg-zinc-700 shadow-md" : "bg-transparent text-zinc-300 pointer-events-none"
                )}
                onClick={isLoading ? handleStop : handleSend}
                disabled={isSendDisabled}
                title={isLoading ? "Stop Generation" : "Send Message"}
            >
                {isLoading ? (
                    <Square size={10} fill="currentColor" />
                ) : (
                    <ArrowUp size={16} strokeWidth={2.5} />
                )}
            </Button>
        </div>
      </div>
    </div>
  );
});
