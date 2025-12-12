
import React, { useReducer, useEffect, useState } from "react";
import { PanelLeft, PanelLeftClose, Loader2 } from "lucide-react";
import { AppState, AppAction, AppActionType, AppFile, FileType } from "./types";
import { ChatPanel } from "./features/chat/ChatPanel";
import { FilePanel } from "./features/files/FilePanel";
import { WorkSurfacePanel } from "./features/work-surface/WorkSurfacePanel";
import { ResizablePanel } from "./components/layout/ResizablePanel";
import { cn, generateId } from "./lib/utils";
import { Button } from "./components/ui/Button";
import { loadPreferences, savePreferences } from "./lib/preferences";
import { db } from "./lib/db";
import { DragProvider } from "./lib/dnd";
import { ServiceProvider } from "./services/ServiceContext";
import { useHydration } from "./services/stateHydration";
import { roleRegistry } from "./services/roles/registry";
import { pyodideService } from "./services/pyodideService";

const prefs = loadPreferences();

const initialState: AppState = {
  files: [], 
  activeFileId: prefs.activeFileId || null,
  threads: [], 
  activeThreadId: prefs.activeThreadId || null,
  turnsByThread: {}, 
  activeChatMode: 'plan', // Deprecated
  activeRoleId: 'generic', // Default role
  isFilesCollapsed: prefs.isFilesCollapsed ?? true,
  isLoading: false,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case AppActionType.HYDRATE: return { ...state, ...action.payload };
    case AppActionType.SET_ACTIVE_FILE: return { ...state, activeFileId: action.payload };
    case AppActionType.ADD_FILE:
      let newFile = action.payload;
      const needsLayers = [FileType.IMAGE, FileType.VIDEO, FileType.AUDIO].includes(newFile.type);
      if (needsLayers && (!newFile.analysis || !newFile.analysis.layers || newFile.analysis.layers.length === 0)) {
          newFile = { 
            ...newFile, 
            analysis: { 
                activeLayerId: 'layer-1', 
                layers: [ 
                    { id: 'base-layer', name: 'Base', type: 'RASTER', locked: true, style: { visible: true, opacity: 1 }, metrics: newFile.metadata }, 
                    { id: 'layer-1', name: 'Layer 1', type: 'VECTOR', source: [], style: { visible: true, opacity: 1 } } 
                ], 
                artifacts: [] 
            } 
          };
      }
      return { ...state, files: [...state.files, newFile] };
    case AppActionType.REPLACE_FILE: return { ...state, files: state.files.map(f => f.id === action.payload.id ? action.payload : f) };
    case AppActionType.DELETE_FILE: return { ...state, files: state.files.filter(f => f.id !== action.payload), activeFileId: state.activeFileId === action.payload ? null : state.activeFileId };
    case AppActionType.MOVE_FILE: return { ...state, files: state.files.map(f => f.id === action.payload.fileId ? { ...f, virtualPath: action.payload.newVirtualPath, category: action.payload.newVirtualPath.startsWith('/workspace/data') ? 'project' : f.category } : f) };
    case AppActionType.REORDER_FILE: return { ...state, files: state.files.map(f => f.id === action.payload.fileId ? { ...f, sortOrder: action.payload.sortOrder, virtualPath: action.payload.newVirtualPath || f.virtualPath } : f) };
    case AppActionType.UPDATE_FILE_METADATA: return { ...state, files: state.files.map(f => f.id === action.payload.id || f.name === action.payload.id ? { ...f, metadata: { ...f.metadata, ...action.payload.metadata } } : f) };
    case AppActionType.UPDATE_FILE_ANNOTATIONS: return { ...state, files: state.files.map(f => f.id === action.payload.id ? { ...f, annotations: action.payload.annotations } : f) };
    case AppActionType.UPDATE_FILE_UPLOAD_STATUS: return { ...state, files: state.files.map(f => f.id === action.payload.id ? { ...f, providerMetadata: { ...f.providerMetadata, ...action.payload.providerMetadata } } : f) };
    case AppActionType.ADD_LAYER: return { ...state, files: state.files.map(f => f.id !== action.payload.fileId ? f : { ...f, analysis: { activeLayerId: action.payload.layer.id, layers: [...(f.analysis?.layers||[]), action.payload.layer], artifacts: f.analysis?.artifacts || [] } }) };
    case AppActionType.REMOVE_LAYER: return { ...state, files: state.files.map(f => f.id !== action.payload.fileId ? f : { ...f, analysis: { ...f.analysis!, layers: (f.analysis?.layers||[]).filter(l => l.id !== action.payload.layerId) } }) };
    case AppActionType.UPDATE_LAYER: return { ...state, files: state.files.map(f => f.id !== action.payload.fileId ? f : { ...f, analysis: { ...f.analysis!, layers: (f.analysis?.layers||[]).map(l => l.id === action.payload.layerId ? { ...l, ...action.payload.updates, style: { ...l.style, ...action.payload.updates.style } } : l) } }) };
    case AppActionType.UPDATE_LAYER_ANNOTATIONS: return { ...state, files: state.files.map(f => f.id !== action.payload.fileId ? f : { ...f, analysis: { ...f.analysis!, layers: (f.analysis?.layers||[]).map(l => l.id === action.payload.layerId ? { ...l, source: action.payload.annotations } : l) } }) };
    case AppActionType.SET_ACTIVE_LAYER: return { ...state, files: state.files.map(f => f.id !== action.payload.fileId ? f : { ...f, analysis: { layers: f.analysis?.layers || [], artifacts: f.analysis?.artifacts || [], activeLayerId: action.payload.layerId } }) };
    case AppActionType.ATTACH_RELATED_FILE: return { ...state, files: state.files.map(f => f.id !== action.payload.fileId ? f : { ...f, analysis: { ...f.analysis!, layers: f.analysis?.layers || [], activeLayerId: f.analysis?.activeLayerId || null, artifacts: [...(f.analysis?.artifacts||[]), action.payload.artifact] } }) };
    case AppActionType.ADD_TURN:
    case AppActionType.UPDATE_TURN:
       const { threadId, turn } = action.payload;
       const existingTurns = state.turnsByThread[threadId] || [];
       const index = existingTurns.findIndex(t => t.id === turn.id);
       let newTurns = [...existingTurns];
       if (index !== -1) newTurns[index] = turn; else newTurns.push(turn);
       return { ...state, turnsByThread: { ...state.turnsByThread, [threadId]: newTurns } };
    case AppActionType.CREATE_THREAD: return { ...state, threads: [action.payload, ...state.threads] };
    case AppActionType.SET_ACTIVE_THREAD: return { ...state, activeThreadId: action.payload };
    case AppActionType.RENAME_THREAD: return { ...state, threads: state.threads.map(t => t.id === action.payload.threadId ? { ...t, title: action.payload.newTitle } : t) };
    case AppActionType.UPDATE_THREAD_CONFIG: return { ...state, threads: state.threads.map(t => t.id === action.payload.threadId ? { ...t, config: { ...t.config, ...action.payload.config } as any } : t) };
    case AppActionType.SET_CHAT_MODE: return { ...state, activeChatMode: action.payload };
    case AppActionType.SET_ACTIVE_ROLE: return { ...state, activeRoleId: action.payload };
    case AppActionType.TOGGLE_FILES: return { ...state, isFilesCollapsed: !state.isFilesCollapsed };
    case AppActionType.SET_FILES_COLLAPSED: return { ...state, isFilesCollapsed: action.payload };
    case AppActionType.SET_LOADING: return { ...state, isLoading: action.payload };
    default: return state;
  }
}

