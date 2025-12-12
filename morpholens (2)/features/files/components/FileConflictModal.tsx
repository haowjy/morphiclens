
import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { AppFile } from "../../../types";

interface FileConflictModalProps {
  filename: string;
  existingFile: AppFile;
  onReplace: () => void;
  onKeepBoth: () => void;
  onCancel: () => void;
}

export const FileConflictModal: React.FC<FileConflictModalProps> = ({
  filename,
  existingFile,
  onReplace,
  onKeepBoth,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle size={18} />
            <span className="font-semibold text-sm">File Conflict</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8 hover:bg-zinc-200 rounded-full">
            <X size={16} />
          </Button>
        </div>

        <div className="p-6">
          <p className="text-zinc-700 text-sm leading-relaxed mb-4">
            A file named <span className="font-semibold text-zinc-900">{filename}</span> already exists in this location.
          </p>
          <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100 mb-6">
            <div className="text-xs text-zinc-500 mb-1">Existing file:</div>
            <div className="text-sm font-medium text-zinc-800 flex items-center gap-2">
                 <span className="truncate">{existingFile.name}</span>
                 <span className="text-zinc-400">•</span>
                 <span className="text-xs text-zinc-400 font-normal uppercase">{existingFile.type}</span>
            </div>
            <div className="text-xs text-zinc-400 mt-1">
                Last modified: {new Date(existingFile.createdAt || Date.now()).toLocaleDateString()}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button 
                variant="primary" 
                className="w-full justify-center bg-zinc-900 hover:bg-zinc-800"
                onClick={onReplace}
            >
                Replace
            </Button>
            <Button 
                variant="secondary" 
                className="w-full justify-center"
                onClick={onKeepBoth}
            >
                Keep Both
            </Button>
            <Button 
                variant="ghost" 
                className="w-full justify-center text-zinc-500 hover:text-zinc-900"
                onClick={onCancel}
            >
                Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
