
import React, { useState, useEffect } from "react";
import { Image as ImageIcon, FileBarChart, ExternalLink, Calendar } from "lucide-react";
import { AnalysisArtifact } from "../../../../types";
import { pyodideService } from "../../../../services/pyodideService";

interface ArtifactListProps {
    artifacts: AnalysisArtifact[];
}

export const ArtifactList: React.FC<ArtifactListProps> = ({ artifacts }) => {
    
    if (artifacts.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 p-8">
                <FileBarChart size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No related artifacts.</p>
                <p className="text-xs mt-1">Ask the agent to "Generate a plot" or "Save this view".</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-4 grid grid-cols-2 gap-4">
            {artifacts.map((art) => (
                <ArtifactCard key={art.id} artifact={art} />
            ))}
        </div>
    );
};

const ArtifactCard: React.FC<{ artifact: AnalysisArtifact }> = ({ artifact }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const blob = await pyodideService.getFileAsBlob(artifact.source);
                const url = URL.createObjectURL(blob);
                if (active) setPreviewUrl(url);
            } catch (e) {
                console.warn("Failed to load artifact preview", e);
            }
        };
        load();
        return () => { active = false; };
    }, [artifact.source]);

    const handleOpen = () => {
        if (previewUrl) window.open(previewUrl, '_blank');
    };

    return (
        <div className="group border border-zinc-200 bg-white rounded-lg p-2 hover:shadow-md transition-shadow flex flex-col gap-2">
            <div 
                className="aspect-square bg-zinc-100 rounded overflow-hidden relative cursor-pointer"
                onClick={handleOpen}
            >
                {previewUrl ? (
                    <img src={previewUrl} alt={artifact.name} className="w-full h-full object-contain" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                        {artifact.type === 'PLOT' ? <FileBarChart /> : <ImageIcon />}
                    </div>
                )}
                
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <ExternalLink className="text-white drop-shadow-md" size={20} />
                </div>
            </div>
            
            <div className="min-w-0">
                <h4 className="text-xs font-semibold text-zinc-800 truncate" title={artifact.name}>{artifact.name}</h4>
                <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-0.5">
                    <Calendar size={10} />
                    <span>{new Date(artifact.createdAt).toLocaleTimeString()}</span>
                </div>
            </div>
        </div>
    );
};