function InnerApp() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const isDbReady = useHydration(dispatch);
  const [rolesReady, setRolesReady] = useState(false);

  useEffect(() => {
    if (isDbReady) {
        savePreferences(state);
        roleRegistry.initialize().then(() => setRolesReady(true));
    }
  }, [state.activeThreadId, state.activeFileId, state.isFilesCollapsed, isDbReady]);

  // Pre-load active role into Pyodide when ready
  useEffect(() => {
      if (rolesReady && state.activeRoleId) {
          const role = roleRegistry.getRole(state.activeRoleId);
          // Non-blocking load
          pyodideService.loadRole(role).catch(e => console.warn("Failed to preload active role", e));
      }
  }, [rolesReady, state.activeRoleId]);

  useEffect(() => {
    if (!state.activeFileId) return;
    const file = state.files.find(f => f.id === state.activeFileId);
    if (file) {
        db.files.update(file.id, { metadata: { ...file.metadata, analysis: file.analysis } }).catch(err => console.error("Auto-save failed:", err));
    }
  }, [state.files, state.activeFileId]);

  if (!isDbReady || !rolesReady) {
      return (
          <div className="h-screen w-screen flex items-center justify-center bg-[#FAFAFA] text-zinc-400 gap-2">
              <Loader2 className="animate-spin" /><span className="text-sm font-medium">Loading Workspace...</span>
          </div>
      );
  }

  const isFilesOpen = !state.isFilesCollapsed;

  return (
    <div className="flex h-screen w-screen bg-[#FAFAFA] text-foreground overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900">
        <ResizablePanel side="left" isOpen={true} defaultWidth={350} minWidth={300} maxWidth={500} className="hidden md:flex z-30 border-r border-zinc-200">
            <ChatPanel state={state} dispatch={dispatch} />
        </ResizablePanel>
        <ResizablePanel side="left" isOpen={isFilesOpen} defaultWidth={280} className="hidden md:flex z-20 bg-zinc-50/50 border-r border-zinc-200 shadow-lg">
            <FilePanel state={state} dispatch={dispatch} headerActions={<Button variant="ghost" size="icon" onClick={() => dispatch({ type: AppActionType.TOGGLE_FILES })} className="h-6 w-6 text-zinc-400"><PanelLeftClose size={16} /></Button>} />
        </ResizablePanel>
        <div className="flex-1 flex flex-col min-w-0 bg-[#FAFAFA] relative z-10 h-full">
            {!isFilesOpen && (
                <div className="absolute top-2 left-6 z-50 animate-in fade-in duration-200">
                    <Button variant="secondary" size="icon" className="bg-white shadow-sm border-none text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all" onClick={() => dispatch({ type: AppActionType.TOGGLE_FILES })} title="Open Files"><PanelLeft size={18} /></Button>
                </div>
            )}
            <WorkSurfacePanel state={state} dispatch={dispatch} isSidebarOpen={isFilesOpen} />
        </div>
    </div>
  );
}

export default function App() {
    return (
        <ServiceProvider>
            <DragProvider>
                <InnerApp />
            </DragProvider>
        </ServiceProvider>
    );
}
