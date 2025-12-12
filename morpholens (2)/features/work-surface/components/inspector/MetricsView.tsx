
import React, { useState, useEffect } from "react";
import { Activity, Info, AlertTriangle, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { cn } from "../../../../lib/utils";
import { DataBlock, KeyValueBlock, TextBlock, DistributionBlock, ImageBlock } from "../../../../types";
import { pyodideService } from "../../../../services/pyodideService";

interface LayerDataViewProps {
    data?: Record<string, any> | { blocks: DataBlock[] };
}

export const LayerDataView: React.FC<LayerDataViewProps> = ({ data }) => {
    // Fallback if no data
    if (!data || (Object.keys(data).length === 0)) {
        return (
             <div className="h-full flex flex-col items-center justify-center text-zinc-400 p-8">
                 <Activity size={32} className="mb-2 opacity-50" />
                 <p className="text-sm">No analysis data available.</p>
                 <p className="text-xs mt-1">Ask the agent to "Analyze this layer".</p>
             </div>
        );
    }

    // Check if it's the new structured format
    if ('blocks' in data && Array.isArray(data.blocks)) {
        return (
            <div className="p-4 space-y-4 h-full overflow-y-auto pb-10">
                {data.blocks.map((block) => (
                    <DataCard key={block.id} block={block} />
                ))}
            </div>
        );
    }

    // --- Legacy Fallback (Flat Key-Value) ---
    const metadata = data as Record<string, any>;
    const entries = Object.entries(metadata);
    
    // Heuristic grouping
    const morphometry = entries.filter(([k]) => !k.includes('intensity') && !k.includes('fraction') && !k.includes('interpretation') && !k.includes('grade'));
    const density = entries.filter(([k]) => k.includes('intensity') || k.includes('fraction'));
    const interpretation = entries.filter(([k]) => k.includes('interpretation') || k.includes('grade') || k.includes('summary'));

    return (
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-8 h-full overflow-y-auto">
           <div className="col-span-1 md:col-span-12">
               <div className="p-3 bg-amber-50 border border-amber-100 rounded-md text-amber-800 text-xs mb-4">
                   Legacy Data Format. Update agent to use `mlens.report_layer_data`.
               </div>
           </div>

           <div className="col-span-1 md:col-span-6">
               <h4 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Morphometry</h4>
               <div className="space-y-3 text-sm">
                    {morphometry.length > 0 ? (
                        morphometry.map(([k, v]) => (
                            <MetricRow key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
                        ))
                    ) : (
                        <p className="text-xs text-zinc-400 italic">No morphometry data</p>
                    )}
               </div>
           </div>
    
           <div className="col-span-1 md:col-span-6">
               <h4 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Density</h4>
               <div className="space-y-3 text-sm">
                    {density.length > 0 ? (
                        density.map(([k, v]) => (
                            <MetricRow key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
                        ))
                    ) : (
                        <p className="text-xs text-zinc-400 italic">No density data</p>
                    )}
               </div>
           </div>
    
           {interpretation.length > 0 && (
               <div className="col-span-1 md:col-span-12 flex flex-col">
                   <h4 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
                        Interpretation
                   </h4>
                   <div className="bg-white rounded-lg p-4 border border-zinc-200 shadow-sm">
                       <div className="space-y-2">
                           {interpretation.map(([k, v]) => (
                               <div key={k}>
                                   <span className="text-xs text-muted-foreground uppercase">{k.replace(/_/g, ' ')}</span>
                                   <p className="text-sm leading-relaxed text-foreground mt-1">{String(v)}</p>
                               </div>
                           ))}
                       </div>
                   </div>
               </div>
           )}
        </div>
    );
}

const MetricRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex justify-between border-b border-border/50 pb-2 capitalize">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium text-foreground">{value}</span>
    </div>
);

// --- New Structured Cards ---

const DataCard: React.FC<{ block: DataBlock }> = ({ block }) => {
    switch (block.type) {
        case 'kv': return <KVCard block={block} />;
        case 'text': return <TextCard block={block} />;
        case 'distribution': return <DistributionCard block={block} />;
        case 'image': return <ImageCard block={block} />;
        default: return null;
    }
};

