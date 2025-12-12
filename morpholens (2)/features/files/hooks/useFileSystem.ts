import React from 'react';
import { AppActionType, AppFile, AppState, FileType } from "../../../types";
import { db } from "../../../lib/db";
import { pyodideService } from "../../../services/pyodideService";
import { VirtualPath } from "../../../lib/virtualPath";

/**
 * Hook to manage File System operations.
 */
export function useFileSystem(dispatch: React.Dispatch<any>, state: AppState) {
    
    const createFolder = async (name: string, parentPath: string = '/workspace/data') => {
        const fullPath = VirtualPath.join(parentPath, name);
        
        const exists = state.files.some(f => f.virtualPath === fullPath);
        if (exists) {
            console.warn(`[FileSystem] Folder already exists: ${fullPath}`);
            return;
        }

        const siblings = state.files.filter(f => VirtualPath.dirname(f.virtualPath || '') === parentPath);
        const maxOrder = siblings.reduce((max, f) => Math.max(max, f.sortOrder || 0), 0);

        const folder: AppFile = {
            id: Math.random().toString(36).substring(2),
            name,
            type: FileType.FOLDER,
            category: 'project',
            url: '', 
            virtualPath: fullPath,
            createdAt: Date.now(),
            sortOrder: maxOrder + 1000
        };

        dispatch({ type: AppActionType.ADD_FILE, payload: folder });
        
        try {
            await db.files.add({ ...folder, blob: new Blob() } as any);
            await pyodideService.createDirectory(fullPath);
        } catch (error) {
            console.error("[FileSystem] Failed to create folder:", error);
        }
    };

    /**
     * Promotes a file from Session to Project (moves it).
     */
    const promoteFile = async (fileId: string, targetFolderId: string | null) => {
        const node = state.files.find(f => f.id === fileId);
        if (!node || !node.virtualPath) return;

        let targetPath = '/workspace/data';
        
        if (targetFolderId) {
            const folder = state.files.find(f => f.id === targetFolderId);
            if (folder && folder.virtualPath) {
                targetPath = folder.virtualPath;
            }
        }

        const newPath = VirtualPath.join(targetPath, node.name);
        
        // 1. Dispatch Move (State handles category change based on path)
        dispatch({
            type: AppActionType.MOVE_FILE,
            payload: { fileId, newVirtualPath: newPath }
        });

        // 2. Persist
        try {
            await db.files.update(fileId, { 
                virtualPath: newPath, 
                category: 'project',
                threadId: undefined // Remove thread scope as it's now project-wide
            });
            await pyodideService.renameNode(node.virtualPath, newPath);
        } catch (error) {
            console.error("[FileSystem] Failed to promote file:", error);
        }
    };

    const moveNode = async (nodeId: string, targetFolderId: string | null) => {
        const node = state.files.find(f => f.id === nodeId);
        if (!node || !node.virtualPath) return;

        // If cross-category move (session -> project), use promote logic
        if (node.category === 'session') {
            await promoteFile(nodeId, targetFolderId);
            return;
        }

        let targetPath = '/workspace/data';
        
        if (targetFolderId) {
            const folder = state.files.find(f => f.id === targetFolderId);
            if (folder && folder.virtualPath) {
                targetPath = folder.virtualPath;
            } else {
                console.warn("[FileSystem] Target folder not found");
                return;
            }
        }

        const newPath = VirtualPath.join(targetPath, node.name);
        
        const siblings = state.files.filter(f => VirtualPath.dirname(f.virtualPath || '') === targetPath);
        const maxOrder = siblings.reduce((max, f) => Math.max(max, f.sortOrder || 0), 0);
        const newOrder = maxOrder + 1000;

        dispatch({ 
            type: AppActionType.REORDER_FILE, 
            payload: { fileId: nodeId, newVirtualPath: newPath, sortOrder: newOrder } 
        });

        try {
            await db.files.update(nodeId, { virtualPath: newPath, sortOrder: newOrder });
            if (node.virtualPath !== newPath) {
                await pyodideService.renameNode(node.virtualPath, newPath);
            }
        } catch (error) {
             console.error("[FileSystem] Failed to move node:", error);
        }
    };

    const reorderNode = async (sourceId: string, targetId: string | null, position: 'before' | 'after' | 'inside') => {
        const sourceNode = state.files.find(f => f.id === sourceId);
        if (!sourceNode || !sourceNode.virtualPath) return;

        // Handle cross-category
        if (sourceNode.category === 'session') {
            // Reordering session files into project tree implies promotion
            if (targetId) {
                const targetNode = state.files.find(f => f.id === targetId);
                // If dropping on a folder, move inside
                if (targetNode?.type === FileType.FOLDER || position === 'inside') {
                    await promoteFile(sourceId, targetId);
                } else if (targetNode) {
                    // Dropped near a file, move to that file's parent
                     // We need to find the parent folder ID of the target
                     // This is tricky without a parent pointer, but we can infer from path
                     const parentPath = VirtualPath.dirname(targetNode.virtualPath!);
                     const parentFolder = state.files.find(f => f.virtualPath === parentPath);
                     await promoteFile(sourceId, parentFolder ? parentFolder.id : null);
                }
            } else {
                // Drop on root
                await promoteFile(sourceId, null);
            }
            return;
        }

        if (!targetId && position === 'inside') {
            await moveNode(sourceId, null);
            return;
        }

        const targetNode = state.files.find(f => f.id === targetId);
        if (!targetNode) return;

        if (position === 'inside') {
            if (targetNode.type === FileType.FOLDER) {
                await moveNode(sourceId, targetNode.id);
            }
            return;
        }

        const parentPath = VirtualPath.dirname(targetNode.virtualPath || '');
        const newVirtualPath = VirtualPath.join(parentPath, sourceNode.name);

        const siblings = state.files
            .filter(f => VirtualPath.dirname(f.virtualPath || '') === parentPath)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        
        const targetIndex = siblings.findIndex(f => f.id === targetId);
        if (targetIndex === -1) return;

        let newOrder = 0;
        const targetOrder = targetNode.sortOrder || 0;

        if (position === 'before') {
            const prevNode = siblings[targetIndex - 1];
            const prevOrder = prevNode ? (prevNode.sortOrder || 0) : (targetOrder - 1000);
            newOrder = (prevOrder + targetOrder) / 2;
        } else {
            const nextNode = siblings[targetIndex + 1];
            const nextOrder = nextNode ? (nextNode.sortOrder || 0) : (targetOrder + 1000);
            newOrder = (targetOrder + nextOrder) / 2;
        }

        dispatch({
            type: AppActionType.REORDER_FILE,
            payload: { fileId: sourceId, newVirtualPath, sortOrder: newOrder }
        });

        try {
            await db.files.update(sourceId, { virtualPath: newVirtualPath, sortOrder: newOrder });
            if (sourceNode.virtualPath !== newVirtualPath) {
                await pyodideService.renameNode(sourceNode.virtualPath, newVirtualPath);
            }
        } catch (error) {
            console.error("[FileSystem] Failed to reorder:", error);
        }
    };

    return { createFolder, moveNode, reorderNode, promoteFile };
}