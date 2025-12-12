
import React from "react";
import { ArrowLeft, Download, Maximize2 } from "lucide-react";
import { AppFile, FileType } from "../../../types";
import { FileIcon } from "../../../components/ui/FileIcon";
import { FloatingToolbar, ToolbarButton, ToolbarSeparator } from "./FloatingToolbar";

interface WorkSurfaceHeaderProps {
  activeFile: AppFile | undefined;
  onBack?: () => void;
}

export const WorkSurfaceHeader: React.FC<WorkSurfaceHeaderProps> = ({
  activeFile,
  onBack,
}) => {
  if (!activeFile) return null;
  
  // For images, we now show controls inside the ImageViewer toolbar directly
  // So we don't render this header for images to avoid duplication.
  if (activeFile.type === FileType.IMAGE) return null;

  return (
    <FloatingToolbar>
        {onBack && (
            <div className="md:hidden mr-1">
                <ToolbarButton onClick={onBack}>
                    <ArrowLeft size={16} />
                </ToolbarButton>
            </div>
        )}

        <div className="flex items-center gap-2 pl-2 pr-2">
            <FileIcon type={activeFile.type} size={16} />
            <span className="font-semibold text-sm text-zinc-800 max-w-[200px] truncate">
                {activeFile.name}
            </span>
        </div>

        <ToolbarSeparator />

        <div className="flex items-center gap-0.5">
             {activeFile.type === FileType.DOCUMENT && (
                 <ToolbarButton title="Download">
                    <Download size={16} />
                 </ToolbarButton>
             )}
              
             {activeFile.type !== FileType.DOCUMENT && (
                 <ToolbarButton title="Maximize">
                    <Maximize2 size={16} />
                 </ToolbarButton>
             )}
        </div>
    </FloatingToolbar>
  );
};
