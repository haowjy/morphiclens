
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Minus, Maximize, RotateCcw } from "lucide-react";
import { Button } from "../../../components/ui/Button";

interface ZoomPanWrapperProps {
    children: React.ReactNode;
    minScale?: number;
    maxScale?: number;
    className?: string;
    contentWidth?: number;
    contentHeight?: number;
}

export const ZoomPanWrapper: React.FC<ZoomPanWrapperProps> = ({ 
    children, 
    minScale = 0.1, 
    maxScale = 10,
    className
}) => {
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastMouseRef = useRef({ x: 0, y: 0 });
    const isSpacePressed = useRef(false);

    // --- Key Handlers (Spacebar) ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat && !e.target?.toString().includes('Input')) {
                isSpacePressed.current = true;
                if (containerRef.current) containerRef.current.style.cursor = 'grab';
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                isSpacePressed.current = false;
                if (containerRef.current) containerRef.current.style.cursor = 'default';
                setIsDragging(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // --- Mouse Wheel (Pan/Zoom) ---
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Ctrl + Wheel OR Trackpad Pinch = ZOOM
        if (e.ctrlKey || e.metaKey) {
            const zoomSensitivity = 0.001; 
            const delta = -e.deltaY * zoomSensitivity;
            const newScale = Math.min(Math.max(transform.scale * (1 + delta), minScale), maxScale);
            
            // Zoom towards mouse pointer
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                // Calculate where the mouse is relative to the content
                const contentX = (mouseX - transform.x) / transform.scale;
                const contentY = (mouseY - transform.y) / transform.scale;

                // Update position to keep content under mouse stationary
                const newX = mouseX - contentX * newScale;
                const newY = mouseY - contentY * newScale;

                setTransform({ x: newX, y: newY, scale: newScale });
            }
        } else {
            // Regular Wheel = PAN
            // If horizontal scroll exists (trackpad), use it. Otherwise shift+wheel is horizontal.
            let deltaX = e.deltaX;
            let deltaY = e.deltaY;

            // Optional: Excalidraw-like 'Shift+Wheel' for horizontal
            if (e.shiftKey && deltaY !== 0 && deltaX === 0) {
                deltaX = deltaY;
                deltaY = 0;
            }

            setTransform(prev => ({
                ...prev,
                x: prev.x - deltaX,
                y: prev.y - deltaY
            }));
        }
    }, [transform, minScale, maxScale]);

    // --- Dragging ---
    const handleMouseDown = (e: React.MouseEvent) => {
        // Allow drag if Space is held OR Middle Mouse Button
        if (isSpacePressed.current || e.button === 1 || e.button === 0) {
            // Note: We allow Left Click (0) to drag if Space is pressed, or always if it's the background.
            // But if we want to allow text selection in children, we should be careful.
            // For now, let's say Left Click Drags if clicked on background or Space is held.
            
            // If clicking on interactive elements, don't drag unless Space
            if (!isSpacePressed.current && e.button === 0 && (e.target as HTMLElement).closest('button, input, textarea, a')) {
                return;
            }

            setIsDragging(true);
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
            if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();

        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };

        setTransform(prev => ({
            ...prev,
            x: prev.x + dx,
            y: prev.y + dy
        }));
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        if (containerRef.current) containerRef.current.style.cursor = isSpacePressed.current ? 'grab' : 'default';
    };

    const resetView = () => setTransform({ x: 0, y: 0, scale: 1 });

    return (
        <div 
            ref={containerRef}
            className={`relative w-full h-full overflow-hidden bg-zinc-100 ${className}`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Infinite Canvas Container */}
            <div 
                style={{ 
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                    transformOrigin: '0 0',
                    willChange: 'transform',
                }}
                className="w-full h-full flex items-center justify-center pointer-events-none"
            >
                 {/* Content Wrapper - Pointer events re-enabled for content interaction */}
                 <div className="pointer-events-auto shadow-xl bg-white min-w-[800px] min-h-[1100px] origin-center">
                    {children}
                 </div>
            </div>
            
            {/* Controls */}
             <div className="absolute bottom-6 right-6 flex flex-col gap-1 z-30 pointer-events-auto">
                 <Button 
                    variant="secondary" 
                    size="icon" 
                    onClick={() => setTransform(t => ({ ...t, scale: Math.min(t.scale * 1.2, maxScale) }))}
                    className="rounded-full shadow-sm bg-white hover:bg-zinc-50"
                    title="Zoom In"
                >
                    <Plus size={16} />
                 </Button>
                 <Button 
                    variant="secondary" 
                    size="icon" 
                    onClick={() => setTransform(t => ({ ...t, scale: Math.max(t.scale / 1.2, minScale) }))}
                    className="rounded-full shadow-sm bg-white hover:bg-zinc-50"
                    title="Zoom Out"
                >
                    <Minus size={16} /> 
                 </Button>
                 <Button 
                    variant="secondary" 
                    size="icon" 
                    onClick={resetView}
                    className="rounded-full shadow-sm bg-white hover:bg-zinc-50"
                    title="Reset View"
                >
                    <RotateCcw size={14} /> 
                 </Button>
                 <div className="bg-white/90 backdrop-blur rounded px-2 py-1 text-xs font-mono text-center shadow-sm border border-zinc-200 mt-1 select-none">
                     {Math.round(transform.scale * 100)}%
                 </div>
            </div>
            
            {/* Hint */}
            <div className="absolute bottom-6 left-6 text-[10px] text-zinc-400 pointer-events-none select-none hidden md:block">
                Wheel to Pan • Ctrl+Wheel to Zoom • Space+Drag
            </div>
        </div>
    );
};
