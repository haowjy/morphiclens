
import React, { useRef, useState, useMemo } from "react";
import { Plus, ChevronDown, ChevronRight, Archive, FolderPlus, FolderOpen, Folder } from "lucide-react";
import { cn } from "../../lib/utils";
import { AppState, FileType, AppActionType, AppFile } from "../../types";
import { Button } from "../../components/ui/Button";
import { FileIcon } from "../../components/ui/FileIcon";
import { useFileUpload } from "./hooks/useFileUpload";
import { useFileSystem } from "./hooks/useFileSystem";
import { FileConflictModal } from "./components/FileConflictModal";
import { VirtualPath } from "../../lib/virtualPath";
import { DragItem, useDraggable, useDropZone } from "../../lib/dnd";

interface FilePanelProps {
  state: AppState;
  dispatch: React.Dispatch<any>;
  isCollapsed?: boolean;
  className?: string;
  headerActions?: React.ReactNode;
}

// --- Tree Node Types ---
interface FileTreeNode {
    id: string; 
    name: string;
    path: string;
    file?: AppFile;
    children: FileTreeNode[];
    isFolder: boolean;
    sortOrder: number;
}

type DropPosition = 'before' | 'after' | 'inside';

// --- Component: Draggable File Item ---
interface DraggableFileItemProps {
    file: AppFile; 
    activeId: string | null; 
    onSelect: (id: string) => void;
    onDrop: (s: string, t: string, p: DropPosition) => void;
    className?: string;
}

const DraggableFileItem: React.FC<DraggableFileItemProps> = ({ 
    file, 
    activeId, 
    onSelect, 
    onDrop,
    className
}) => {
    
    // Setup Draggable
    const dragItem: DragItem = {
        type: 'FILE',
        id: file.id,
        fileType: file.type,
        origin: file.category === 'session' ? 'session' : 'explorer'
    };
    const { onDragStart, onDragEnd, draggable } = useDraggable(dragItem);

    // Setup DropZone
    const { handlers, isOver, dropPosition } = useDropZone({
        onDrop: (item, pos) => {
            if (item.id !== file.id) onDrop(item.id, file.id, pos || 'inside');
        },
        enableHighPrecision: true
    });

    return (
        <div className="relative">
             {/* Drop Indicators */}
             {isOver && dropPosition === 'before' && (
                 <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500 z-50 pointer-events-none rounded-full" />
             )}
            <div
                draggable={draggable}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                {...handlers}
                onClick={() => onSelect(file.id)}
                className={cn(
                    "group flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm transition-all outline-none border border-transparent",
                    activeId === file.id
                        ? "bg-white border-zinc-200 shadow-sm text-zinc-900 font-medium"
                        : "text-zinc-600 hover:bg-zinc-100",
                    className
                )}
            >
                <FileIcon type={file.type} className={activeId === file.id ? "text-indigo-600" : "opacity-70 group-hover:opacity-100"} />
                <span className="truncate">{file.name}</span>
            </div>
            {isOver && dropPosition === 'after' && (
                 <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 z-50 pointer-events-none rounded-full" />
             )}
        </div>
    );
};

// --- Component: Folder Node (Recursive) ---
interface FolderNodeProps {
    node: FileTreeNode;
    activeId: string | null;
    onSelect: (id: string) => void;
    onDrop: (s: string, t: string, p: DropPosition) => void;
}

