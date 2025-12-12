
import React, { useRef, useEffect, useState, useMemo } from "react";
import { Plus, MessageSquare, ChevronDown, Pen, Check, X, SlidersHorizontal, Image as ImageIcon, BrainCircuit } from "lucide-react";
import { cn } from "../../lib/utils";
import { AppState, AppActionType, ThreadTurn, ChatMode, AppFile, ModelId, ImageModelId } from "../../types";
import { Button } from "../../components/ui/Button";
import { ChatInput, ChatInputRef } from "./components/ChatInput";
import { ChatMessageItem } from "./components/ChatMessageItem";
import { ChatThreadList } from "./components/ChatThreadList";
import { db } from "../../lib/db";
import { useAgentChat } from "./hooks/useAgentChat";
import { pyodideService, PyodideStatus } from "../../services/pyodideService";
import { useDropZone } from "../../lib/dnd";
import { roleRegistry } from "../../services/roles/registry";

const RuntimeStatus = () => {
    const [status, setStatus] = useState<PyodideStatus>(pyodideService.status);

    useEffect(() => {
        return pyodideService.subscribe(setStatus);
    }, []);

    if (status === 'READY') {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100/50 cursor-help" title="Python Runtime Ready">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                <span className="text-[10px] font-medium tracking-wide">PY</span>
            </div>
        );
    }
    
    if (status === 'LOADING_RUNTIME' || status === 'INSTALLING_PACKAGES') {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-100/50" title="Loading Python Packages...">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[10px] font-medium tracking-wide">INIT</span>
            </div>
        );
    }

    if (status === 'ERROR') {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-700 rounded-full border border-red-100/50" title="Runtime Error">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[10px] font-medium tracking-wide">ERR</span>
            </div>
        );
    }

    return null;
}

