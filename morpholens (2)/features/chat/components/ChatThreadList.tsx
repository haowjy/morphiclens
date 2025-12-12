import React, { useState, useMemo } from "react";
import { MessageSquare, Search } from "lucide-react";
import { ChatThread } from "../../../types";
import { cn, formatTime } from "../../../lib/utils";

interface ChatThreadListProps {
    threads: ChatThread[];
    activeId: string | null;
    onSelect: (id: string) => void;
    className?: string;
}

export const ChatThreadList: React.FC<ChatThreadListProps> = ({ 
    threads, 
    activeId, 
    onSelect,
    className 
}) => {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredThreads = useMemo(() => {
        if (!searchQuery.trim()) return threads;
        const lowerQ = searchQuery.toLowerCase();
        return threads.filter(t => 
            t.title.toLowerCase().includes(lowerQ) || 
            t.preview.toLowerCase().includes(lowerQ)
        );
    }, [threads, searchQuery]);

    return (
        <div className={cn("flex flex-col h-full bg-white", className)}>
            {/* Search Header */}
            <div className="p-2 border-b border-zinc-100">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2 text-zinc-400" size={14} />
                    <input 
                        type="text"
                        placeholder="Search chats..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-300 text-zinc-700 placeholder:text-zinc-400"
                        autoFocus
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-1 scrollbar-hide min-h-[150px] max-h-[400px]">
                {filteredThreads.length === 0 ? (
                     <div className="px-4 py-8 text-center">
                        <p className="text-xs text-zinc-400">No chats found.</p>
                    </div>
                ) : (
                    filteredThreads.map(thread => (
                        <div
                            key={thread.id}
                            onClick={() => onSelect(thread.id)}
                            className={cn(
                                "group flex flex-col gap-0.5 px-4 py-2.5 cursor-pointer transition-colors border-l-2",
                                activeId === thread.id
                                    ? "bg-zinc-50 border-indigo-500"
                                    : "border-transparent hover:bg-zinc-50"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className={cn(
                                    "text-sm font-medium truncate max-w-[180px]",
                                    activeId === thread.id ? "text-zinc-900" : "text-zinc-700"
                                )}>
                                    {thread.title}
                                </span>
                                <span className="text-[10px] text-zinc-400 flex-shrink-0">
                                    {formatTime(thread.updatedAt)}
                                </span>
                            </div>
                            <span className="text-xs text-zinc-500 truncate pr-2">
                                {thread.preview}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};