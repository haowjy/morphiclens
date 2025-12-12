
import React from 'react';
import { AppFile, FileType } from "../../types";
import { ImageViewer } from "../../features/work-surface/components/ImageViewer";
import { DocumentViewer } from "../../features/work-surface/components/DocumentViewer";
import { MediaViewer } from "../../features/work-surface/components/MediaViewer";

export interface FileViewerProps {
    file: AppFile;
    dispatch: React.Dispatch<any>;
    onBack?: () => void;
}

const REGISTRY: Partial<Record<FileType, React.FC<FileViewerProps>>> = {
    [FileType.IMAGE]: ImageViewer,
    [FileType.DOCUMENT]: DocumentViewer,
    [FileType.NOTE]: DocumentViewer,
    [FileType.VIDEO]: MediaViewer,
    [FileType.AUDIO]: MediaViewer
};

export const getFileViewer = (type: FileType) => REGISTRY[type] || null;

export const registerFileViewer = (type: FileType, component: React.FC<FileViewerProps>) => {
    REGISTRY[type] = component;
};