interface ChatPanelProps {
  state: AppState;
  dispatch: React.Dispatch<any>;
  className?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ state, dispatch, className }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [selectedModel, setSelectedModel] = useState<ModelId>('gemini-3-pro-preview');
  const [selectedImageModel, setSelectedImageModel] = useState<ImageModelId>('gemini-2.5-flash-image');

  const renameInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<ChatInputRef>(null);

  const { sendMessage, stopGeneration } = useAgentChat(state, dispatch);

  const activeThread = state.threads.find(t => t.id === state.activeThreadId);
  const activeTurns: ThreadTurn[] = state.activeThreadId 
    ? (state.turnsByThread[state.activeThreadId] || [])
    : [];
  
  // Retrieve current role to display capabilities (thinking budget)
  const activeRole = useMemo(() => {
      try {
          return roleRegistry.getRole(state.activeRoleId);
      } catch (e) {
          return null;
      }
  }, [state.activeRoleId]);

  const isThinkingModel = selectedModel.includes('gemini-2.5') || selectedModel.includes('gemini-3') || selectedModel.includes('flash-lite');
  const thinkingBudget = activeRole?.manifest.thinkingBudget || 0;

  useEffect(() => {
    if (activeThread) {
        setSelectedModel(activeThread.config?.model || 'gemini-3-pro-preview');
        setSelectedImageModel(activeThread.config?.imageModel || 'gemini-2.5-flash-image');
        if (activeThread.config?.roleId && activeThread.config.roleId !== state.activeRoleId) {
             dispatch({ type: AppActionType.SET_ACTIVE_ROLE, payload: activeThread.config.roleId });
        }
    } else {
        setSelectedModel('gemini-3-pro-preview');
        setSelectedImageModel('gemini-2.5-flash-image');
    }
  }, [activeThread?.id, activeThread?.config?.model, activeThread?.config?.imageModel, activeThread?.config?.roleId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeTurns.length, state.isLoading, activeTurns[activeTurns.length - 1]?.contents?.length]); 

  useEffect(() => {
      if (isRenaming && renameInputRef.current) {
          renameInputRef.current.focus();
          renameInputRef.current.select();
      }
  }, [isRenaming]);

  const { handlers: dropHandlers, isOver } = useDropZone({
      onDrop: (item) => {
          chatInputRef.current?.addContextFile(item.id);
      },
      canDrop: (item) => item.origin !== 'chat_artifact'
  });

  const handleNewChat = () => {
      dispatch({ type: AppActionType.SET_ACTIVE_THREAD, payload: null });
      setIsHistoryOpen(false);
  };

  const handleSelectThread = (id: string) => {
      dispatch({ type: AppActionType.SET_ACTIVE_THREAD, payload: id });
      setIsHistoryOpen(false);
  };

  const startRenaming = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!activeThread) return;
      setRenameValue(activeThread.title);
      setIsRenaming(true);
      setIsHistoryOpen(false);
  };

  const saveRename = async () => {
      if (activeThread && renameValue.trim()) {
          const newTitle = renameValue.trim();
          dispatch({ 
              type: AppActionType.RENAME_THREAD, 
              payload: { threadId: activeThread.id, newTitle } 
          });
          await db.threads.update(activeThread.id, { title: newTitle });
      }
      setIsRenaming(false);
  };

  const cancelRename = () => {
      setIsRenaming(false);
      setRenameValue("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') saveRename();
      if (e.key === 'Escape') cancelRename();
  };

  const handleSend = (message: string, mode: ChatMode, contextFiles: AppFile[]) => {
      // NOTE: `mode` param here carries the roleId from ChatInput
      const roleId = mode as unknown as string;
      sendMessage(message, roleId, contextFiles, selectedModel);
  };
  
  const handleFileClick = (file: AppFile) => {
      dispatch({ type: AppActionType.SET_ACTIVE_FILE, payload: file.id });
      dispatch({ type: AppActionType.SET_FILES_COLLAPSED, payload: true });
  };

  const handleModelChange = async (model: ModelId) => {
    setSelectedModel(model);
    if (activeThread) {
        dispatch({
            type: AppActionType.UPDATE_THREAD_CONFIG,
            payload: { threadId: activeThread.id, config: { model } }
        });
        await db.threads.update(activeThread.id, { config: { ...activeThread.config, model } as any });
    }
  };

  const handleImageModelChange = async (imageModel: ImageModelId) => {
    setSelectedImageModel(imageModel);
    if (activeThread) {
        dispatch({
            type: AppActionType.UPDATE_THREAD_CONFIG,
            payload: { threadId: activeThread.id, config: { imageModel } }
        });
        await db.threads.update(activeThread.id, { config: { ...activeThread.config, imageModel } as any });
    }
  };

  const handleRoleChange = async (roleId: string) => {
      dispatch({ type: AppActionType.SET_ACTIVE_ROLE, payload: roleId });
      if (activeThread) {
           dispatch({
              type: AppActionType.UPDATE_THREAD_CONFIG,
              payload: { threadId: activeThread.id, config: { roleId } }
          });
          await db.threads.update(activeThread.id, { config: { ...activeThread.config, roleId } as any });
      }
  };

  return (
    <div 
        className={cn("flex flex-col h-full bg-white relative transition-colors", className, isOver && "bg-indigo-50/20")}
        {...dropHandlers}
    >
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 flex-shrink-0 bg-white z-30 border-b border-zinc-100 relative shadow-sm">
        <div className="flex items-center min-w-0 flex-1 mr-2 gap-2">
            {isRenaming ? (
                <div className="flex items-center w-full animate-in fade-in duration-200">
                    <input 
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        className="flex-1 h-8 text-sm font-semibold text-zinc-800 bg-zinc-50 border border-indigo-200 rounded px-2 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        onBlur={saveRename} 
                    />
                    <div className="flex items-center ml-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50" onClick={saveRename}>
                            <Check size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:bg-zinc-100" onClick={cancelRename}>
                            <X size={14} />
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="relative flex-shrink-0">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn(
                                "h-7 w-7 text-zinc-500 hover:text-zinc-800 transition-colors border border-transparent rounded-md",
                                isSettingsOpen && "bg-zinc-100 text-zinc-900 border-zinc-200 shadow-sm"
                            )}
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            title="Chat Preferences & Model"
                        >
                            <SlidersHorizontal size={14} />
                        </Button>
                        
                        {isSettingsOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)} />
                                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-zinc-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="px-2 py-1.5 mb-1 border-b border-zinc-100">
                                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Reasoning Model</h4>
                                    </div>
                                    <div className="space-y-0.5 mb-3">
                                        {[
                                            { id: 'gemini-3-pro-preview', label: 'Gemini 3.0 Pro', desc: 'Reasoning & Complex Tasks' },
                                            { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: 'Fast & Efficient' },
                                            { id: 'gemini-flash-lite-latest', label: 'Gemini 2.5 Lite', desc: 'Cost Effective' }
                                        ].map((opt) => (
                                            <div 
                                                key={opt.id}
                                                onClick={() => { handleModelChange(opt.id as ModelId); }}
                                                className={cn(
                                                    "px-3 py-2 rounded-md cursor-pointer transition-colors border group",
                                                    selectedModel === opt.id 
                                                        ? "bg-indigo-50/50 border-indigo-200/60" 
                                                        : "bg-white border-transparent hover:bg-zinc-50"
                                                )}
                                            >
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className={cn("text-sm font-medium", selectedModel === opt.id ? "text-indigo-900" : "text-zinc-700")}>
                                                        {opt.label}
                                                    </span>
                                                    {selectedModel === opt.id && <Check size={14} className="text-indigo-600" />}
                                                </div>
                                                <div className={cn("text-[10px]", selectedModel === opt.id ? "text-indigo-700/70" : "text-zinc-400 group-hover:text-zinc-500")}>
                                                    {opt.desc}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {isThinkingModel && (
                                        <div className="px-3 py-2 mb-3 bg-zinc-50 rounded-md border border-zinc-100 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-zinc-600">
                                                <BrainCircuit size={14} />
                                                <span className="text-xs font-medium">Thinking Budget</span>
                                            </div>
                                            <span className="text-xs font-mono text-zinc-900">{thinkingBudget} tks</span>
                                        </div>
                                    )}

                                    <div className="px-2 py-1.5 mb-1 border-b border-zinc-100 flex items-center gap-2">
                                        <ImageIcon size={12} className="text-zinc-400" />
                                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Image Generation</h4>
                                    </div>
                                    <div className="space-y-0.5">
                                        {[
                                            { id: 'gemini-2.5-flash-image', label: 'Flash Image', desc: 'Fast generation' },
                                            { id: 'gemini-3-pro-image-preview', label: 'Pro Image', desc: 'High quality (Costlier)' }
                                        ].map((opt) => (
                                            <div 
                                                key={opt.id}
                                                onClick={() => { handleImageModelChange(opt.id as ImageModelId); }}
                                                className={cn(
                                                    "px-3 py-2 rounded-md cursor-pointer transition-colors border group",
                                                    selectedImageModel === opt.id 
                                                        ? "bg-indigo-50/50 border-indigo-200/60" 
                                                        : "bg-white border-transparent hover:bg-zinc-50"
                                                )}
                                            >
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className={cn("text-sm font-medium", selectedImageModel === opt.id ? "text-indigo-900" : "text-zinc-700")}>
                                                        {opt.label}
                                                    </span>
                                                    {selectedImageModel === opt.id && <Check size={14} className="text-indigo-600" />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="hidden sm:block flex-shrink-0">
                        <RuntimeStatus />
                    </div>

                    <div 
                        className={cn(
                            "flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-md transition-colors group max-w-full min-w-0",
                            isHistoryOpen ? "bg-zinc-100" : "hover:bg-zinc-50"
                        )}
                        onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                    >
                        <span className="font-semibold text-sm text-zinc-800 truncate max-w-[140px] sm:max-w-[180px]">
                            {activeThread ? activeThread.title : 'New Chat'}
                        </span>
                        <ChevronDown size={14} className={cn("text-zinc-400 transition-transform duration-200 flex-shrink-0", isHistoryOpen && "rotate-180")} />
                        
                        {activeThread && (
                            <div 
                                role="button"
                                onClick={startRenaming}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-zinc-200 rounded text-zinc-400 hover:text-zinc-600 flex-shrink-0"
                                title="Rename chat"
                            >
                                <Pen size={10} />
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
        
        <div className="flex items-center gap-1">
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-zinc-400 hover:text-zinc-700"
                onClick={handleNewChat}
                title="New Chat"
            >
                <Plus size={18} />
            </Button>
        </div>
      </div>

      {isHistoryOpen && (
          <>
            <div className="absolute inset-0 z-10 bg-transparent" onClick={() => setIsHistoryOpen(false)} />
            <div className="absolute top-12 left-0 w-full z-20 shadow-xl border-b border-zinc-200 animate-in slide-in-from-top-2 duration-200 origin-top">
                 <ChatThreadList 
                    threads={state.threads}
                    activeId={state.activeThreadId}
                    onSelect={handleSelectThread}
                    className="max-h-[60vh]"
                 />
            </div>
          </>
      )}

      {/* Main Chat Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide pb-32">
        {activeTurns.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-0 animate-in fade-in zoom-in-95 duration-500 delay-100">
                <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center mb-4 text-zinc-300">
                    <MessageSquare size={20} />
                </div>
                <h3 className="text-sm font-medium text-zinc-900">Workspace Ready</h3>
                <p className="text-xs text-zinc-400 mt-2 max-w-[240px]">
                    Using <span className="font-medium text-zinc-500">{selectedModel === 'gemini-flash-lite-latest' ? 'Gemini 2.5 Lite' : selectedModel === 'gemini-3-pro-preview' ? 'Gemini 3.0 Pro' : 'Gemini 2.5 Flash'}</span>
                </p>
                {isThinkingModel && thinkingBudget > 0 && (
                    <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-indigo-500/80 bg-indigo-50/50 px-2 py-1 rounded-full border border-indigo-100">
                        <BrainCircuit size={10} />
                        <span>Thinking Enabled ({thinkingBudget} tks)</span>
                    </div>
                )}
                <div className="mt-4 sm:hidden">
                    <RuntimeStatus />
                </div>
            </div>
        )}
        
        {activeTurns.map((turn) => (
            <ChatMessageItem 
                key={turn.id} 
                turn={turn} 
                files={state.files}
                onFileClick={handleFileClick}
            />
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent z-40">
        <ChatInput 
            ref={chatInputRef}
            onSend={handleSend}
            isLoading={state.isLoading}
            onStop={stopGeneration}
            activeMode={state.activeRoleId as unknown as ChatMode}
            onModeChange={(m) => handleRoleChange(m as unknown as string)}
            availableFiles={state.files}
            activeFileId={state.activeFileId}
            onFileUpload={(file) => dispatch({ type: AppActionType.ADD_FILE, payload: file })}
            onFileClick={handleFileClick}
            activeThreadId={state.activeThreadId}
            dispatch={dispatch}
        />
      </div>
    </div>
  );
};
