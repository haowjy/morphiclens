
import React, { useState, useRef, useCallback } from "react";
import { AppFile, FileType, FileCategory, AppActionType } from "../../../types";
import { db } from "../../../lib/db";
import { VirtualPath } from "../../../lib/virtualPath";
import { pyodideService } from "../../../services/pyodideService";

interface ConflictState {
    file: File;
    existingFile: AppFile;
    category: FileCategory;
    threadId?: string;
    targetFolder?: string; 
}

type UploadAction = 'add' | 'replace';
type OnCompleteCallback = (file: AppFile, action: UploadAction) => void;

interface UseFileUploadProps {
    files: AppFile[];
    dispatch: React.Dispatch<any>;
}

export function useFileUpload({ files, dispatch }: UseFileUploadProps) {
    const [conflict, setConflict] = useState<ConflictState | null>(null);
    const onCompleteRef = useRef<OnCompleteCallback | null>(null);

    // Calculate expected virtual path using central utility
    const getExpectedPath = useCallback((name: string, category: FileCategory, targetFolder?: string) => {
         if (category === 'project') {
             const root = '/workspace/data';
             const parent = targetFolder ? VirtualPath.join(root, targetFolder) : root;
             return VirtualPath.join(parent, name);
         } else {
             return VirtualPath.join('/.session', name);
         }
    }, []);

    const checkCollision = useCallback((name: string, category: FileCategory, threadId?: string, targetFolder?: string) => {
        const expectedPath = getExpectedPath(name, category, targetFolder);

        return files.find(f => {
            // 1. Strict Path Match
            if (f.virtualPath === expectedPath) return true;

            // 2. Legacy fallback
            if (!f.virtualPath && f.name === name) {
                 if (category === 'project' && f.category === 'project') return true;
                 if (category === 'session' && f.category === 'session' && f.threadId === threadId) return true;
            }
            return false;
        });
    }, [files, getExpectedPath]);

    const generateSafeName = useCallback((originalName: string, category: FileCategory, threadId?: string, targetFolder?: string) => {
        let finalName = originalName;
        let counter = 1;
        
        while (checkCollision(finalName, category, threadId, targetFolder)) {
             const extIndex = originalName.lastIndexOf('.');
             if (extIndex !== -1) {
                 finalName = `${originalName.substring(0, extIndex)}_${counter}${originalName.substring(extIndex)}`;
             } else {
                 finalName = `${originalName}_${counter}`;
             }
             counter++;
        }
        return finalName;
    }, [checkCollision]);

    const detectFileType = (file: File): FileType => {
        if (file.type.startsWith('image/')) return FileType.IMAGE;
        if (file.type.startsWith('video/')) return FileType.VIDEO;
        if (file.type.startsWith('audio/')) return FileType.AUDIO;
        
        // Extension fallback for types browsers miss (avi, mkv, etc)
        const name = file.name.toLowerCase();
        if (name.endsWith('.avi') || name.endsWith('.mkv') || name.endsWith('.mov') || name.endsWith('.mp4')) return FileType.VIDEO;
        if (name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.ogg')) return FileType.AUDIO;

        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) return FileType.DOCUMENT;
        if (file.name.endsWith('.md')) return FileType.NOTE;
        return FileType.DOCUMENT;
    };

    const processUpload = useCallback(async (
        file: File, 
        name: string, 
        category: FileCategory, 
        threadId: string | undefined,
        targetFolder?: string,
        replaceTargetId?: string
    ) => {
        const now = Date.now();
        const id = replaceTargetId || Math.random().toString(36).substring(2);
        const virtualPath = getExpectedPath(name, category, targetFolder);

        const appFile: AppFile = {
            id,
            name,
            type: detectFileType(file),
            mimeType: file.type || 'application/octet-stream', // Ensure fallback mime
            category,
            threadId,
            virtualPath,
            url: URL.createObjectURL(file),
            status: 'Ready',
            createdAt: now
        };

        const action: UploadAction = replaceTargetId ? 'replace' : 'add';

        // 1. Dispatch
        if (action === 'add') {
            dispatch({ type: AppActionType.ADD_FILE, payload: appFile });
        } else {
            dispatch({ type: AppActionType.REPLACE_FILE, payload: appFile });
        }

        // 2. DB Persist
        try {
            const fileData = {
                ...appFile,
                blob: file
            };
            // Remove URL before saving to IndexedDB (blobs are stored directly)
            delete (fileData as any).url;

            if (action === 'add') {
                await db.files.add(fileData as any);
            } else {
                await db.files.put(fileData as any);
            }
        } catch (err) {
            console.error("Failed to persist file upload", err);
        }

        // 3. Callback
        if (onCompleteRef.current) {
            onCompleteRef.current(appFile, action);
        }

        // 4. Automatic TIF Conversion
        // TIFs cannot be natively previewed in browsers, so we auto-convert them to PNG via Pyodide
        const lowerName = appFile.name.toLowerCase();
        if (lowerName.endsWith('.tif') || lowerName.endsWith('.tiff')) {
            console.log(`[Upload] Detected TIF file. Queueing auto-conversion for ${appFile.name}...`);
            
            // Non-blocking conversion
            pyodideService.mountFile(appFile).then(async () => {
                try {
                    const blob = await pyodideService.convertImageToPng(appFile.virtualPath!);
                    const pngUrl = URL.createObjectURL(blob);
                    
                    console.log(`[Upload] TIF Converted: ${appFile.name}`);

                    const updatedFile = {
                        ...appFile,
                        preview: { url: pngUrl, generatedAt: Date.now() }
                    };

                    dispatch({
                        type: AppActionType.REPLACE_FILE,
                        payload: updatedFile
                    });

                } catch (e) {
                    console.warn(`[Upload] Failed to auto-convert TIF: ${appFile.name}`, e);
                }
            }).catch(e => {
                console.warn(`[Upload] Failed to mount TIF for conversion: ${appFile.name}`, e);
            });
        }
    }, [dispatch, getExpectedPath]);

    const handleUpload = useCallback((
        file: File, 
        category: FileCategory, 
        threadId?: string, 
        onComplete?: OnCompleteCallback, 
        targetFolder?: string 
    ) => {
        onCompleteRef.current = onComplete || null;

        const existing = checkCollision(file.name, category, threadId, targetFolder);
        
        if (existing) {
            setConflict({
                file,
                existingFile: existing,
                category,
                threadId,
                targetFolder
            });
        } else {
            processUpload(file, file.name, category, threadId, targetFolder);
        }
    }, [checkCollision, processUpload]);

    const resolveConflict = useCallback((decision: 'replace' | 'keepBoth' | 'cancel') => {
        if (!conflict) return;

        if (decision === 'cancel') {
            setConflict(null);
            onCompleteRef.current = null;
            return;
        }

        if (decision === 'replace') {
            processUpload(
                conflict.file, 
                conflict.existingFile.name, 
                conflict.category, 
                conflict.threadId, 
                conflict.targetFolder,
                conflict.existingFile.id
            );
        } else {
            const safeName = generateSafeName(conflict.file.name, conflict.category, conflict.threadId, conflict.targetFolder);
            processUpload(
                conflict.file, 
                safeName, 
                conflict.category, 
                conflict.threadId,
                conflict.targetFolder
            );
        }
        
        setConflict(null);
    }, [conflict, processUpload, generateSafeName]);

    return {
        handleUpload,
        conflict,
        resolveConflict
    };
}
