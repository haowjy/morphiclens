
import { generateId } from "../../../lib/utils";
import { Annotation } from "../../../types";
import { CanvasTool, ToolAction, ToolState, SIZE_CONFIG } from "./ToolTypes";

export class ArrowTool implements CanvasTool {
    id = 'arrow';
    label = 'Arrow';
    cursor = 'crosshair';
    
    private startPos: { x: number, y: number } | null = null;
    private currentAnnotation: Annotation | null = null;

    onMouseDown(x: number, y: number, state: ToolState): ToolAction {
        this.startPos = { x, y };
        const sizeConfig = SIZE_CONFIG[state.activeSize];
        
        this.currentAnnotation = {
            id: generateId(),
            type: 'arrow',
            color: state.activeColor,
            strokeWidth: sizeConfig.stroke,
            geometry: [x, y, x, y], // Start with zero length
            timestamp: Date.now()
        };
        return { type: 'UPDATE_ANNOTATION', annotation: this.currentAnnotation };
    }

    onMouseMove(x: number, y: number, state: ToolState): ToolAction {
        if (!this.startPos || !this.currentAnnotation) return { type: 'NONE' };
        
        // Update end point
        this.currentAnnotation = {
            ...this.currentAnnotation,
            geometry: [this.startPos.x, this.startPos.y, x, y]
        };
        
        return { type: 'UPDATE_ANNOTATION', annotation: this.currentAnnotation };
    }

    onMouseUp(x: number, y: number, state: ToolState): ToolAction {
        if (!this.currentAnnotation) return { type: 'NONE' };
        
        const geo = this.currentAnnotation.geometry as number[];
        // Check length to avoid zero-length arrows
        const dist = Math.hypot(geo[2] - geo[0], geo[3] - geo[1]);
        
        if (dist < 0.01) {
            this.startPos = null;
            this.currentAnnotation = null;
            return { type: 'CANCEL' };
        }

        const result: ToolAction = { 
            type: 'COMMIT_ANNOTATION', 
            annotation: this.currentAnnotation 
        };
        
        this.startPos = null;
        this.currentAnnotation = null;
        return result;
    }
}