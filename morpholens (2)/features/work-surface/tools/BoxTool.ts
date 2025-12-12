
import { generateId } from "../../../lib/utils";
import { Annotation } from "../../../types";
import { CanvasTool, ToolAction, ToolState, SIZE_CONFIG } from "./ToolTypes";

export class BoxTool implements CanvasTool {
    id = 'box';
    label = 'Box';
    cursor = 'crosshair';
    
    private startPos: { x: number, y: number } | null = null;
    private currentAnnotation: Annotation | null = null;

    onMouseDown(x: number, y: number, state: ToolState): ToolAction {
        const sizeConfig = SIZE_CONFIG[state.activeSize];
        this.startPos = { x, y };
        this.currentAnnotation = {
            id: generateId(),
            type: 'box',
            color: state.activeColor,
            strokeWidth: sizeConfig.stroke,
            geometry: [x, y, 0, 0],
            timestamp: Date.now()
        };
        return { type: 'UPDATE_ANNOTATION', annotation: this.currentAnnotation };
    }

    onMouseMove(x: number, y: number, state: ToolState): ToolAction {
        if (!this.startPos || !this.currentAnnotation) return { type: 'NONE' };
        
        const w = x - this.startPos.x;
        const h = y - this.startPos.y;

        this.currentAnnotation = {
            ...this.currentAnnotation,
            geometry: [this.startPos.x, this.startPos.y, w, h]
        };
        
        return { type: 'UPDATE_ANNOTATION', annotation: this.currentAnnotation };
    }

    onMouseUp(x: number, y: number, state: ToolState): ToolAction {
        if (!this.currentAnnotation) return { type: 'NONE' };
        
        // Finalize geometry (handle negative width/height)
        const geometry = this.currentAnnotation.geometry as number[];
        const [bx, by, bw, bh] = geometry;
        const finalGeo = [
            bw < 0 ? bx + bw : bx,
            bh < 0 ? by + bh : by,
            Math.abs(bw),
            Math.abs(bh)
        ];
        
        // Ignore tiny boxes
        if (finalGeo[2] < 0.01 || finalGeo[3] < 0.01) {
            this.startPos = null;
            this.currentAnnotation = null;
            return { type: 'CANCEL' };
        }

        const result: ToolAction = { 
            type: 'COMMIT_ANNOTATION', 
            annotation: { ...this.currentAnnotation, geometry: finalGeo } 
        };
        
        this.startPos = null;
        this.currentAnnotation = null;
        return result;
    }
}