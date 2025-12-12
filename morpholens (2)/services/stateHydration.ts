
import React, { useEffect, useState } from 'react';
import { db, DBThreadContent } from '../lib/db';
import { AppActionType, AppFile, FileType, ThreadTurn, ThreadContent } from '../types';
import { INITIAL_FILES } from '../constants';
import { pyodideService } from './pyodideService';
import { loadPreferences } from '../lib/preferences';

export function useHydration(dispatch: React.Dispatch<any>) {
    const [isDbReady, setIsDbReady] = useState(false);
    const prefs = loadPreferences();

    useEffect(() => {
        const init = async () => {
            try {
                await (db as any).open();
                await db.seedIfEmpty(); 

                const dbThreads = await db.threads.orderBy('updatedAt').reverse().toArray();
                const dbMessages = await db.messages.toArray();
                const dbFiles = await db.files.orderBy('createdAt').reverse().toArray();

                const turnsByThread: Record<string, ThreadTurn[]> = {};
                const msgsByTurn: Record<string, ThreadContent[]> = {};
                
                dbMessages.forEach((msg: DBThreadContent) => {
                    if (!msgsByTurn[msg.turnId]) msgsByTurn[msg.turnId] = [];
                    msgsByTurn[msg.turnId].push({
                        id: msg.id,
                        role: msg.role,
                        parts: msg.parts,
                        timestamp: msg.timestamp,
                        turnId: msg.turnId
                    });
                });

                Object.values(msgsByTurn).forEach(list => list.sort((a,b) => a.timestamp - b.timestamp));

                const processedTurnIds = new Set<string>();
                dbMessages.forEach(msg => {
                    if (processedTurnIds.has(msg.turnId)) return;
                    processedTurnIds.add(msg.turnId);
                    
                    const contents = msgsByTurn[msg.turnId];
                    const type = contents[0]?.role === 'user' ? 'user' : 'assistant';
                    
                    if (!turnsByThread[msg.threadId]) turnsByThread[msg.threadId] = [];
                    turnsByThread[msg.threadId].push({
                        id: msg.turnId,
                        threadId: msg.threadId,
                        type,
                        status: 'complete',
                        contents
                    });
                });
                
                Object.values(turnsByThread).forEach(list => {
                    list.sort((a,b) => (a.contents[0]?.timestamp || 0) - (b.contents[0]?.timestamp || 0));
                });

                const loadedFiles: AppFile[] = dbFiles.map(f => {
                    const base: AppFile = {
                        id: f.id,
                        name: f.name,
                        type: f.type,
                        mimeType: f.blob.type, 
                        category: f.category || 'project',
                        url: URL.createObjectURL(f.blob),
                        status: 'Ready',
                        threadId: f.threadId,
                        createdAt: f.createdAt, 
                        sortOrder: f.sortOrder || 0, 
                        virtualPath: f.virtualPath || (f.category === 'project' ? `/workspace/data/${f.name}` : `/.session/${f.name}`),
                        annotations: (f.metadata as any)?.annotations || []
                    };
                    
                    // Legacy migration: Ensure Layers exist
                    if (f.type === FileType.IMAGE) {
                        const analysis = (f.metadata as any)?.analysis || {
                            activeLayerId: 'layer-1',
                            layers: [
                                { id: 'base', name: f.name, type: 'RASTER', locked: true, style: { visible: true, opacity: 1 } },
                                { id: 'layer-1', name: 'Layer 1', type: 'VECTOR', source: base.annotations || [], style: { visible: true, opacity: 1 } }
                            ],
                            artifacts: []
                        };
                        return { ...base, analysis };
                    }
                    return base;
                });

                const finalFiles = loadedFiles.length > 0 ? loadedFiles : INITIAL_FILES;
                
                let effectiveThreadId = prefs.activeThreadId;
                if (!effectiveThreadId || !dbThreads.some(t => t.id === effectiveThreadId)) {
                    effectiveThreadId = dbThreads.length > 0 ? dbThreads[0].id : null;
                }

                dispatch({
                    type: AppActionType.HYDRATE,
                    payload: {
                        threads: dbThreads,
                        turnsByThread,
                        files: finalFiles,
                        activeThreadId: effectiveThreadId,
                        activeFileId: prefs.activeFileId 
                    }
                });

                setIsDbReady(true);
                pyodideService.initialize();

            } catch (e) {
                console.error("DB Init Failed", e);
            }
        };
        init();
    }, [dispatch]);

    return isDbReady;
}