const FolderNode: React.FC<FolderNodeProps> = ({
    node,
    activeId,
    onSelect,
    onDrop
}) => {
    const [isOpen, setIsOpen] = useState(true);
    
    // Header Drag Logic
    const dragItem: DragItem = {
        type: 'FILE',
        id: node.id,
        fileType: FileType.FOLDER,
        origin: 'explorer'
    };
    const { onDragStart, onDragEnd, draggable } = useDraggable(dragItem);
    
    // Header Drop Logic
    const { handlers: headerHandlers, isOver, dropPosition } = useDropZone({
        onDrop: (item, pos) => {
            if (item.id !== node.id) onDrop(item.id, node.id, pos || 'inside');
        },
        enableHighPrecision: true
    });
    
    // Children Region Drop Logic (Always 'Inside')
    const { handlers: regionHandlers, isOver: isRegionOver } = useDropZone({
        onDrop: (item) => {
            if (item.id !== node.id) onDrop(item.id, node.id, 'inside');
        }
    });

    return (
        <div className="mb-0.5 relative">
             {/* Drop Indicators for Folder Reordering */}
             {isOver && dropPosition === 'before' && (
                 <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500 z-50 pointer-events-none rounded-full" />
             )}
             
             {/* Folder Header */}
             <div 
                draggable={draggable}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                {...headerHandlers}
                className={cn(
                    "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group select-none rounded-md mx-2 border border-transparent",
                    // Highlight 'Inside' drop specially
                    (isOver && dropPosition === 'inside') ? "bg-indigo-50 ring-1 ring-indigo-300" : "hover:bg-zinc-100"
                )}
                onClick={() => setIsOpen(!isOpen)}
             >
                <div className="text-zinc-400 group-hover:text-zinc-600 transition-colors">
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                <div className="text-indigo-400">
                    {isOpen ? <FolderOpen size={14} /> : <Folder size={14} />}
                </div>
                <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wide truncate select-none">
                    {node.name}
                </span>
                <span className="ml-auto text-[10px] text-zinc-400 bg-white px-1.5 rounded-full border border-zinc-100">
                    {node.children.length}
                </span>
             </div>
             
             {isOver && dropPosition === 'after' && (
                 <div className="absolute bottom-2 left-0 right-0 h-0.5 bg-indigo-500 z-50 pointer-events-none rounded-full" />
             )}

             {/* Folder Children / Region */}
             {isOpen && (
                 <div 
                    className={cn(
                        "pl-4 min-h-[0.5rem] transition-colors rounded-sm ml-2",
                        isRegionOver && "bg-indigo-50/30"
                    )}
                    {...regionHandlers}
                 >
                    {node.children.length === 0 ? (
                        <div className="pl-6 text-[10px] text-zinc-400 py-2 italic select-none">Empty folder</div>
                    ) : (
                        node.children.map(child => (
                            child.isFolder ? (
                                <FolderNode 
                                    key={child.id} 
                                    node={child} 
                                    activeId={activeId} 
                                    onSelect={onSelect}
                                    onDrop={onDrop}
                                />
                            ) : (
                                <DraggableFileItem 
                                    key={child.id} 
                                    file={child.file!} 
                                    activeId={activeId} 
                                    onSelect={onSelect}
                                    onDrop={onDrop}
                                    className="ml-2"
                                />
                            )
                        ))
                    )}
                 </div>
             )}
        </div>
    );
};

// --- Component: Root Drop Zone ---
interface RootDropZoneProps {
    children: React.ReactNode;
    onDrop: (sourceId: string, targetId: string | null, position: DropPosition) => void;
    className?: string;
}

const RootDropZone: React.FC<RootDropZoneProps> = ({
    children,
    onDrop,
    className
}) => {
    const { handlers, isOver } = useDropZone({
        onDrop: (item) => {
            onDrop(item.id, null, 'inside');
        }
    });

    return (
        <div 
            className={cn("min-h-[2rem] transition-colors rounded-md", className)}
            {...handlers}
        >
            {children}
            {/* Visual Indicator for "Append to Bottom" */}
            {isOver && (
                <div className="h-0.5 bg-indigo-500 rounded-full mx-2 mt-2 opacity-50" />
            )}
        </div>
    );
};

