import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { FileType } from '../types';

export interface DragItem {
    type: 'FILE';
    id: string;
    fileType: FileType;
    origin: 'explorer' | 'session' | 'chat_artifact';
}

interface DragContextType {
    isDragging: boolean;
    draggedItem: DragItem | null;
    startDrag: (item: DragItem) => void;
    endDrag: () => void;
}

const DragContext = createContext<DragContextType>({
    isDragging: false,
    draggedItem: null,
    startDrag: () => {},
    endDrag: () => {}
});

export const useDragContext = () => useContext(DragContext);

export const DragProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);

    const startDrag = useCallback((item: DragItem) => {
        setIsDragging(true);
        setDraggedItem(item);
    }, []);

    const endDrag = useCallback(() => {
        setIsDragging(false);
        setDraggedItem(null);
    }, []);

    return (
        <DragContext.Provider value={{ isDragging, draggedItem, startDrag, endDrag }}>
            {children}
        </DragContext.Provider>
    );
};

export const useDraggable = (item: DragItem) => {
    const { startDrag, endDrag } = useDragContext();

    const handleDragStart = (e: React.DragEvent) => {
        startDrag(item);
        e.dataTransfer.setData("application/morpholens-item", JSON.stringify(item));
        e.dataTransfer.effectAllowed = "copyMove";
        // Fallback for non-app targets or basic ID transfer
        e.dataTransfer.setData("text/plain", item.id);
    };

    const handleDragEnd = () => {
        endDrag();
    };

    return {
        draggable: true,
        onDragStart: handleDragStart,
        onDragEnd: handleDragEnd
    };
};

export const useDropZone = ({ 
    onDrop, 
    accepts = ['FILE'],
    enableHighPrecision = false,
    canDrop
}: { 
    onDrop: (item: DragItem, position?: 'before' | 'after' | 'inside') => void,
    accepts?: string[],
    enableHighPrecision?: boolean,
    canDrop?: (item: DragItem) => boolean
}) => {
    const { isDragging, draggedItem } = useDragContext();
    const [isOver, setIsOver] = useState(false);
    const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);
    const enterLeaveCounter = useRef(0);

    const handleDragEnter = (e: React.DragEvent) => {
        if (!isDragging || !draggedItem) return;
        if (!accepts.includes(draggedItem.type)) return;
        if (canDrop && !canDrop(draggedItem)) return;

        e.preventDefault();
        e.stopPropagation();

        enterLeaveCounter.current++;
        setIsOver(true);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isDragging || !draggedItem) return;
        if (!accepts.includes(draggedItem.type)) return;
        if (canDrop && !canDrop(draggedItem)) return;

        // Safety recovery if counter gets out of sync (rare)
        if (!isOver) setIsOver(true);

        let pos: 'before' | 'after' | 'inside' = 'inside';

        if (enableHighPrecision) {
             const rect = e.currentTarget.getBoundingClientRect();
             const y = e.clientY - rect.top;
             const height = rect.height;
             
             if (height > 30) { 
                if (y < height * 0.25) pos = 'before';
                else if (y > height * 0.75) pos = 'after';
             }
        }
        
        setDropPosition(pos);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        enterLeaveCounter.current--;

        if (enterLeaveCounter.current <= 0) {
            enterLeaveCounter.current = 0;
            setIsOver(false);
            setDropPosition(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        enterLeaveCounter.current = 0;
        setIsOver(false);
        setDropPosition(null);

        if (!isDragging || !draggedItem) return;
        if (!accepts.includes(draggedItem.type)) return;
        if (canDrop && !canDrop(draggedItem)) return;

        const data = e.dataTransfer.getData("application/morpholens-item");
        if (data) {
            try {
                const item = JSON.parse(data) as DragItem;
                onDrop(item, dropPosition || 'inside');
            } catch (e) {
                console.error("Failed to parse drag data", e);
            }
        }
    };

    return {
        isOver,
        dropPosition,
        handlers: {
            onDragEnter: handleDragEnter,
            onDragOver: handleDragOver,
            onDragLeave: handleDragLeave,
            onDrop: handleDrop
        }
    };
};