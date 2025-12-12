
import { generateId } from "../../../lib/utils";
import { Annotation } from "../../../types";
import { CanvasTool, ToolAction, ToolState, SIZE_CONFIG } from "./ToolTypes";

export class PolygonTool implements CanvasTool {
    id = 'polygon';
    label = 'Polygon';
    cursor = 'crosshair';
    
    // Persistent state
    private points: number[] = [];
    private currentDraftId: string | null = null;

    onActivate(state: ToolState): ToolAction {
        // If we have points, restore the draft immediately
        if (this.points.length > 0) {
            const sizeConfig = SIZE_CONFIG[state.activeSize];
            return {
                type: 'UPDATE_ANNOTATION',
                annotation: {
                    id: this.currentDraftId || 'draft-poly',
                    type: 'polygon',
                    color: state.activeColor,
                    strokeWidth: sizeConfig.stroke,
                    geometry: this.points,
                    timestamp: Date.now()
                }
            };
        }
        return { type: 'NONE' };
    }

    onMouseDown(x: number, y: number, state: ToolState): ToolAction {
        // We handle point addition on MouseUp to prevent drag-conflicts
        return { type: 'NONE' };
    }

    onMouseMove(x: number, y: number, state: ToolState): ToolAction {
        // If we haven't started drawing, do nothing
        if (this.points.length === 0) return { type: 'NONE' };
        
        // Show "elastic band": existing points + current mouse position
        const previewGeo = [...this.points, x, y];
        const sizeConfig = SIZE_CONFIG[state.activeSize];
        
        const draft: Annotation = {
            id: this.currentDraftId || 'draft-poly',
            type: 'polygon',
            color: state.activeColor,
            strokeWidth: sizeConfig.stroke,
            geometry: previewGeo,
            timestamp: Date.now()
        };
        
        return { type: 'UPDATE_ANNOTATION', annotation: draft };
    }

    onMouseUp(x: number, y: number, state: ToolState): ToolAction {
        const sizeConfig = SIZE_CONFIG[state.activeSize];

        // Initialize draft ID if starting new
        if (this.points.length === 0) {
            this.currentDraftId = generateId();
        }

        // Check for closure conditions if we have enough points (at least 2 points / 4 coords)
        if (this.points.length >= 4) {
            
            // 1. Check distance to Start Point (Closing the loop explicitly)
            const startX = this.points[0];
            const startY = this.points[1];
            const dStart = Math.hypot(
                (x - startX) * state.imageWidth * state.scale, 
                (y - startY) * state.imageHeight * state.scale
            );

            // Snap distance: 20px screen threshold
            if (dStart < 20) {
                return this.commit(state);
            }

            // 2. Check distance to Last Point (Double-click / "Finish here" gesture)
            const lastX = this.points[this.points.length - 2];
            const lastY = this.points[this.points.length - 1];
            const dLast = Math.hypot(
                (x - lastX) * state.imageWidth * state.scale, 
                (y - lastY) * state.imageHeight * state.scale
            );

            if (dLast < 5) {
                return this.commit(state);
            }
        }

        // Add new vertex
        this.points.push(x, y);

        return { 
            type: 'UPDATE_ANNOTATION', 
            annotation: {
                id: this.currentDraftId!,
                type: 'polygon',
                color: state.activeColor,
                strokeWidth: sizeConfig.stroke,
                geometry: this.points,
                timestamp: Date.now()
            } 
        };
    }

    private commit(state: ToolState): ToolAction {
        const sizeConfig = SIZE_CONFIG[state.activeSize];
        const finalGeo = [...this.points];
        
        // Reset persistent state
        this.points = []; 
        this.currentDraftId = null;
        
        return { 
            type: 'COMMIT_ANNOTATION', 
            annotation: {
                id: generateId(),
                type: 'polygon',
                color: state.activeColor,
                strokeWidth: sizeConfig.stroke,
                geometry: finalGeo,
                timestamp: Date.now()
            } 
        };
    }
}
