
import React from "react";
import { AppState, AppActionType } from "../../types";
import { WorkSurfaceHeader } from "./components/WorkSurfaceHeader";
import { useDropZone } from "../../lib/dnd";
import { FileSearch } from "lucide-react";
import { getFileViewer } from "../../lib/registries/fileViewers";

interface WorkSurfacePanelProps {
  state: AppState;
  dispatch: React.Dispatch<any>;
  onMobileBack?: () => void;
  isSidebarOpen?: boolean;
}

export const WorkSurfacePanel: React.FC<WorkSurfacePanelProps> = ({ 
    state,
    dispatch,
    onMobileBack,
    isSidebarOpen = false
}) => {
  const activeFile = state.files.find((f) => f.id === state.activeFileId);

  const { handlers, isOver } = useDropZone({
      onDrop: (item) => {
          dispatch({ type: AppActionType.SET_ACTIVE_FILE, payload: item.id });
          dispatch({ type: AppActionType.SET_FILES_COLLAPSED, payload: true });
      }
  });

  const renderContent = () => {
    if (!activeFile) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center animate-in fade-in zoom-in-95 duration-500 h-full">
             <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 border border-zinc-200 shadow-sm">
                 <div className="w-8 h-8 rounded-full border-2 border-zinc-200"></div>
             </div>
             <h3 className="text-lg font-medium text-zinc-900 mb-1">Workspace Ready</h3>
             <p className="text-sm text-zinc-500 max-w-xs">
                 Select a file from the explorer or ask Copilot to open one.
             </p>
          </div>
        );
    }

    const Viewer = getFileViewer(activeFile.type);
    if (Viewer) {
        return <Viewer file={activeFile} dispatch={dispatch} onBack={onMobileBack} />;
    }

    return (
        <div className="flex-1 flex items-center justify-center text-muted-foreground h-full">
            <p>Preview not available for this file type.</p>
        </div>
    );
  };

  return (
    <div 
        className="flex-1 h-full w-full bg-[#FAFAFA] relative z-0"
        {...handlers}
    >
      <WorkSurfaceHeader activeFile={activeFile} onBack={onMobileBack} />
      
      <div className="absolute inset-0 z-0">
        {renderContent()}
      </div>

      {isOver && (
          <div className="absolute inset-0 z-50 bg-emerald-50/80 backdrop-blur-sm flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-emerald-700 animate-in zoom-in-95 duration-200">
                  <div className="p-4 bg-emerald-100 rounded-full">
                    <FileSearch size={48} />
                  </div>
                  <span className="font-semibold text-lg">Drop to Open</span>
              </div>
          </div>
      )}
    </div>
  );
};
