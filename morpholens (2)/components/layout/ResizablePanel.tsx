import React, { useState, useCallback, useRef } from "react";
import { cn } from "../../lib/utils";
import { useDragResize } from "../../lib/hooks";

interface ResizablePanelProps {
  side: "left" | "right";
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  isOpen: boolean;
  className?: string;
  children: React.ReactNode;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  side,
  defaultWidth = 400,
  minWidth = 300,
  maxWidth = 800,
  isOpen,
  className,
  children,
}) => {
  const [width, setWidth] = useState(defaultWidth);
  const dragInfo = useRef<{ startX: number; startWidth: number }>({ startX: 0, startWidth: 0 });

  const handleResize = useCallback(
      (e: MouseEvent) => {
        const currentX = e.clientX;
        const delta = currentX - dragInfo.current.startX;
        
        let newWidth = dragInfo.current.startWidth;
        
        if (side === "left") {
            // Handle is on the right edge. Moving right (positive delta) increases width.
            newWidth += delta;
        } else {
            // Handle is on the left edge. Moving right (positive delta) decreases width.
            newWidth -= delta;
        }

        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;
        
        setWidth(newWidth);
      },
      [side, minWidth, maxWidth]
  );

  const { isResizing, startResizing } = useDragResize(handleResize);

  const onMouseDown = (e: React.MouseEvent) => {
      // Capture the starting state to calculate delta later
      dragInfo.current = { startX: e.clientX, startWidth: width };
      startResizing(e);
  };

  return (
    <div
      className={cn(
        "flex-shrink-0 relative ease-in-out z-20 h-full flex flex-col bg-background",
        // Disable transitions during resize to ensure the panel tracks the mouse 1:1 without lag
        !isResizing && "transition-all duration-300",
        !isOpen && "w-0 opacity-0 overflow-hidden border-none",
        className
      )}
      style={{ width: isOpen ? width : 0 }}
    >
      {/* Resize Handle */}
      {isOpen && (
        <div
          className={cn(
            "absolute top-0 w-1.5 h-full cursor-col-resize z-50 transition-colors hover:bg-primary/20 active:bg-primary/40 group flex justify-center",
            // Position the handle slightly outside to overlap the border
            side === "left" ? "-right-1.5" : "-left-1.5",
          )}
          onMouseDown={onMouseDown}
        >
             {/* Visual indicator line inside the hit area */}
             <div className={cn(
                 "w-[1px] h-full bg-transparent group-hover:bg-primary/50 transition-colors",
                 isResizing && "bg-primary"
             )} />
        </div>
      )}
      
      {/* Content Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-full w-full">
         {children}
      </div>
    </div>
  );
};