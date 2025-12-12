
import { CanvasTool } from "./ToolTypes";
import { BoxTool } from "./BoxTool";
import { PointTool } from "./PointTool";
import { PolygonTool } from "./PolygonTool";
import { TextTool } from "./TextTool";
import { ArrowTool } from "./ArrowTool";

// Instantiated tools
const TOOLS: Record<string, CanvasTool> = {
    box: new BoxTool(),
    point: new PointTool(),
    polygon: new PolygonTool(),
    text: new TextTool(),
    arrow: new ArrowTool(),
};

export const getCanvasTool = (id: string) => TOOLS[id];
export const getAllCanvasTools = () => Object.values(TOOLS);
