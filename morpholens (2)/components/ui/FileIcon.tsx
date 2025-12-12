
import React from "react";
import { FileImage, FileText, Database, StickyNote, Video, Headphones, FileCode } from "lucide-react";
import { FileType } from "../../types";
import { cn } from "../../lib/utils";

interface FileIconProps {
  type: FileType;
  className?: string;
  size?: number;
}

export const FileIcon: React.FC<FileIconProps> = ({ type, className, size = 16 }) => {
  switch (type) {
    case FileType.IMAGE: 
      return <FileImage size={size} className={cn("text-blue-600", className)} />;
    case FileType.DOCUMENT: 
      return <FileText size={size} className={cn("text-orange-600", className)} />;
    case FileType.DATASET: 
      return <Database size={size} className={cn("text-emerald-600", className)} />;
    case FileType.NOTE: 
      return <StickyNote size={size} className={cn("text-yellow-600", className)} />;
    case FileType.VIDEO:
      return <Video size={size} className={cn("text-purple-600", className)} />;
    case FileType.AUDIO:
      return <Headphones size={size} className={cn("text-pink-600", className)} />;
    default: 
      return <FileCode size={size} className={className} />;
  }
};