// --- Main Component ---
export const FilePanel: React.FC<FilePanelProps> = ({ 
    state, 
    dispatch, 
    className,
    headerActions
}) => {
  const { files, activeFileId, activeThreadId } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const { handleUpload, conflict, resolveConflict } = useFileUpload({ files, dispatch });
  const { createFolder, reorderNode } = useFileSystem(dispatch, state);

  // --- Tree Building Logic ---
  const { rootNodes, sessionFiles } = useMemo(() => {
      // 1. Separate Project Files vs Session
      const projectFiles = files.filter(f => f.category === 'project');
      const session = files.filter(f => 
        f.category === 'session' && (!f.threadId || f.threadId === activeThreadId)
      );

      // 2. Build Tree for Project Files
      const rootPath = '/workspace/data';
      
      const nodes: Record<string, FileTreeNode> = {};
      const rootChildren: FileTreeNode[] = [];

      // Pass 1: Create Nodes
      projectFiles.forEach(f => {
          nodes[f.virtualPath || f.id] = { 
              id: f.id,
              name: f.name,
              path: f.virtualPath || '',
              file: f,
              children: [],
              isFolder: f.type === FileType.FOLDER,
              sortOrder: f.sortOrder || 0
          };
      });

      // Pass 2: Link Children to Parents
      projectFiles.forEach(f => {
          const node = nodes[f.virtualPath!];
          if (!node) return;

          const parentDir = VirtualPath.dirname(f.virtualPath!);
          
          if (parentDir === rootPath) {
              rootChildren.push(node);
          } else {
              const parentNode = Object.values(nodes).find(n => n.path === parentDir && n.isFolder);
              if (parentNode) {
                  parentNode.children.push(node);
              } else {
                  rootChildren.push(node);
              }
          }
      });

      // Sort
      const sortNodes = (list: FileTreeNode[]) => {
          list.sort((a, b) => {
              if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
              if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
              return a.name.localeCompare(b.name);
          });
          list.forEach(n => sortNodes(n.children));
      };
      sortNodes(rootChildren);

      return { rootNodes: rootChildren, sessionFiles: session };
  }, [files, activeThreadId]);


  const handleFileClick = (id: string) => {
    dispatch({ type: AppActionType.SET_ACTIVE_FILE, payload: id });
    dispatch({ type: AppActionType.SET_FILES_COLLAPSED, payload: true });
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      
      Array.from(files).forEach((uploadedFile: File) => {
          handleUpload(uploadedFile, 'project', undefined, (file) => {
               handleFileClick(file.id);
          });
      });
      
      if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateFolderConfirm = async () => {
      if (!newFolderName.trim()) {
          setIsCreatingFolder(false);
          return;
      }
      await createFolder(newFolderName.trim());
      setIsCreatingFolder(false);
      setNewFolderName("");
  };

  return (
    <div className={cn("bg-[#FAFAFA] h-full flex flex-col relative", className)}>
      
      {conflict && (
          <FileConflictModal 
            filename={conflict.file.name}
            existingFile={conflict.existingFile}
            onReplace={() => resolveConflict('replace')}
            onKeepBoth={() => resolveConflict('keepBoth')}
            onCancel={() => resolveConflict('cancel')}
          />
      )}

      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 flex-shrink-0 border-b border-transparent">
        <span className="font-semibold text-sm text-zinc-900 ml-1">Explorer</span>
        
        <div className="flex items-center gap-1">
             <Button 
                variant="ghost" 
                size="icon"
                className="h-7 w-7 text-zinc-400 hover:text-zinc-600"
                onClick={() => setIsCreatingFolder(true)}
                title="New Folder"
             >
                <FolderPlus size={16} />
             </Button>
             
             <Button 
                variant="ghost" 
                size="icon"
                className="h-7 w-7 text-zinc-400 hover:text-zinc-600"
                onClick={() => fileInputRef.current?.click()}
                title="Upload File"
             >
                <Plus size={16} />
             </Button>
             <input 
                ref={fileInputRef}
                type="file" 
                multiple
                className="hidden" 
                onChange={onFileInputChange} 
             />
             {headerActions}
        </div>
      </div>

      {/* New Folder Input */}
      {isCreatingFolder && (
          <div className="px-3 pb-2 animate-in slide-in-from-top-2">
              <div className="flex items-center gap-1 bg-white border border-indigo-200 rounded-md px-2 py-1 shadow-sm">
                  <Folder size={14} className="text-indigo-400" />
                  <input 
                    autoFocus
                    className="flex-1 text-xs bg-transparent outline-none min-w-0"
                    placeholder="Folder Name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateFolderConfirm();
                        if (e.key === 'Escape') setIsCreatingFolder(false);
                    }}
                    onBlur={handleCreateFolderConfirm}
                  />
              </div>
          </div>
      )}

      <div className="flex-1 overflow-y-auto py-2 scrollbar-hide flex flex-col">
         {/* Root Drop Zone Wraps Entire Tree */}
         <div className="px-2 flex-1 flex flex-col min-h-0">
             <RootDropZone onDrop={reorderNode} className="flex-1 pb-10">
                {rootNodes.length === 0 && !isCreatingFolder && (
                    <div className="px-4 text-xs text-zinc-400 italic py-4 text-center">Empty Workspace</div>
                )}
                {rootNodes.map(node => (
                    node.isFolder ? (
                        <FolderNode 
                            key={node.id} 
                            node={node} 
                            activeId={activeFileId} 
                            onSelect={handleFileClick} 
                            onDrop={reorderNode}
                        />
                    ) : (
                        <DraggableFileItem 
                            key={node.id} 
                            file={node.file!} 
                            activeId={activeFileId} 
                            onSelect={handleFileClick} 
                            onDrop={reorderNode}
                        />
                    )
                ))}
             </RootDropZone>
         </div>
      </div>

      {/* Session Files */}
      <SessionArtifactsSection files={sessionFiles} activeId={activeFileId} onSelect={handleFileClick} />
    </div>
  );
};

