
import React, { useState, useRef, useEffect } from "react";
import { Eye, EyeOff, Lock, Image as ImageIcon, PenTool, BarChart3, GripVertical, Trash2, Plus, Edit2, Check, X } from "lucide-react";
import { AnalysisLayer, AppActionType } from "../../../../types";
import { Button } from "../../../../components/ui/Button";
import { cn, generateId } from "../../../../lib/utils";

interface LayerListProps {
    fileId: string;
    layers: AnalysisLayer[]; 
    activeLayerId: string | null;
    dispatch: React.Dispatch<any>;
}

export const LayerList: React.FC<LayerListProps> = ({ fileId, layers, activeLayerId, dispatch }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingId]);

    const handleToggleVisible = (e: React.MouseEvent, layer: AnalysisLayer) => {
        e.stopPropagation();
        e.preventDefault();
        
        dispatch({
            type: AppActionType.UPDATE_LAYER,
            payload: { 
                fileId, 
                layerId: layer.id, 
                updates: { style: { ...layer.style, visible: !layer.style.visible } } 
            }
        });
    };

    const handleSelect = (layerId: string) => {
        // Don't select if editing
        if (editingId) return;
        
        dispatch({
            type: AppActionType.SET_ACTIVE_LAYER,
            payload: { fileId, layerId }
        });
    };

    const handleDelete = (e: React.MouseEvent, layerId: string) => {
        e.stopPropagation();
        dispatch({
            type: AppActionType.REMOVE_LAYER,
            payload: { fileId, layerId }
        });
    };

    const handleCreateLayer = () => {
        // Smart naming: Find first available "Layer N"
        let counter = 1;
        while (layers.some(l => l.name === `Layer ${counter}`)) {
            counter++;
        }

        const newLayer: AnalysisLayer = {
            id: generateId(),
            name: `Layer ${counter}`,
            type: 'VECTOR',
            source: [],
            style: { visible: true, opacity: 1 }
        };

        dispatch({
            type: AppActionType.ADD_LAYER,
            payload: { fileId, layer: newLayer }
        });
    };

    const startEditing = (e: React.MouseEvent, layer: AnalysisLayer) => {
        e.stopPropagation();
        if (layer.locked) return;
        setEditingId(layer.id);
        setEditName(layer.name);
    };

    const saveEditing = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (editingId && editName.trim()) {
            dispatch({
                type: AppActionType.UPDATE_LAYER,
                payload: { 
                    fileId, 
                    layerId: editingId, 
                    updates: { name: editName.trim() } 
                }
            });
        }
        setEditingId(null);
    };

    const cancelEditing = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setEditingId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') saveEditing();
        if (e.key === 'Escape') cancelEditing();
    };

    const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>, layer: AnalysisLayer) => {
        const val = parseFloat(e.target.value);
        dispatch({
            type: AppActionType.UPDATE_LAYER,
            payload: { 
                fileId, 
                layerId: layer.id, 
                updates: { style: { ...layer.style, opacity: val } } 
            }
        });
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-2 border-b border-zinc-100 flex justify-end bg-white/50 shrink-0">
                 <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={handleCreateLayer}
                    className="h-7 text-xs gap-1.5"
                >
                    <Plus size={12} />
                    New Layer
                 </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {layers.slice().reverse().map((layer) => ( // Reverse to show stack order (Top on top)
                    <div 
                        key={layer.id}
                        onClick={() => handleSelect(layer.id)}
                        className={cn(
                            "flex flex-col p-2 rounded-md border cursor-pointer transition-all gap-2",
                            activeLayerId === layer.id 
                                ? "bg-indigo-50 border-indigo-200 shadow-sm" 
                                : "bg-white border-zinc-200 hover:border-zinc-300"
                        )}
                    >
                        {/* Header Row */}
                        <div className="flex items-center gap-3">
                            {/* Drag Handle (Visual only for now) */}
                            <div className="text-zinc-300 cursor-grab active:cursor-grabbing">
                                <GripVertical size={14} />
                            </div>

                            {/* Visibility */}
                            <button 
                                type="button"
                                onClick={(e) => handleToggleVisible(e, layer)}
                                onMouseDown={(e) => e.stopPropagation()}
                                className={cn(
                                    "p-1 rounded hover:bg-zinc-200 transition-colors focus:outline-none",
                                    layer.style.visible ? "text-zinc-600" : "text-zinc-300"
                                )}
                            >
                                {layer.style.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>

                            {/* Type Icon */}
                            <div className={cn(
                                "w-6 h-6 rounded flex items-center justify-center text-xs shrink-0",
                                layer.type === 'RASTER' ? "bg-blue-100 text-blue-600" :
                                layer.type === 'VECTOR' ? "bg-emerald-100 text-emerald-600" :
                                "bg-orange-100 text-orange-600"
                            )}>
                                {layer.type === 'RASTER' ? <ImageIcon size={14} /> :
                                layer.type === 'VECTOR' ? <PenTool size={14} /> :
                                <BarChart3 size={14} />
                                }
                            </div>

                            {/* Name / Editing */}
                            <div className="flex-1 min-w-0">
                                {editingId === layer.id ? (
                                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                        <input 
                                            ref={inputRef}
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            className="h-6 w-full text-sm bg-white border border-indigo-300 rounded px-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            onBlur={() => saveEditing()}
                                        />
                                        <button onClick={saveEditing} className="text-emerald-600 hover:bg-emerald-50 p-0.5 rounded"><Check size={14} /></button>
                                        <button onClick={cancelEditing} className="text-red-500 hover:bg-red-50 p-0.5 rounded"><X size={14} /></button>
                                    </div>
                                ) : (
                                    <div 
                                        className="flex items-center gap-2 group/name"
                                        onDoubleClick={(e) => startEditing(e, layer)}
                                    >
                                        <span className={cn(
                                            "text-sm font-medium truncate select-none",
                                            activeLayerId === layer.id ? "text-indigo-900" : "text-zinc-700"
                                        )}>
                                            {layer.name}
                                        </span>
                                        {layer.locked ? (
                                            <Lock size={10} className="text-zinc-300" />
                                        ) : (
                                            <Edit2 
                                                size={10} 
                                                className="text-zinc-300 opacity-0 group-hover/name:opacity-100 hover:text-zinc-600 cursor-pointer transition-opacity" 
                                                onClick={(e) => startEditing(e, layer)}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Delete Action */}
                            {!layer.locked && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={(e) => handleDelete(e, layer.id)}
                                    className="h-7 w-7 text-zinc-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={14} />
                                </Button>
                            )}
                        </div>

                        {/* Controls Row (Opacity) */}
                        <div className="pl-12 pr-2 flex items-center gap-3">
                             <div className="flex-1 flex items-center gap-2">
                                <span className="text-[9px] font-medium text-zinc-400 uppercase w-8">Opacity</span>
                                <input 
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={layer.style.opacity}
                                    onChange={(e) => handleOpacityChange(e, layer)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-1 h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
                                />
                                <span className="text-[9px] font-mono text-zinc-500 w-6 text-right">
                                    {Math.round(layer.style.opacity * 100)}%
                                </span>
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
