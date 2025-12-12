import React, { useState } from "react";
import { X, Info, Copy, Check } from "lucide-react";
import { ThreadTurn } from "../../../types";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";

interface DebugTurnModalProps {
  isOpen: boolean;
  onClose: () => void;
  turn: ThreadTurn;
}

export const DebugTurnModal: React.FC<DebugTurnModalProps> = ({ isOpen, onClose, turn }) => {
  if (!isOpen) return null;

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(turn, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
        <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-zinc-200 animate-in fade-in zoom-in-95 duration-200" 
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-md">
                        <Info size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-zinc-900">Turn Debug Inspector</h3>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                            <span>ID: {turn.id}</span>
                            <span className="text-zinc-300">|</span>
                            <span className="uppercase">{turn.type}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <Button variant="ghost" size="sm" onClick={handleCopy} className="text-zinc-500 hover:text-zinc-900 gap-2">
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? "Copied" : "Copy JSON"}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-zinc-200 rounded-full">
                        <X size={18} />
                    </Button>
                </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-auto p-0 relative group bg-[#0F1117]">
                <div className="absolute top-2 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span className="text-[10px] text-emerald-500/50 font-mono">JSON VIEW</span>
                </div>
                <div className="p-4 min-h-full">
                    <pre className="font-mono text-[11px] leading-relaxed text-emerald-400 whitespace-pre-wrap font-medium">
                        {JSON.stringify(turn, null, 2)}
                    </pre>
                </div>
            </div>
            
            {/* Footer */}
            <div className="p-3 bg-zinc-50 border-t border-zinc-100 flex justify-between items-center text-xs text-zinc-500">
                <div className="flex gap-4">
                    <span>Contents: {turn.contents.length}</span>
                    <span>Total Parts: {turn.contents.reduce((acc, c) => acc + c.parts.length, 0)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span>Status:</span>
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                        turn.status === 'complete' ? "bg-emerald-100 text-emerald-700" : 
                        turn.status === 'error' ? "bg-red-100 text-red-700" : 
                        "bg-indigo-100 text-indigo-700"
                    )}>
                        {turn.status}
                    </span>
                </div>
            </div>
        </div>
    </div>
  );
};
