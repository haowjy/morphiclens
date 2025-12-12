
import React from 'react';
import { Annotation } from "../../../types";

export type SizeLevel = 'sm' | 'md' | 'lg' | 'xl';

export const SIZE_CONFIG: Record<SizeLevel, { stroke: number, radius: number, font: number }> = {
    sm: { stroke: 1, radius: 3, font: 10 },
    md: { stroke: 2, radius: 5, font: 14 },
    lg: { stroke: 4, radius: 8, font: 20 },
    xl: { stroke: 8, radius: 12, font: 32 },
};

export interface ToolState {
    imageWidth: number;
    imageHeight: number;
    scale: number;
    activeColor: string;
    activeSize: SizeLevel;
}

export type ToolAction = 
    | { type: 'NONE' }
    | { type: 'UPDATE_ANNOTATION', annotation: Annotation }
    | { type: 'COMMIT_ANNOTATION', annotation: Annotation }
    | { type: 'CANCEL' };

export interface CanvasTool {
    id: string;
    label: string;
    icon?: React.ReactNode;
    cursor: string;

    /** Called when the tool is selected. Returns an action if state needs restoration. */
    onActivate?(state: ToolState): ToolAction; 

    onMouseDown(x: number, y: number, state: ToolState): ToolAction;
    onMouseMove(x: number, y: number, state: ToolState): ToolAction;
    onMouseUp(x: number, y: number, state: ToolState): ToolAction;
}
