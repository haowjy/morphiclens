
import React, { useRef } from "react";
import { AppState, ThreadContent, AppActionType, ChatThread, AppFile, FileType, ThreadTurn, ThreadPart, ChatMode, ModelId } from "../../../types";
import { generateId } from "../../../lib/utils";
import { db } from "../../../lib/db";
import { streamMessageToGemini } from "../../../services/gemini/chatService"; 
import { extractPythonBlocks } from "../../../lib/agent/responseParser"; 
import { pythonTool } from "../tools/pythonTool"; 
import { getTool } from "../tools/registry";
import { SYSTEM_OUTPUT_PREFIX } from "../../../constants";
import { roleRegistry } from "../../../services/roles/registry";
import { pyodideService } from "../../../services/pyodideService";

export function useAgentChat(state: AppState, dispatch: React.Dispatch<any>) {
    const isProcessingRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const upsertTurn = async (threadId: string, turn: ThreadTurn) => {
        const exists = state.turnsByThread[threadId]?.some(t => t.id === turn.id);
        if (exists) {
            dispatch({ type: AppActionType.UPDATE_TURN, payload: { threadId, turn } });
        } else {
            dispatch({ type: AppActionType.ADD_TURN, payload: { threadId, turn } });
        }

        const dbMessages = turn.contents.map(c => ({
            id: c.id,
            threadId,
            turnId: turn.id,
            role: c.role,
            parts: c.parts,
            timestamp: c.timestamp
        }));
        
        await db.messages.bulkPut(dbMessages);
    };

    const stopGeneration = () => {
        if (abortControllerRef.current) {
            console.log("[Agent] Stopping generation...");
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    };

    const handleFileUploadUpdate = (id: string, providerMetadata: any) => {
        dispatch({ 
            type: AppActionType.UPDATE_FILE_UPLOAD_STATUS, 
            payload: { id, providerMetadata }
        });
    };

    const runChatLoop = async (
        threadId: string, 
        currentTurn: ThreadTurn, 
        inputPayload: string | { toolResponse: any, additionalParts?: ThreadPart[] }, 
        historyBeforeTurn: ThreadContent[], 
        allFiles: AppFile[],
        contextFiles: AppFile[],
        roleId: string,
        modelId?: string
    ) => {
        if (abortControllerRef.current?.signal.aborted) return;

        // Ensure role is loaded in Pyodide
        const role = roleRegistry.getRole(roleId);
        await pyodideService.loadRole(role);

        const modelContentId = generateId();
        let modelContent: ThreadContent = {
            id: modelContentId,
            role: 'model',
            parts: [],
            timestamp: Date.now(),
            turnId: currentTurn.id
        };

        const updatedTurnWithModel = {
            ...currentTurn,
            contents: [...currentTurn.contents, modelContent]
        };
        await upsertTurn(threadId, updatedTurnWithModel);

        try {
            // Filter out content that we are about to send via streamMessageToGemini (to avoid dupes)
            // or content that is part of the current active response generation
            const contentsToIncludeInHistory = currentTurn.contents.filter(c => {
                if (c.id === modelContentId) return false; 
                if (typeof inputPayload === 'string' && c.role === 'user') return false; 
                
                // If we are sending a tool response, we must NOT include the tool response part 
                // in the history array passed to 'chat.history', because 'chat.sendMessageStream'
                // will append it as the new message.
                if (typeof inputPayload !== 'string' && c.role === 'tool') {
                    const hasMatchingId = c.parts.some(p => 
                        p.functionResponse?.id === inputPayload.toolResponse.id
                    );
                    if (hasMatchingId) return false;
                }
                return true;
            });

            const historyForApi = [
                ...historyBeforeTurn,
                ...contentsToIncludeInHistory
            ];

            const stream = streamMessageToGemini(
                historyForApi, 
                inputPayload, 
                allFiles, 
                contextFiles, 
                role,
                abortControllerRef.current?.signal,
                handleFileUploadUpdate,
                modelId 
            );
            
            let finalParts: ThreadPart[] = [];
            
            for await (const updatedParts of stream) {
                if (abortControllerRef.current?.signal.aborted) break;

                finalParts = updatedParts;
                modelContent = { ...modelContent, parts: updatedParts };
                
                const turnInProgress = {
                    ...updatedTurnWithModel,
                    contents: updatedTurnWithModel.contents.map(c => 
                        c.id === modelContentId ? modelContent : c
                    )
                };
                
                dispatch({ type: AppActionType.UPDATE_TURN, payload: { threadId, turn: turnInProgress } });
            }

            const turnAfterStream = {
                ...updatedTurnWithModel,
                contents: updatedTurnWithModel.contents.map(c => 
                    c.id === modelContentId ? modelContent : c
                )
            };
            await upsertTurn(threadId, turnAfterStream);

            if (abortControllerRef.current?.signal.aborted) {
                 const interruptedTurn = { ...turnAfterStream, status: 'complete' as const };
                 await upsertTurn(threadId, interruptedTurn);
                 return;
            }

            const functionCalls = finalParts.filter(p => p.functionCall);
            if (functionCalls.length > 0) {
                 // Execute the first function call found.
                 // TODO: Support parallel function calls if needed by iterating or batching.
                 // For now, handling one ensures cleaner recursive state.
                 const callPart = functionCalls[0];
                 const call = callPart.functionCall!;
                 const tool = getTool(call.name);
                 
                 let toolResult: any = { result: "Tool not found" };
                 const generatedAppFiles: AppFile[] = [];

                 if (tool) {
                     console.log(`[Agent] Executing Tool: ${tool.name}`);
                     try {
                        const result = await tool.execute(call.args, {
                            files: allFiles,
                            activeThreadId: threadId,
                            activeFileId: state.activeFileId
                        });
                        
                        if (result.images) {
                            for (const img of result.images) {
                                const fileId = generateId();
                                const newFile: AppFile = {
                                    id: fileId,
                                    name: img.name,
                                    type: FileType.IMAGE,
                                    mimeType: img.blob.type, 
                                    category: img.category, 
                                    virtualPath: img.virtualPath,
                                    url: URL.createObjectURL(img.blob),
                                    status: 'Generated',
                                    threadId: img.category === 'session' ? threadId : undefined, 
                                    createdAt: Date.now()
                                };
                                generatedAppFiles.push(newFile);
                                dispatch({ type: AppActionType.ADD_FILE, payload: newFile });
                                await db.files.add({ ...newFile, blob: img.blob } as any);
                            }
                        }
                        
                        toolResult = { result: result.result };

                     } catch (e: any) {
                         toolResult = { error: e.message };
                     }
                 } else {
                     // Catch hallucinations for role builder functions
                     if (call.name === 'test_code') {
                         toolResult = { result: "System Error: `test_code` is NOT a valid tool. You must use a `python:run` block to execute `role_builder.test_code(...)`." };
                     } else if (call.name === 'build_role') {
                         toolResult = { result: "System Error: `build_role` is NOT a valid tool. You must use a `python:run` block to execute `role_builder.build_role(...)`." };
                     } else {
                         toolResult = { result: `Tool '${call.name}' not found. Please verify the tool name.` };
                     }
                 }

                 const responseParts: ThreadPart[] = [{
                     functionResponse: {
                         name: call.name,
                         response: toolResult,
                         id: call.id
                     }
                 }];

                 const additionalParts: ThreadPart[] = [];
                 
                 if (generatedAppFiles.length > 0) {
                     additionalParts.push({ 
                         text: `[System] The tool generated ${generatedAppFiles.length} image(s). See attached content.` 
                     });
                     generatedAppFiles.forEach(f => {
                         additionalParts.push({ fileId: f.id });
                     });
                     
                     // Add to UI history but DO NOT send to API with functionResponse to avoid validation errors
                     responseParts.push(...additionalParts);
                 }

                 const responseContent: ThreadContent = {
                     id: generateId(),
                     role: 'tool',
                     turnId: currentTurn.id,
                     timestamp: Date.now(),
                     parts: responseParts
                 };
                 
                 const turnWithToolResponse = {
                     ...turnAfterStream,
                     contents: [...turnAfterStream.contents, responseContent]
                 };
                 await upsertTurn(threadId, turnWithToolResponse);

                 await runChatLoop(
                    threadId,
                    turnWithToolResponse,
                    { 
                        toolResponse: responseContent.parts[0].functionResponse,
                        additionalParts: undefined // Ensure strict sequence for API
                    },
                    historyBeforeTurn,
                    [...allFiles, ...generatedAppFiles],
                    generatedAppFiles,
                    roleId,
                    modelId
                );
                return;
            }

            const allText = finalParts
                .filter(p => p.text)
                .map(p => p.text)
                .join('');

            const codeBlocksToExecute = extractPythonBlocks(allText);

            if (codeBlocksToExecute.length > 0) {
                if (abortControllerRef.current?.signal.aborted) return;

                const code = codeBlocksToExecute[0]; 
                console.log(`[Agent] Detected Client-Side Python Block. Executing...`);

                let toolResultString = "";
                const generatedAppFiles: AppFile[] = [];
                
                try {
                     const { result, images, layers, data } = await pythonTool.execute(
                         { code }, 
                         { 
                            files: allFiles, 
                            activeThreadId: threadId,
                            activeFileId: state.activeFileId 
                         }
                     );
                     toolResultString = result;

                     if (images) {
                         for (const img of images) {
                             const fileId = generateId();
                             const newFile: AppFile = {
                                 id: fileId,
                                 name: img.name,
                                 type: FileType.IMAGE,
                                 mimeType: img.blob.type, 
                                 category: img.category, 
                                 virtualPath: img.virtualPath,
                                 url: URL.createObjectURL(img.blob),
                                 status: 'Generated',
                                 threadId: img.category === 'session' ? threadId : undefined, 
                                 createdAt: Date.now()
                             };
                             generatedAppFiles.push(newFile);
                             dispatch({ type: AppActionType.ADD_FILE, payload: newFile });
                             await db.files.add({ ...newFile, blob: img.blob } as any);
                         }
                     }

                     if (layers && layers.length > 0) {
                         const layersByFile: Record<string, any[]> = {};
                         for (const l of layers) {
                             if (!layersByFile[l.fileId]) layersByFile[l.fileId] = [];
                             layersByFile[l.fileId].push(l.layer);
                         }

                         for (const [fileId, newFileLayers] of Object.entries(layersByFile)) {
                             newFileLayers.forEach(layer => {
                                 dispatch({ 
                                     type: AppActionType.ADD_LAYER, 
                                     payload: { fileId, layer } 
                                 });
                             });

                             const targetFile = allFiles.find(f => f.id === fileId);
                             if (targetFile) {
                                 const existingLayers = targetFile.analysis?.layers || [];
                                 const combinedLayers = [...existingLayers, ...newFileLayers];
                                 const updatedAnalysis = { ...targetFile.analysis, layers: combinedLayers };
                                 
                                 await db.files.update(fileId, { 
                                     metadata: { ...targetFile.metadata, analysis: updatedAnalysis } 
                                 });
                             }
                         }
                     }
                     
                     if (data) {
                         if (data.type === 'analysis_result') {
                             if (data.target_file && data.metrics) {
                                 dispatch({
                                     type: AppActionType.UPDATE_FILE_METADATA,
                                     payload: { 
                                         id: data.target_file, 
                                         metadata: data.metrics 
                                     }
                                 });
                                 const fileToUpdate = allFiles.find(f => f.id === data.target_file || f.name === data.target_file);
                                 if (fileToUpdate) {
                                     await db.files.update(fileToUpdate.id, { metadata: data.metrics });
                                 }
                             }
                         }

                         if (data.attachedArtifacts && Array.isArray(data.attachedArtifacts)) {
                             for (const att of data.attachedArtifacts) {
                                 dispatch({
                                     type: AppActionType.ATTACH_RELATED_FILE,
                                     payload: { fileId: att.fileId, artifact: att.artifact }
                                 });

                                 const targetFile = allFiles.find(f => f.id === att.fileId);
                                 if (targetFile) {
                                     const currentArtifacts = targetFile.analysis?.artifacts || [];
                                     const updatedAnalysis = { ...targetFile.analysis, artifacts: [...currentArtifacts, att.artifact] };
                                     await db.files.update(targetFile.id, { 
                                        metadata: { ...targetFile.metadata, analysis: updatedAnalysis }
                                     });
                                 }
                             }
                         }
                         
                         if (data.layerDataUpdates && Array.isArray(data.layerDataUpdates)) {
                             for (const update of data.layerDataUpdates) {
                                 const updates = { 
                                     metrics: { blocks: update.blocks } 
                                 };
                                 
                                 dispatch({
                                     type: AppActionType.UPDATE_LAYER,
                                     payload: { 
                                         fileId: update.fileId, 
                                         layerId: update.layerId,
                                         updates
                                     }
                                 });
                                 
                                 const targetFile = allFiles.find(f => f.id === update.fileId);
                                 if (targetFile) {
                                     const existingLayers = targetFile.analysis?.layers || [];
                                     const updatedLayers = existingLayers.map(l => 
                                        l.id === update.layerId ? { ...l, metrics: updates.metrics } : l
                                     );
                                     const updatedAnalysis = { ...targetFile.analysis, layers: updatedLayers };
                                     await db.files.update(targetFile.id, {
                                         metadata: { ...targetFile.metadata, analysis: updatedAnalysis }
                                     });
                                 }
                             }
                         }
                     }
                } catch (err: any) {
                     console.error(`[Agent] Python execution failed:`, err);
                     toolResultString = `Error executing Python code: ${err.message}`;
                }

                if (abortControllerRef.current?.signal.aborted) {
                     const interruptedTurn = { ...turnAfterStream, status: 'complete' as const };
                     await upsertTurn(threadId, interruptedTurn);
                     return;
                }

                const feedbackParts: ThreadPart[] = [{ 
                    text: `${SYSTEM_OUTPUT_PREFIX}\n${toolResultString}`
                }];

                generatedAppFiles.forEach(f => {
                    feedbackParts.push({ fileId: f.id });
                });

                const systemFeedbackContent: ThreadContent = {
                    id: generateId(),
                    role: 'user', 
                    turnId: currentTurn.id,
                    timestamp: Date.now(),
                    parts: feedbackParts
                };

                const turnWithFeedback = {
                    ...turnAfterStream,
                    contents: [...turnAfterStream.contents, systemFeedbackContent]
                };
                await upsertTurn(threadId, turnWithFeedback);

                await runChatLoop(
                    threadId,
                    turnWithFeedback,
                    systemFeedbackContent.parts[0].text!, 
                    historyBeforeTurn, 
                    [...allFiles, ...generatedAppFiles],
                    generatedAppFiles,
                    roleId,
                    modelId
                );
                return;
            }

            const completedTurn = { ...turnAfterStream, status: 'complete' as const };
            await upsertTurn(threadId, completedTurn);

        } catch (e) {
            console.error("Chat Loop Error:", e);
            const errorTurn = { ...currentTurn, status: 'error' as const };
            await upsertTurn(threadId, errorTurn);
        }
    };

    const sendMessage = async (content: string, roleId: string, contextFiles: AppFile[], initialModel?: ModelId) => {
        if (isProcessingRef.current) return;
        
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        let threadId = state.activeThreadId;
        let threadConfig = state.threads.find(t => t.id === threadId)?.config;
        
        let currentFiles = state.files;

        if (!threadId) {
            threadId = generateId();
            const newThread: ChatThread = {
                id: threadId,
                title: content.slice(0, 30) || "New Chat",
                updatedAt: Date.now(),
                preview: content,
                config: { model: initialModel || 'gemini-3-pro-preview', roleId } 
            };
            threadConfig = newThread.config;
            dispatch({ type: AppActionType.CREATE_THREAD, payload: newThread });
            dispatch({ type: AppActionType.SET_ACTIVE_THREAD, payload: threadId });
            await db.threads.add(newThread);

            const orphanFiles = state.files.filter(f => f.category === 'session' && !f.threadId);
            if (orphanFiles.length > 0) {
                currentFiles = state.files.map(f => {
                    if (f.category === 'session' && !f.threadId) {
                        return { ...f, threadId: threadId! };
                    }
                    return f;
                });

                for (const f of orphanFiles) {
                    await db.files.update(f.id, { threadId });
                    dispatch({ 
                        type: AppActionType.REPLACE_FILE, 
                        payload: { ...f, threadId } 
                    });
                }
            }
        }

        dispatch({ type: AppActionType.SET_LOADING, payload: true });

        const userTurnId = generateId();
        const userParts: ThreadPart[] = [{ text: content }];
        contextFiles.forEach(f => { userParts.push({ fileId: f.id }); });

        const userTurn: ThreadTurn = {
            id: userTurnId,
            threadId,
            type: 'user',
            status: 'complete',
            contents: [{
                id: generateId(),
                role: 'user',
                parts: userParts,
                timestamp: Date.now(),
                turnId: userTurnId
            }]
        };
        await upsertTurn(threadId, userTurn);

        const assistantTurnId = generateId();
        const assistantTurn: ThreadTurn = {
            id: assistantTurnId,
            threadId,
            type: 'assistant',
            status: 'streaming',
            contents: [] 
        };

        const previousTurns = state.turnsByThread[threadId] || [];
        const history = previousTurns.flatMap(t => t.contents);
        
        await runChatLoop(
            threadId, 
            assistantTurn, 
            content, 
            history, 
            currentFiles, 
            contextFiles, 
            roleId,
            threadConfig?.model
        );
        
        abortControllerRef.current = null;
        dispatch({ type: AppActionType.SET_LOADING, payload: false });
    };

    return { sendMessage, stopGeneration };
}
