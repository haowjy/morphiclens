
import React, { useState, useCallback, useEffect, useRef } from 'react';

/**
 * A hook to manage drag-based resizing interactions.
 * Handles adding/removing global event listeners and body styles.
 */
export function useDragResize(
  onResize: (e: MouseEvent) => void,
  onResizeEnd?: () => void
) {
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    onResizeEnd?.();
  }, [onResizeEnd]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', onResize);
      window.addEventListener('mouseup', stopResizing);
      // Prevent text selection and force cursor during drag
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      window.removeEventListener('mousemove', onResize);
      window.removeEventListener('mouseup', stopResizing);
      // Clean up styles
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, onResize, stopResizing]);

  return { isResizing, startResizing };
}

/**
 * A hook to get the precise dimensions of a container element.
 * Uses a callback ref to handle conditionally rendered elements correctly.
 */
export function useResponsiveDimensions() {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [element, setElement] = useState<HTMLElement | null>(null);

    const ref = useCallback((node: HTMLElement | null) => {
        setElement(node);
    }, []);

    useEffect(() => {
        if (!element) return;

        // 1. Measure immediately
        const rect = element.getBoundingClientRect();
        setDimensions({ width: Math.round(rect.width), height: Math.round(rect.height) });

        // 2. Observe for updates
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            
            // contentRect is the box where content can be placed (excluding padding/border usually)
            // But for a wrapper div that fills space, we often want client width
            const { width, height } = entry.contentRect;
            
            setDimensions(prev => {
                const newWidth = Math.round(width);
                const newHeight = Math.round(height);
                
                if (prev.width === newWidth && prev.height === newHeight) return prev;
                return { width: newWidth, height: newHeight };
            });
        });

        observer.observe(element);
        return () => observer.disconnect();
    }, [element]);

    return { ref, width: dimensions.width, height: dimensions.height, element };
}
