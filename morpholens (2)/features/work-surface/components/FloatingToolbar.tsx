import React from "react";
import { cn } from "../../../lib/utils";

export interface FloatingToolbarProps {
  children?: React.ReactNode;
  className?: string;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({ children, className }) => {
  return (
    <div className={cn("absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center max-w-[95vw] pointer-events-none", className)}>
      <div className="pointer-events-auto bg-white/90 backdrop-blur-md shadow-sm border border-zinc-200/60 rounded-full px-3 py-1.5 flex items-center gap-2 select-none animate-in fade-in slide-in-from-top-4 duration-500">
        {children}
      </div>
    </div>
  );
};

export const ToolbarSeparator = () => <div className="w-[1px] h-4 bg-zinc-200 mx-1" />;

export const ToolbarGroup = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={cn("flex items-center gap-0.5", className)}>{children}</div>
);

export const ToolbarButton = ({ 
    active, 
    onClick, 
    children, 
    title,
    className,
    shortcut
}: { 
    active?: boolean; 
    onClick?: () => void; 
    children?: React.ReactNode; 
    title?: string;
    className?: string;
    shortcut?: string;
}) => (
    <button 
        onClick={onClick} 
        title={title}
        className={cn(
            "relative h-8 w-8 rounded-md transition-all flex items-center justify-center",
            active 
                ? "bg-zinc-900 text-white shadow-sm" 
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
            className
        )}
    >
        {children}
        {shortcut && (
             <span 
                className={cn(
                    "absolute bottom-0.5 right-0.5 text-[8px] leading-none font-mono opacity-60",
                    active ? "text-white/80" : "text-zinc-400"
                )}
            >
                {shortcut}
            </span>
        )}
    </button>
);