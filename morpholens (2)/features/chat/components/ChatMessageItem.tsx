
import React, { useState, useMemo } from "react";
import { Copy, AlertTriangle, Info, AlertOctagon, Check } from "lucide-react";
import { ThreadTurn, AppFile } from "../../../types";
import { ThinkingBlock, ToolBlock, AttachmentBlock, GroundingBlock } from "./MessageBlocks";
import { Streamdown } from "./Streamdown";
import { Button } from "../../../components/ui/Button";
import { DebugTurnModal } from "./DebugTurnModal";
import { parseTurnToBlocks } from "../../../lib/chatParser";

interface ChatMessageItemProps {
  turn: ThreadTurn;
  files?: AppFile[];
  onFileClick?: (file: AppFile) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ turn, files = [], onFileClick }) => {
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Parse the turn contents into UI Blocks
  const blocks = useMemo(() => parseTurnToBlocks(turn, files), [turn, files]);

  // User Message Rendering
  if (turn.type === 'user') {
    const textBlocks = blocks.filter(b => b.type === 'text');
    const attachBlocks = blocks.filter(b => b.type === 'attachments');
    
    const text = textBlocks.map(b => (b as any).content).join('\n');
    const hasText = text && text.trim().length > 0;

    return (
      <>
        <div className="flex flex-col items-end mb-6 pl-2 group">
             {/* Render Attachments First */}
             {attachBlocks.map((block, i) => (
                 block.type === 'attachments' && (
                     <div key={`attach-${i}`} className="mb-2">
                        <AttachmentBlock 
                            fileIds={block.fileIds} 
                            allFiles={files} 
                            onFileClick={onFileClick}
                        />
                     </div>
                 )
             ))}

             {hasText && (
                <div className="relative max-w-full">
                    <div className="absolute right-full top-0 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100" 
                            onClick={() => setIsDebugOpen(true)}
                            title="View Debug Data"
                        >
                            <Info size={14} />
                        </Button>
                    </div>

                    <div className="bg-white border border-zinc-200 px-5 py-3.5 rounded-2xl rounded-tr-sm shadow-sm text-zinc-800 text-sm leading-relaxed whitespace-pre-wrap">
                        {text}
                    </div>
                </div>
             )}
        </div>
        <DebugTurnModal isOpen={isDebugOpen} onClose={() => setIsDebugOpen(false)} turn={turn} />
      </>
    );
  }

  // Assistant Message Rendering
  const isStreaming = turn.status === 'streaming';
  
  // Check if we have substantive content (text, code, tools, errors) to justify collapsing thoughts
  const hasContent = blocks.some(b => 
      b.type === 'text' || 
      b.type === 'code' || 
      b.type === 'tool' || 
      b.type === 'error'
  );

  // Identify "Ghost" Response: Finished, had thought, but no content
  const isGhostResponse = !isStreaming && !hasContent && blocks.some(b => b.type === 'thinking');

  const handleCopy = () => {
      // Filter for text blocks only, excluding code/thinking/tools
      const textContent = blocks
          .filter(b => b.type === 'text')
          .map(b => (b as any).content)
          .join('\n\n');

      if (textContent) {
          navigator.clipboard.writeText(textContent);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
      }
  };

  return (
    <>
        <div className="flex flex-col items-start pr-4 mb-8 group w-full">
            <div className="w-full">
                {blocks.map((block, index) => {
                    const key = `${turn.id}-block-${index}`;

                    if (block.type === 'error') {
                        return (
                            <div key={key} className="mt-2 mb-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" />
                                <div className="flex flex-col gap-1">
                                    <span className="font-semibold text-xs uppercase tracking-wide">System Alert</span>
                                    <span>{block.content}</span>
                                </div>
                            </div>
                        );
                    }

                    if (block.type === 'thinking') {
                        return (
                            <ThinkingBlock 
                                key={key} 
                                content={block.content} 
                                isStreaming={block.isStreaming}
                                // Don't collapse if there is no other content to show
                                collapseOnFinish={hasContent}
                            />
                        );
                    }

                    if (block.type === 'code') {
                         return (
                            <ToolBlock 
                                key={key} 
                                name="run_python"
                                args={{ code: block.code }}
                                result={block.result}
                                generatedImages={block.generatedImages}
                                isStreaming={block.status === 'running'} 
                                onFileClick={onFileClick}
                            />
                        );
                    }

                    if (block.type === 'tool') {
                        return (
                           <ToolBlock 
                               key={key} 
                               name={block.name}
                               args={block.args}
                               result={block.result}
                               generatedImages={block.generatedImages}
                               isStreaming={block.status === 'running'} 
                               onFileClick={onFileClick}
                           />
                       );
                   }

                    if (block.type === 'attachments') {
                         return (
                             <AttachmentBlock 
                                key={key} 
                                fileIds={block.fileIds} 
                                allFiles={files} 
                                onFileClick={onFileClick}
                            />
                         );
                    }

                    if (block.type === 'grounding') {
                        return (
                            <GroundingBlock key={key} metadata={block.metadata} />
                        );
                    }

                    if (block.type === 'text') {
                        return (
                            <div key={key} className="max-w-3xl">
                                <Streamdown>{block.content}</Streamdown>
                            </div>
                        );
                    }

                    return null;
                })}

                {isGhostResponse && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm flex items-start gap-2">
                        <AlertOctagon size={16} className="mt-0.5 shrink-0 text-amber-600" />
                        <div className="flex flex-col gap-1">
                            <span className="font-semibold text-xs uppercase tracking-wide">No Output</span>
                            <span>The model completed its thought process but did not generate a final textual response. Check the thought block above for details.</span>
                        </div>
                    </div>
                )}
            </div>

            {!isStreaming && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-zinc-300 hover:text-zinc-500" 
                        onClick={handleCopy} 
                        title="Copy Text"
                    >
                        {isCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-zinc-300 hover:text-zinc-500" 
                        onClick={() => setIsDebugOpen(true)}
                        title="View Debug Data"
                    >
                        <Info size={12} />
                    </Button>
                </div>
            )}
        </div>
        <DebugTurnModal isOpen={isDebugOpen} onClose={() => setIsDebugOpen(false)} turn={turn} />
    </>
  );
};
