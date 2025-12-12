
import { generateId } from "../../../lib/utils";
import { Annotation } from "../../../types";
import { CanvasTool, ToolAction, ToolState, SIZE_CONFIG } from "./ToolTypes";

export class PointTool implements CanvasTool {
    id = 'point';
    label = 'Point';
    cursor = 'crosshair';

    private currentAnnotation: Annotation | null = null;

    onMouseDown(x: number, y: number, state: ToolState): ToolAction {
        const sizeConfig = SIZE_CONFIG[state.activeSize];
        this.currentAnnotation = {
            id: generateId(),
            type: 'point',
            color: state.activeColor,
            radius: sizeConfig.radius,
            geometry: [x, y],
            timestamp: Date.now()
        };
        // Use UPDATE_ANNOTATION to show draft point while mouse is held, 
        // deferring COMMIT to MouseUp to prevent state/listener thrashing during click.
        return {
            type: 'UPDATE_ANNOTATION',
            annotation: this.currentAnnotation
        };
    }

    onMouseMove(x: number, y: number, state: ToolState): ToolAction {
        if (!this.currentAnnotation) return { type: 'NONE' };
        
        // Allow fine-tuning position while holding
        this.currentAnnotation = {
            ...this.currentAnnotation,
            geometry: [x, y]
        };

        return {
            type: 'UPDATE_ANNOTATION',
            annotation: this.currentAnnotation
        };
    }

    onMouseUp(x: number, y: number, state: ToolState): ToolAction {
        if (!this.currentAnnotation) return { type: 'NONE' };

        const annotation = this.currentAnnotation;
        this.currentAnnotation = null;

        return {
            type: 'COMMIT_ANNOTATION',
            annotation: annotation
        };
    }
}