const KVCard: React.FC<{ block: KeyValueBlock }> = ({ block }) => {
    const entries = Object.entries(block.data);
    return (
        <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
            {block.title && (
                <div className="px-3 py-2 bg-zinc-50 border-b border-zinc-100 text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                    {block.title}
                </div>
            )}
            <div className="p-3 grid grid-cols-2 gap-4">
                {entries.map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                        <span className="text-[10px] text-zinc-400 uppercase font-medium truncate" title={k}>{k.replace(/_/g, ' ')}</span>
                        <span className="text-sm font-mono font-medium text-zinc-900 truncate" title={String(v)}>{v}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const TextCard: React.FC<{ block: TextBlock }> = ({ block }) => {
    const variantStyles = {
        neutral: "bg-white border-zinc-200",
        info: "bg-blue-50/50 border-blue-200",
        warning: "bg-amber-50/50 border-amber-200",
        success: "bg-emerald-50/50 border-emerald-200"
    };
    
    const Icon = block.variant === 'warning' ? AlertTriangle : 
                 block.variant === 'success' ? CheckCircle2 : Info;

    return (
        <div className={cn("rounded-lg border shadow-sm p-3", variantStyles[block.variant || 'neutral'])}>
            {block.title && (
                <div className="flex items-center gap-2 mb-2">
                    {block.variant && <Icon size={14} className="opacity-70" />}
                    <h5 className="text-xs font-bold uppercase tracking-wide opacity-80">{block.title}</h5>
                </div>
            )}
            <p className="text-xs leading-relaxed text-zinc-800 whitespace-pre-wrap">
                {block.content}
            </p>
        </div>
    );
};

const DistributionCard: React.FC<{ block: DistributionBlock }> = ({ block }) => {
    const maxVal = Math.max(...block.values, 1); // Avoid div by zero
    const barColor = block.color || '#6366f1'; // Default Indigo

    return (
        <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden p-3">
             {block.title && (
                <div className="text-xs font-semibold text-zinc-700 uppercase tracking-wide mb-3">
                    {block.title}
                </div>
            )}
            
            <div className="h-24 flex items-end gap-1 mb-1">
                {block.values.map((v, i) => {
                    const heightPct = (v / maxVal) * 100;
                    return (
                        <div key={i} className="flex-1 flex flex-col items-center group relative">
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 text-white text-[9px] px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-10">
                                {block.labels[i]}: {v}
                            </div>
                            
                            <div 
                                className="w-full rounded-t-sm transition-all hover:brightness-110"
                                style={{ 
                                    height: `${heightPct}%`, 
                                    backgroundColor: barColor,
                                    opacity: 0.8
                                }}
                            />
                        </div>
                    );
                })}
            </div>
            
            {/* X-Axis Labels (Sampled to fit) */}
            <div className="flex justify-between text-[9px] text-zinc-400 pt-1 border-t border-zinc-100">
                <span>{block.labels[0]}</span>
                {block.labels.length > 2 && <span>{block.labels[Math.floor(block.labels.length/2)]}</span>}
                {block.labels.length > 1 && <span>{block.labels[block.labels.length-1]}</span>}
            </div>
        </div>
    );
};

const ImageCard: React.FC<{ block: ImageBlock }> = ({ block }) => {
    const [imgUrl, setImgUrl] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const load = async () => {
            if (block.url.startsWith('http') || block.url.startsWith('blob:')) {
                setImgUrl(block.url);
                return;
            }
            // Load from Pyodide VFS
            try {
                const blob = await pyodideService.getFileAsBlob(block.url);
                const url = URL.createObjectURL(blob);
                if (active) setImgUrl(url);
            } catch (e) {
                console.warn(`Failed to load image block source: ${block.url}`);
            }
        };
        load();
        return () => { active = false; };
    }, [block.url]);

    return (
        <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
             {block.title && (
                <div className="px-3 py-2 bg-zinc-50 border-b border-zinc-100 text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                    {block.title}
                </div>
            )}
            <div className="p-2 flex flex-col items-center">
                {imgUrl ? (
                    <img src={imgUrl} alt={block.title || 'Data Plot'} className="w-full h-auto object-contain rounded" />
                ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-zinc-100 rounded text-zinc-400">
                        <ImageIcon size={24} />
                    </div>
                )}
                {block.caption && (
                    <p className="text-[10px] text-zinc-500 mt-2 text-center w-full px-2">
                        {block.caption}
                    </p>
                )}
            </div>
        </div>
    );
};
