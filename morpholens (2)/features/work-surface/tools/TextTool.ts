
import { generateId } from "../../../lib/utils";
import { CanvasTool, ToolAction, ToolState, SIZE_CONFIG } from "./ToolTypes";

export class TextTool implements CanvasTool {
    id = 'text';
    label = 'Text';
    cursor = 'text';

    onMouseDown(x: number, y: number, state: ToolState): ToolAction {
        const sizeConfig = SIZE_CONFIG[state.activeSize];
        return {
            type: 'COMMIT_ANNOTATION',
            annotation: {
                id: generateId(),
                type: 'text',
                color: state.activeColor,
                geometry: [x, y],
                text: 'New Label',
                fontSize: sizeConfig.font,
                timestamp: Date.now()
            }
        };
    }

    onMouseMove(x: number, y: number, state: ToolState): ToolAction {
        return { type: 'NONE' };
    }

    onMouseUp(x: number, y: number, state: ToolState): ToolAction {
        return { type: 'NONE' };
    }
}