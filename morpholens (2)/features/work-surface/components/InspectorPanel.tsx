
import React, { useState } from "react";
import { ChevronUp, ChevronDown, Layers, Activity, Tag, Paperclip } from "lucide-react";
import { AppFile, AnalysisLayer } from "../../../types";
import { cn } from "../../../lib/utils";
import { Button } from "../../../components/ui/Button";

// Sub-components
import { AnnotationList } from "./inspector/AnnotationList";
import { LayerDataView } from "./inspector/MetricsView"; // Renamed import
import { LayerList } from "./inspector/LayerList";
import { ArtifactList } from "./inspector/ArtifactList";

interface InspectorPanelProps {
  file: AppFile;
  isOpen: boolean;
  height: number;
  onResizeStart: (e: React.MouseEvent) => void;
  onToggle: () => void;
  dispatch: React.Dispatch<any>;
}

type TabId = 'layers' | 'data' | 'objects' | 'related'; // 'details' -> 'data'

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
    file,
    isOpen,
    height,
    onResizeStart,
    onToggle,
    dispatch
}) => {
    const [activeTab, setActiveTab] = useState<TabId>('layers');

    const layers = file.analysis?.layers || [];
    const artifacts = file.analysis?.artifacts || [];
    const activeLayerId = file.analysis?.activeLayerId || layers[0]?.id;
    const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];

    // Determine content based on tab
    const renderContent = () => {
        switch (activeTab) {
            case 'layers':
                return (
                    <LayerList 
                        fileId={file.id} 
                        layers={layers} 
                        activeLayerId={activeLayerId} 
                        dispatch={dispatch} 
                    />
                );
            case 'data':
                return <LayerDataView data={activeLayer?.metrics} />;
            case 'objects':
                // Show annotations for the *active layer* if it is Vector
                if (activeLayer?.type === 'VECTOR') {
                    return (
                        <AnnotationList 
                            fileId={file.id} 
                            layerId={activeLayer.id}
                            annotations={(activeLayer.source as any) || []} 
                            dispatch={dispatch} 
                        />
                    );
                }
                
                return (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center">
                        <Tag className="mb-2 opacity-50" />
                        <p className="text-sm">No editable objects in this layer.</p>
                    </div>
                );
            case 'related':
                return <ArtifactList artifacts={artifacts} />;
            default:
                return null;
        }
    };

    return (
        <div 
            className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 flex flex-col pointer-events-auto transition-colors"
            style={{
                height: isOpen ? `${height}px` : '3rem',
                transition: 'none'
            }}
        >
            {/* Resize Handle */}
            {isOpen && (
                <div 
                    className="absolute top-0 left-0 right-0 h-1.5 cursor-row-resize z-50 hover:bg-primary/20 flex items-center justify-center group"
                    onMouseDown={onResizeStart}
                >
                    <div className="w-12 h-1 bg-zinc-200 rounded-full group-hover:bg-primary/40 transition-colors"></div>
                </div>
            )}

            {/* Header / Tabs */}
            <div 
                className={cn(
                    "h-12 px-4 flex items-center justify-between shrink-0 border-b border-zinc-100 transition-colors",
                    !isOpen && "cursor-pointer hover:bg-zinc-50"
                )}
                onClick={() => !isOpen && onToggle()}
            >
                <div className="flex items-center gap-6 h-full">
                    <div 
                        className="flex items-center gap-2 cursor-pointer h-full"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle();
                        }}
                    >
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            layers.length > 2 ? "bg-indigo-500" : "bg-zinc-300"
                        )}></div>
                        <span className="text-xs font-bold text-zinc-600 uppercase tracking-wide select-none">Inspector</span>
                    </div>
                    
                    {/* Tab Navigation */}
                    {isOpen && (
                        <div 
                            className="flex items-center gap-1 h-full pt-1"
                            onClick={(e) => e.stopPropagation()}
                        >
                             <TabButton 
                                id="layers" 
                                label="Layers" 
                                icon={<Layers size={12} />} 
                                isActive={activeTab === 'layers'} 
                                onClick={() => setActiveTab('layers')}
                                count={layers.length}
                             />
                             <TabButton 
                                id="data" 
                                label="Data" 
                                icon={<Activity size={12} />} 
                                isActive={activeTab === 'data'} 
                                onClick={() => setActiveTab('data')}
                             />
                             <TabButton 
                                id="objects" 
                                label="Objects" 
                                icon={<Tag size={12} />} 
                                isActive={activeTab === 'objects'} 
                                onClick={() => setActiveTab('objects')}
                                count={activeLayer?.type === 'VECTOR' ? ((activeLayer.source as any)?.length || 0) : undefined}
                             />
                             <TabButton 
                                id="related" 
                                label="Related" 
                                icon={<Paperclip size={12} />} 
                                isActive={activeTab === 'related'} 
                                onClick={() => setActiveTab('related')}
                                count={artifacts.length}
                             />
                        </div>
                    )}
                </div>

                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 ml-auto text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle();
                    }}
                >
                    {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </Button>
            </div>

            {/* Content Area */}
            {isOpen && (
                <div className="flex-1 overflow-hidden relative bg-zinc-50/30">
                     {renderContent()}
                </div>
            )}
        </div>
    );
};

// --- Helper ---

const TabButton = ({ id, label, icon, isActive, onClick, count }: any) => (
    <button 
        onClick={onClick}
        className={cn(
            "h-full px-3 flex items-center gap-2 text-xs font-medium border-b-2 transition-colors select-none",
            isActive 
                ? "border-indigo-500 text-indigo-600 bg-indigo-50/50" 
                : "border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50"
        )}
    >
        {icon}
        <span>{label}</span>
        {count !== undefined && count > 0 && (
            <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[9px] min-w-[16px] text-center",
                isActive ? "bg-indigo-100 text-indigo-700" : "bg-zinc-100 text-zinc-500"
            )}>
                {count}
            </span>
        )}
    </button>
);