// --- Session Artifacts ---
interface SessionArtifactsSectionProps { 
    files: AppFile[]; 
    activeId: string | null; 
    onSelect: (id: string) => void; 
}

const SessionArtifactsSection: React.FC<SessionArtifactsSectionProps> = ({ 
    files, 
    activeId, 
    onSelect 
}) => {
    const [isOpen, setIsOpen] = useState(true);
    
    if (files.length === 0) return null;

    return (
        <div className="mt-auto border-t border-zinc-200 bg-zinc-100/50 flex-shrink-0">
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-zinc-100 transition-colors"
            >
                <div className="text-zinc-400">
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                <Archive size={14} className="text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Session Artifacts</span>
                <span className="ml-auto text-[10px] bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded-full">
                    {files.length}
                </span>
            </div>

            {isOpen && (
                <div className="px-2 pb-4 space-y-0.5 max-h-72 overflow-y-auto">
                    {files.map(f => (
                         <SessionFileItem key={f.id} file={f} activeId={activeId} onSelect={onSelect} />
                    ))}
                </div>
            )}
        </div>
    );
};

interface SessionFileItemProps { 
    file: AppFile; 
    activeId: string | null; 
    onSelect: (id: string) => void;
}

const SessionFileItem: React.FC<SessionFileItemProps> = ({ file, activeId, onSelect }) => {
    // Session files are draggable but NOT drop targets
    const dragItem: DragItem = {
        type: 'FILE',
        id: file.id,
        fileType: file.type,
        origin: 'session'
    };
    const { onDragStart, onDragEnd, draggable } = useDraggable(dragItem);

    return (
        <div
            draggable={draggable}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => onSelect(file.id)}
            className={cn(
                "group flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-xs transition-all outline-none",
                activeId === file.id
                    ? "bg-white border border-zinc-200 shadow-sm text-zinc-900 font-medium"
                    : "text-zinc-500 hover:bg-zinc-200/50"
            )}
        >
            <FileIcon type={file.type} size={14} className={activeId === file.id ? "text-indigo-600" : "opacity-70"} />
            <span className="truncate">{file.name}</span>
        </div>
    );
}
