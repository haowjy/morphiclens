
import React from "react";
import { Tag, Square, MousePointer2, Hexagon, Trash2, Type, MoveUpRight } from "lucide-react";
import { Annotation, AppActionType } from "../../../../types";
import { Button } from "../../../../components/ui/Button";

interface AnnotationListProps {
    fileId: string;
    layerId: string;
    annotations: Annotation[];
    dispatch: React.Dispatch<any>;
}

export const AnnotationList: React.FC<AnnotationListProps> = ({ fileId, layerId, annotations, dispatch }) => {
    
    if (annotations.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 p-8">
                <Tag size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No annotations in this layer.</p>
                <p className="text-xs mt-1">Select this layer and use tools to draw.</p>
            </div>
        );
    }

    const handleDelete = (annotId: string) => {
        const updated = annotations.filter(a => a.id !== annotId);
        dispatch({ 
            type: AppActionType.UPDATE_LAYER_ANNOTATIONS, 
            payload: { fileId, layerId, annotations: updated } 
        });
    };

    const handleLabelChange = (annotId: string, newLabel: string) => {
         const updated = annotations.map(a => a.id === annotId ? { ...a, label: newLabel } : a);
         dispatch({ 
            type: AppActionType.UPDATE_LAYER_ANNOTATIONS, 
            payload: { fileId, layerId, annotations: updated } 
        });
    };
    
    const handleTextChange = (annotId: string, newText: string) => {
         const updated = annotations.map(a => a.id === annotId ? { ...a, text: newText } : a);
         dispatch({ 
            type: AppActionType.UPDATE_LAYER_ANNOTATIONS, 
            payload: { fileId, layerId, annotations: updated } 
        });
    };

    // Helper to format position safely (handles flat [x,y] and nested [[x,y]...])
    const formatPos = (annot: Annotation) => {
        if (!annot.geometry || annot.geometry.length === 0) return "N/A";
        
        let x = 0, y = 0;
        const first = annot.geometry[0];
        
        // Robust check for nested arrays (Polygon) vs flat arrays (Box/Point)
        if (Array.isArray(first)) {
            x = first[0];
            y = first[1];
        } else if (typeof first === 'number') {
            x = annot.geometry[0] as number;
            y = annot.geometry[1] as number;
        }

        return `${Math.round(x * 100)}%,${Math.round(y * 100)}%`;
    };

    return (
        <div className="h-full overflow-y-auto p-2">
            <div className="space-y-1">
                {annotations.map((annot, index) => (
                    <div 
                        key={annot.id || index} 
                        className="group flex flex-col gap-2 bg-white border border-zinc-200 p-2 rounded-md hover:border-indigo-300 transition-colors shadow-sm"
                    >
                        <div className="flex items-center gap-3">
                            {/* Icon */}
                            <div 
                                className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${annot.color}20`, color: annot.color }}
                            >
                                {annot.type === 'box' && <Square size={14} />}
                                {annot.type === 'point' && <MousePointer2 size={14} />}
                                {annot.type === 'polygon' && <Hexagon size={14} />}
                                {annot.type === 'text' && <Type size={14} />}
                                {annot.type === 'arrow' && <MoveUpRight size={14} />}
                            </div>

                            {/* Editable Label */}
                            <div className="flex-1 min-w-0">
                                {annot.type === 'text' ? (
                                    <div className="flex flex-col gap-1">
                                        <input 
                                            className="w-full text-sm font-bold text-zinc-900 bg-zinc-50 border border-transparent hover:border-zinc-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300 placeholder:text-zinc-400"
                                            placeholder="Label Text"
                                            value={annot.text || annot.label || ""}
                                            onChange={(e) => handleTextChange(annot.id, e.target.value)}
                                        />
                                    </div>
                                ) : (
                                    <input 
                                        className="w-full text-sm font-medium text-zinc-900 bg-transparent border-none p-0 focus:ring-0 placeholder:text-zinc-400"
                                        placeholder={`${annot.type} ${index + 1}`}
                                        value={annot.label || ""}
                                        onChange={(e) => handleLabelChange(annot.id, e.target.value)}
                                    />
                                )}
                                
                                <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                    {annot.type.toUpperCase()} • {annot.id ? annot.id.substring(0, 4) : '####'}
                                    {annot.type !== 'polygon' && ` • pos: ${formatPos(annot)}`}
                                </div>
                            </div>

                            {/* Actions */}
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDelete(annot.id)}
                                className="h-7 w-7 text-zinc-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={14} />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
