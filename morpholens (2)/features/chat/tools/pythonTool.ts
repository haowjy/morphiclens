
import { Type } from "@google/genai";
import { AgentTool, ToolContext, ToolResult, GeneratedImage } from "./types";
import { pyodideService } from "../../../services/pyodideService";
import { generateId } from "../../../lib/utils";
import { AnalysisLayer } from "../../../types";

export const pythonTool: AgentTool = {
  name: "run_python",
  declaration: {
    name: "run_python",
    description: "Executes Python code in the Pyodide environment. Use 'core' module for basic ops and 'mlens' (if available) for biomedical tasks.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        code: {
          type: Type.STRING,
          description: "The Python code to execute."
        }
      },
      required: ["code"]
    }
  },
  execute: async (args: { code: string }, context: ToolContext): Promise<ToolResult> => {
    const { code } = args;

    if (context.activeThreadId) {
        await pyodideService.prepareEnvironment(context.activeThreadId, context.files);
    } else {
        await pyodideService.initialize();
    }
    
    await pyodideService.syncContext(context.files, context.activeFileId);

    const initialSnapshot = pyodideService.getFileSystemSnapshot();

    const { stdout, result, error } = await pyodideService.runCode(code);

    const newScannedFiles = pyodideService.scanForChanges(initialSnapshot);
    
    const generatedImages: GeneratedImage[] = newScannedFiles.map(f => ({
        name: f.name,
        blob: f.blob,
        category: f.category,
        virtualPath: f.virtualPath
    }));
    
    const pendingActions = await pyodideService.getActions();
    const newLayers: { fileId: string; layer: AnalysisLayer }[] = [];
    const attachedArtifacts: { fileId: string; artifact: any }[] = [];
    const layerDataUpdates: { fileId: string; layerId: string; blocks: any[] }[] = [];

    let resultString = "";

    for (const action of pendingActions) {
        // 'target_file' might be name or ID. Resolve it.
        let targetFileId = context.activeFileId;
        if (action.target_file) {
             const found = context.files.find(f => f.name === action.target_file || f.id === action.target_file);
             if (found) targetFileId = found.id;
        }

        // "add_layer" (from mlens)
        if (action.type === 'add_layer') {
            if (!targetFileId) continue;
            const targetFile = context.files.find(f => f.id === targetFileId);
            const existingLayers = targetFile?.analysis?.layers || [];
            
            let layerName = action.name || 'New Layer';
            let counter = 1;
            while (existingLayers.some(l => l.name === layerName)) {
                layerName = `${action.name || 'New Layer'} (${counter})`;
                counter++;
            }

            const layerId = generateId();
            let layerSource = action.source;

            if (action.layer_type === 'VECTOR' && Array.isArray(layerSource)) {
                layerSource = layerSource.map((annot: any) => {
                    const id = annot.id || generateId();
                    const color = annot.color || '#000000';
                    const geometry = annot.geometry || annot.points || annot.position || [];
                    let type = annot.type;
                    if (type === 'line') type = 'arrow';

                    return {
                        ...annot,
                        id,
                        type,
                        geometry,
                        color
                    };
                });
            }

            newLayers.push({
                fileId: targetFileId,
                layer: {
                    id: layerId,
                    name: layerName,
                    type: action.layer_type as any,
                    source: layerSource,
                    style: {
                        visible: true,
                        opacity: action.style?.opacity ?? 0.7,
                        colorMap: action.style?.colorMap,
                        fillColor: action.style?.color,
                        strokeColor: action.style?.color
                    }
                }
            });
        }
        // "register_artifact" (core) or "attach_artifact" (mlens legacy)
        else if (action.type === 'register_artifact' || action.type === 'attach_artifact') {
             // For simplicity, treat all artifacts as attachments to the active file if relevant, 
             // or just let them exist in session.
             // If target_file is specified, we attach.
             if (targetFileId) {
                 attachedArtifacts.push({
                     fileId: targetFileId,
                     artifact: {
                         id: generateId(),
                         name: action.name || (action.path ? action.path.split('/').pop() : 'Artifact'),
                         type: action.artifact_type || 'PLOT',
                         source: action.source || action.path,
                         createdAt: Date.now()
                     }
                 });
             }
        }
        else if (action.type === 'update_layer_data') {
             if (!targetFileId) continue;
             const targetFile = context.files.find(f => f.id === targetFileId);
             if (targetFile && targetFile.analysis?.layers) {
                 const layer = targetFile.analysis.layers.find(l => l.name === action.layer_name);
                 if (layer) {
                     const blocks = (action.blocks || []).map((b: any) => ({
                         ...b,
                         id: b.id || generateId()
                     }));
                     
                     layerDataUpdates.push({
                         fileId: targetFileId,
                         layerId: layer.id,
                         blocks
                     });
                 }
             }
        }
        // "load_role_from_file" (Skill Architect)
        else if (action.type === 'load_role_from_file') {
            try {
                const path = action.path;
                const blob = await pyodideService.getFileAsBlob(path);
                const filename = path.split('/').pop() || 'role.role';
                const file = new File([blob], filename);
                
                // Dynamic import to avoid cycles
                const { roleLoader } = await import("../../../services/roles/loader");
                const { roleRegistry } = await import("../../../services/roles/registry");
                
                const role = await roleLoader.loadFromFile(file);
                await roleRegistry.registerRole(role, blob);
                
                resultString += `\n[System] Successfully registered new role: ${role.manifest.name} (${role.manifest.id}).`;
            } catch(e) {
                console.error("Failed to load generated role", e);
                resultString += `\n[System] Error loading generated role: ${e}`;
            }
        }
    }

    let intentData: any = null;

    if (result !== undefined && result !== null) {
        if (typeof result === 'object') {
            if (!Array.isArray(result) && result.type) {
                intentData = result;
            }
            try {
                // If we haven't already populated resultString via custom logic above
                if (!resultString) resultString = JSON.stringify(result, null, 2);
                else resultString += "\n" + JSON.stringify(result, null, 2);
            } catch (e) {
                resultString = "[System: Object could not be serialized]";
            }
        } else {
            if (!resultString) resultString = String(result);
            else resultString += "\n" + String(result);
        }
    }

    if (error) {
      return {
        result: `Error: ${error}\nStdout: ${stdout}`,
        error
      };
    }

    let finalOutput = "";
    if (stdout) finalOutput += stdout + "\n";
    if (resultString) finalOutput += resultString;

    if (generatedImages.length > 0) {
        finalOutput += `\n[System] Generated files: ${generatedImages.map(i => `${i.name} (${i.category})`).join(', ')}`;
    }
    
    if (newLayers.length > 0) {
        finalOutput += `\n[System] Created ${newLayers.length} new layer(s).`;
    }

    if (attachedArtifacts.length > 0) {
        finalOutput += `\n[System] Attached ${attachedArtifacts.length} related artifact(s).`;
    }
    
    if (layerDataUpdates.length > 0) {
        finalOutput += `\n[System] Updated stats/data for ${layerDataUpdates.length} layer(s).`;
    }

    return {
      result: finalOutput.trim(),
      images: generatedImages,
      layers: newLayers,
      data: { 
          ...intentData,
          attachedArtifacts,
          layerDataUpdates 
      }
    };
  }
};
