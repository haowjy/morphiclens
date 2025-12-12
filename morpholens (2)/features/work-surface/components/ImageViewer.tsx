
import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Hand, MousePointer2, Square, Loader2, Plus, Minus, RotateCcw, Hexagon, Check, Type, MoveUpRight, Circle, Settings2 } from "lucide-react";
import useImage from "use-image";
import { AppFile, AppActionType, Annotation, AnalysisLayer } from "../../../types";
import { Button } from "../../../components/ui/Button";
import { FileIcon } from "../../../components/ui/FileIcon";
import { cn, generateId } from "../../../lib/utils";
import { useDragResize, useResponsiveDimensions } from "../../../lib/hooks";
import { pyodideService } from "../../../services/pyodideService";
import { ToolAction, SizeLevel } from "../tools/ToolTypes";
import { getCanvasTool } from "../tools/canvasRegistry";
import { InspectorPanel } from "./InspectorPanel";
import { useFilePreview } from "../../files/hooks/useFilePreview";
import { FloatingToolbar, ToolbarButton, ToolbarGroup, ToolbarSeparator } from "./FloatingToolbar";

declare const Konva: any;

type ToolId = 'pan' | 'box' | 'point' | 'polygon' | 'text' | 'arrow';

const COLORS = [
    { label: 'Red', value: '#ef4444' },
    { label: 'Green', value: '#10b981' },
    { label: 'Blue', value: '#3b82f6' },
    { label: 'Yellow', value: '#eab308' },
    { label: 'Purple', value: '#a855f7' },
    { label: 'White', value: '#ffffff' },
];

const SIZES: { id: SizeLevel; label: string; scale: number }[] = [
    { id: 'sm', label: 'Small', scale: 0.7 },
    { id: 'md', label: 'Medium', scale: 1 },
    { id: 'lg', label: 'Large', scale: 1.4 },
    { id: 'xl', label: 'X-Large', scale: 2 },
];

interface ImageViewerProps {
  file: AppFile;
  dispatch: React.Dispatch<any>;
  onBack?: () => void;
}

const getPointerOnImage = (stage: any, image: HTMLImageElement) => {
  const pointer = stage.getPointerPosition();
  if (!pointer) return null;
  const oldScale = stage.scaleX();
  const ix = (pointer.x - stage.x()) / oldScale;
  const iy = (pointer.y - stage.y()) / oldScale;
  return { nx: ix / image.width, ny: iy / image.height };
};

export const ImageViewer: React.FC<ImageViewerProps> = ({ file, dispatch, onBack }) => {
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorHeight, setInspectorHeight] = useState(320); 
  const [activeToolId, setActiveToolId] = useState<ToolId>('pan');
  const [activeColor, setActiveColor] = useState(COLORS[0].value);
  const [activeSize, setActiveSize] = useState<SizeLevel>('md');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isSizePickerOpen, setIsSizePickerOpen] = useState(false);
  const [viewOptions, setViewOptions] = useState({ showAnnotations: true, showLabels: true });
  const [isViewOptionsOpen, setIsViewOptionsOpen] = useState(false);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  const stageRef = useRef<any>(null);
  const imageLayerRef = useRef<any>(null);
  const annotationLayerRef = useRef<any>(null);
  const [draftAnnotation, setDraftAnnotation] = useState<Annotation | null>(null);
  const isInteracting = useRef(false);
  const [rasterImages, setRasterImages] = useState<Record<string, HTMLImageElement>>({});

  // Use robust callback-ref based resizing hook
  const { ref: containerRef, width: containerWidth, height: containerHeight, element: containerElement } = useResponsiveDimensions();

  // Unified Preview Hook
  const { previewUrl, status: previewStatus, error: previewError, generatePreview } = useFilePreview(file);

  // Trigger generation if needed
  useEffect(() => {
      if (previewStatus === 'idle') {
          generatePreview(file).then(res => {
              if (res) {
                  dispatch({ 
                      type: AppActionType.REPLACE_FILE, 
                      payload: { 
                          ...file, 
                          preview: { 
                              url: res.url, 
                              mimeType: res.mimeType, 
                              generatedAt: Date.now() 
                          } 
                      } 
                  });
              }
          });
      }
  }, [file.id, previewStatus, generatePreview, dispatch]);

  const { isResizing, startResizing } = useDragResize(
    useCallback((e) => {
        const newHeight = window.innerHeight - e.clientY;
        if (newHeight > 200 && newHeight < window.innerHeight * 0.8) setInspectorHeight(newHeight);
    }, [])
  );

  const processToolAction = useCallback((action: ToolAction) => {
      if (action.type === 'UPDATE_ANNOTATION') {
          setDraftAnnotation(action.annotation);
      } else if (action.type === 'COMMIT_ANNOTATION') {
          setDraftAnnotation(null);
          setIsInspectorOpen(true);
          const layers = file.analysis?.layers || [];
          let activeLayerId = file.analysis?.activeLayerId;
          let targetLayer = layers.find(l => l.id === activeLayerId);

          if (!targetLayer || targetLayer.locked || targetLayer.type !== 'VECTOR') {
              const newLayerId = generateId();
              let counter = 1;
              while (layers.some(l => l.name === `Layer ${counter}`)) counter++;
              const newLayer: AnalysisLayer = {
                  id: newLayerId,
                  name: `Layer ${counter}`,
                  type: 'VECTOR',
                  style: { visible: true, opacity: 1 },
                  source: [action.annotation]
              };
              dispatch({ type: AppActionType.ADD_LAYER, payload: { fileId: file.id, layer: newLayer } });
          } else {
              const currentAnnotations = (targetLayer.source as Annotation[]) || [];
              dispatch({ 
                  type: AppActionType.UPDATE_LAYER_ANNOTATIONS, 
                  payload: { fileId: file.id, layerId: targetLayer.id, annotations: [...currentAnnotations, action.annotation] } 
              });
          }

          if (['box', 'polygon', 'arrow'].includes(action.annotation.type)) setActiveToolId('pan');
      } else if (action.type === 'CANCEL') {
          setDraftAnnotation(null);
      }
  }, [file, dispatch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        if (e.code === 'Space' && !e.repeat) setIsSpacePressed(true);
        switch(e.key.toLowerCase()) {
            case '1': setActiveToolId('pan'); break;
            case '2': setActiveToolId('box'); break;
            case '3': setActiveToolId('point'); break;
            case '4': setActiveToolId('polygon'); break;
            case '5': setActiveToolId('text'); break;
            case '6': setActiveToolId('arrow'); break;
            case 'escape': 
                if (draftAnnotation) setDraftAnnotation(null);
                else if (activeToolId !== 'pan') setActiveToolId('pan');
                break;
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setIsSpacePressed(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [draftAnnotation, activeToolId]);

  // Tool Switching Logic
  useEffect(() => { 
      // 1. Clear current draft from view (Tools like Polygon retain state internally)
      setDraftAnnotation(null); 
      
      // 2. Check if the new tool has persistent state to restore
      const tool = getCanvasTool(activeToolId);
      // We pass a mock state because onActivate usually just needs to know *if* it should restore, 
      // not necessarily the exact pixels yet. The tool will return its stored annotation.
      if (tool && tool.onActivate) {
          const action = tool.onActivate({ 
              imageWidth: 100, imageHeight: 100, scale: 1, 
              activeColor, activeSize 
          });
          if (action && action.type !== 'NONE') {
              processToolAction(action);
          }
      }
  }, [activeToolId, activeColor, activeSize, processToolAction]);

  const [image] = useImage(previewUrl || '', 'anonymous');

  // Memoize raster layers signature to avoid reloading images on unrelated changes
  const rasterLayersSignature = useMemo(() => {
      return (file.analysis?.layers || [])
          .filter(l => l.type === 'RASTER' && !l.locked)
          .map(l => `${l.id}:${typeof l.source === 'string' ? l.source : 'blob'}:${l.style.opacity}:${l.style.visible}`)
          .join('|');
  }, [file.analysis?.layers]);

  useEffect(() => {
    let isMounted = true;
    const loadSecondaryLayers = async () => {
        const newImages: Record<string, HTMLImageElement> = {};
        const rasterLayers = file.analysis?.layers?.filter(l => l.type === 'RASTER' && !l.locked) || [];
        
        // If nothing to load and nothing loaded, return
        if (rasterLayers.length === 0 && Object.keys(rasterImages).length === 0) return;

        for (const l of rasterLayers) {
            if (typeof l.source === 'string') {
                try {
                    // Optimization: Reuse existing image if available
                    if (rasterImages[l.id]) { newImages[l.id] = rasterImages[l.id]; continue; }
                    
                    let blob: Blob;
                    if (l.source.startsWith('/')) blob = await pyodideService.getFileAsBlob(l.source);
                    else { const res = await fetch(l.source); blob = await res.blob(); }
                    
                    const img = new Image();
                    img.src = URL.createObjectURL(blob);
                    await new Promise((resolve) => { img.onload = resolve; });
                    newImages[l.id] = img;
                } catch(e) {}
            }
        }
        
        if (isMounted) {
            // Only update state if keys are different, preventing Stage destruction
            const currentKeys = Object.keys(rasterImages).sort().join(',');
            const newKeys = Object.keys(newImages).sort().join(',');
            if (currentKeys !== newKeys) {
                setRasterImages(newImages);
            }
        }
    };
    loadSecondaryLayers();
    return () => { isMounted = false; };
  }, [rasterLayersSignature]); 

  // Stage Initialization
  useEffect(() => {
    if (!containerElement || !image) return;
    
    // Create Stage
    const stage = new Konva.Stage({
        container: containerElement,
        width: containerElement.clientWidth || 800,
        height: containerElement.clientHeight || 600,
        draggable: activeToolId === 'pan' || isSpacePressed,
    });
    
    const imageLayer = new Konva.Layer();
    const annotationLayer = new Konva.Layer();
    
    // Base Image
    imageLayer.add(new Konva.Image({ image: image, x: 0, y: 0 }));

    // Raster Layers
    const layers = file.analysis?.layers || [];
    layers.forEach(l => {
        if (l.type === 'RASTER' && !l.locked && rasterImages[l.id]) {
            imageLayer.add(new Konva.Image({
                image: rasterImages[l.id],
                x: 0, y: 0,
                width: image.width, height: image.height,
                opacity: l.style.opacity, visible: l.style.visible, listening: false
            }));
        }
    });

    stage.add(imageLayer);
    stage.add(annotationLayer);
    
    stageRef.current = stage;
    imageLayerRef.current = imageLayer;
    annotationLayerRef.current = annotationLayer;
    
    stage.scale({ x: scale, y: scale });
    stage.position(position);
    stage.batchDraw();

    return () => { 
        stage.destroy(); 
        stageRef.current = null; 
    };
  }, [image, rasterImages, containerElement]); 

  // Reactive Stage Resizing
  useEffect(() => {
      const stage = stageRef.current;
      if (stage && containerWidth > 0 && containerHeight > 0) {
          if (stage.width() !== containerWidth || stage.height() !== containerHeight) {
              stage.width(containerWidth);
              stage.height(containerHeight);
              stage.batchDraw();
          }
      }
  }, [containerWidth, containerHeight]);

  // Update Draggable State Reactively
  useEffect(() => {
      const stage = stageRef.current;
      if (stage) {
          stage.draggable(activeToolId === 'pan' || isSpacePressed);
      }
  }, [activeToolId, isSpacePressed]);

  // Update Scale/Pos Reactively
  useEffect(() => {
      const stage = stageRef.current;
      if (stage) {
          stage.scale({ x: scale, y: scale });
          stage.position(position);
          stage.batchDraw();
      }
  }, [scale, position]);

  // Annotations Rendering
  useEffect(() => {
      const layer = annotationLayerRef.current;
      if (!layer || !image) return;
      layer.destroyChildren();

      const layers = file.analysis?.layers || [];
      const visibleAnnotations: Annotation[] = [];
      
      if (viewOptions.showAnnotations) {
          layers.forEach(l => {
              if (l.type === 'VECTOR' && l.style.visible) {
                   visibleAnnotations.push(...(l.source as Annotation[] || []));
              }
          });
          if (draftAnnotation) visibleAnnotations.push(draftAnnotation);
      }

      visibleAnnotations.forEach((annot, i) => {
          const isDraft = annot === draftAnnotation;
          const strokeWidth = (annot.strokeWidth ? annot.strokeWidth : 2) / scale;
          const radius = (annot.radius ? annot.radius : 5) / scale;
          const fontSize = (annot.fontSize ? annot.fontSize : 14) / scale;
          const labelText = annot.label ? annot.label : `#${i + 1}`;

          const drawLabel = (x: number, y: number) => {
              const padding = 3 / scale;
              const labelFontSize = 12 / scale;
              const text = new Konva.Text({ x: padding, y: padding, text: labelText, fontSize: labelFontSize, fontFamily: 'sans-serif', fill: 'white', listening: false });
              const bg = new Konva.Rect({ x: 0, y: 0, width: text.width() + (padding * 2), height: text.height() + (padding * 2), fill: 'rgba(0,0,0,0.7)', cornerRadius: 3 / scale, listening: false });
              const group = new Konva.Group({ x, y, listening: false });
              group.add(bg); group.add(text); layer.add(group);
          };

          const common = { listening: !isDraft, onMouseEnter: () => setHoveredAnnotationId(annot.id), onMouseLeave: () => setHoveredAnnotationId(null) };
          if (isDraft) Object.assign(common, { listening: false });

          if (annot.type === 'box') {
              const [nx, ny, nw, nh] = annot.geometry as number[];
              layer.add(new Konva.Rect({ x: nx * image.width, y: ny * image.height, width: nw * image.width, height: nh * image.height, stroke: annot.color, fill: `${annot.color}33`, strokeWidth, dash: isDraft ? [4, 4] : undefined, ...common }));
              if (viewOptions.showLabels && annot.id === hoveredAnnotationId && !isDraft) drawLabel(nx * image.width, (ny * image.height) - (20 / scale));
          } else if (annot.type === 'point') {
              const [nx, ny] = annot.geometry as number[];
              layer.add(new Konva.Circle({ x: nx * image.width, y: ny * image.height, radius, fill: annot.color, stroke: 'white', strokeWidth: 1 / scale, ...common }));
              if (viewOptions.showLabels && annot.id === hoveredAnnotationId && !isDraft) drawLabel((nx * image.width) + radius + 4/scale, (ny * image.height) - 10/scale);
          } else if (annot.type === 'polygon') {
               let points = Array.isArray(annot.geometry[0]) ? (annot.geometry as number[][]).flat() : annot.geometry as number[];
               const denormalized = points.map((v, idx) => idx % 2 === 0 ? v * image.width : v * image.height);
               layer.add(new Konva.Line({ points: denormalized, stroke: annot.color, strokeWidth, closed: !isDraft, fill: !isDraft ? `${annot.color}33` : undefined, dash: isDraft ? [5, 5] : undefined, ...common }));
               
               // Draw Vertices (Handles) for Polygon
               if (isDraft || annot.id === hoveredAnnotationId) {
                   for (let j = 0; j < denormalized.length; j += 2) {
                       const vx = denormalized[j];
                       const vy = denormalized[j + 1];
                       const isStart = j === 0;
                       
                       layer.add(new Konva.Circle({
                           x: vx,
                           y: vy,
                           radius: (isStart && isDraft ? 6 : 3) / scale,
                           fill: 'white',
                           stroke: annot.color,
                           strokeWidth: (isStart && isDraft ? 2 : 1) / scale,
                           listening: false
                       }));
                   }
               }

               if (viewOptions.showLabels && points.length >= 2 && annot.id === hoveredAnnotationId && !isDraft) drawLabel(points[0] * image.width, (points[1] * image.height) - 20/scale);
          } else if (annot.type === 'text') {
              const [nx, ny] = annot.geometry as number[];
              layer.add(new Konva.Text({ x: nx * image.width, y: ny * image.height, text: annot.text || annot.label || "Text", fontSize, fill: annot.color, fontFamily: 'sans-serif', ...common }));
          } else if (annot.type === 'arrow') {
               const [x1, y1, x2, y2] = annot.geometry as number[];
               layer.add(new Konva.Arrow({ points: [x1 * image.width, y1 * image.height, x2 * image.width, y2 * image.height], pointerLength: 10/scale, pointerWidth: 10/scale, fill: annot.color, stroke: annot.color, strokeWidth: strokeWidth * 2, ...common }));
          }
      });
      layer.batchDraw();
  }, [file.analysis?.layers, draftAnnotation, scale, image, hoveredAnnotationId, viewOptions, rasterImages]); 

  const handleWheel = (e: any) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const scaleBy = 1.1;
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
      let newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
      if (newScale < 0.1) newScale = 0.1; if (newScale > 50) newScale = 50;
      setScale(newScale);
      const newPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };
      setPosition(newPos);
      stage.scale({ x: newScale, y: newScale }); stage.position(newPos); stage.batchDraw();
  };

  useEffect(() => {
      const stage = stageRef.current;
      if (!stage || !image) return;
      const getToolState = () => ({ imageWidth: image.width, imageHeight: image.height, scale, activeColor, activeSize });

      const onMouseDown = () => {
          if (activeToolId === 'pan' || isSpacePressed) return;
          const tool = getCanvasTool(activeToolId);
          const point = getPointerOnImage(stage, image);
          if (!tool || !point) return;
          isInteracting.current = true;
          processToolAction(tool.onMouseDown(point.nx, point.ny, getToolState()));
      };

      const onMouseMove = () => {
          if (!isInteracting.current || activeToolId === 'pan' || isSpacePressed) return;
          const tool = getCanvasTool(activeToolId);
          const point = getPointerOnImage(stage, image);
          if (tool && point) processToolAction(tool.onMouseMove(point.nx, point.ny, getToolState()));
      };

      const onMouseUp = () => {
          if (activeToolId === 'pan' || isSpacePressed) { setPosition({ x: stage.x(), y: stage.y() }); return; }
          // Process even if isInteracting is false, because some tools (like Polygon) use click-release flow
          const tool = getCanvasTool(activeToolId);
          const point = getPointerOnImage(stage, image);
          if (tool && point) processToolAction(tool.onMouseUp(point.nx, point.ny, getToolState()));
          
          isInteracting.current = false;
      };

      stage.on('wheel', handleWheel); stage.on('mousedown', onMouseDown); stage.on('mousemove', onMouseMove);
      stage.on('mouseup', onMouseUp); stage.on('mouseleave', onMouseUp); stage.on('dragend', () => setPosition({ x: stage.x(), y: stage.y() }));

      return () => { stage.off('wheel', handleWheel); stage.off('mousedown', onMouseDown); stage.off('mousemove', onMouseMove); stage.off('mouseup', onMouseUp); stage.off('mouseleave', onMouseUp); stage.off('dragend'); };
  }, [image, activeToolId, isSpacePressed, scale, processToolAction, activeColor, activeSize]); 

  let cursor = 'default';
  if (hoveredAnnotationId) cursor = 'pointer';
  else if (activeToolId === 'pan' || isSpacePressed) cursor = 'grab';
  else { const t = getCanvasTool(activeToolId); if (t) cursor = t.cursor; }

  const isLoading = previewStatus === 'converting' || previewStatus === 'idle';

  return (
    <div className="relative w-full h-full bg-zinc-100 overflow-hidden">
        {/* Unified Floating Toolbar */}
        <FloatingToolbar>
            <div className="flex items-center gap-2 pl-1 pr-1">
                {onBack && <Button variant="ghost" size="icon" onClick={onBack} className="h-6 w-6 -ml-1 rounded-full md:hidden"><div/></Button>}
                <FileIcon type={file.type} size={16} />
                <span className="font-semibold text-sm text-zinc-800 max-w-[120px] sm:max-w-[200px] truncate">{file.name}</span>
            </div>
            
            <ToolbarSeparator />
            
            <ToolbarGroup>
                <ToolbarButton active={activeToolId === 'pan'} onClick={() => setActiveToolId('pan')} title="Pan (1)" shortcut="1">
                    <Hand size={16} />
                </ToolbarButton>
                <ToolbarButton active={activeToolId === 'box'} onClick={() => setActiveToolId('box')} title="Box (2)" shortcut="2">
                    <Square size={16} />
                </ToolbarButton>
                <ToolbarButton active={activeToolId === 'point'} onClick={() => setActiveToolId('point')} title="Point (3)" shortcut="3">
                    <MousePointer2 size={16} />
                </ToolbarButton>
                <ToolbarButton active={activeToolId === 'polygon'} onClick={() => setActiveToolId('polygon')} title="Polygon (4)" shortcut="4">
                    <Hexagon size={16} />
                </ToolbarButton>
                <ToolbarButton active={activeToolId === 'text'} onClick={() => setActiveToolId('text')} title="Text (5)" shortcut="5">
                    <Type size={16} />
                </ToolbarButton>
                <ToolbarButton active={activeToolId === 'arrow'} onClick={() => setActiveToolId('arrow')} title="Arrow (6)" shortcut="6">
                    <MoveUpRight size={16} />
                </ToolbarButton>
            </ToolbarGroup>

            <ToolbarSeparator />

            {/* Appearance Controls */}
            <div className="relative">
                <button onClick={() => { setIsColorPickerOpen(!isColorPickerOpen); setIsSizePickerOpen(false); }} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100"><div className="w-4 h-4 rounded-full border border-zinc-200 shadow-sm" style={{ backgroundColor: activeColor }} /></button>
                {isColorPickerOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsColorPickerOpen(false)} />
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 bg-white rounded-lg shadow-xl border border-zinc-200 z-50 flex flex-col gap-1 min-w-[140px] animate-in fade-in zoom-in-95 duration-200">
                            {COLORS.map(c => <button key={c.value} onClick={() => { setActiveColor(c.value); setIsColorPickerOpen(false); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-50 rounded text-xs font-medium text-zinc-700"><div className="w-3 h-3 rounded-full border border-zinc-200" style={{ backgroundColor: c.value }} />{c.label}</button>)}
                        </div>
                    </>
                )}
            </div>
            <div className="relative">
                <button onClick={() => { setIsSizePickerOpen(!isSizePickerOpen); setIsColorPickerOpen(false); }} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100"><Circle size={14} className="text-zinc-600" /><div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-zinc-900 border border-white text-[7px] flex items-center justify-center font-mono leading-none">{activeSize.charAt(0).toUpperCase()}</div></button>
                {isSizePickerOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsSizePickerOpen(false)} />
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 bg-white rounded-lg shadow-xl border border-zinc-200 z-50 flex flex-col gap-1 min-w-[140px] animate-in fade-in zoom-in-95 duration-200">
                            {SIZES.map(s => <button key={s.id} onClick={() => { setActiveSize(s.id); setIsSizePickerOpen(false); }} className="flex items-center gap-3 px-2 py-1.5 hover:bg-zinc-50 rounded text-xs font-medium text-zinc-700 group"><div className="w-4 flex items-center justify-center"><div className="rounded-full bg-zinc-800" style={{ width: 4 * s.scale, height: 4 * s.scale }} /></div><span>{s.label}</span>{activeSize === s.id && <Check size={12} className="ml-auto text-indigo-600" />}</button>)}
                        </div>
                    </>
                )}
            </div>
            
            <ToolbarSeparator />

            {/* View Options */}
            <div className="relative">
                <button onClick={() => setIsViewOptionsOpen(!isViewOptionsOpen)} className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors", isViewOptionsOpen ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-100")}><Settings2 size={16} /></button>
                {isViewOptionsOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsViewOptionsOpen(false)} />
                        <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-zinc-200 z-50 p-1 animate-in fade-in zoom-in-95 duration-200">
                            <button onClick={() => setViewOptions(p => ({ ...p, showAnnotations: !p.showAnnotations }))} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-50 rounded text-xs text-zinc-700"><div className={cn("w-4 h-4 flex items-center justify-center rounded border", viewOptions.showAnnotations ? "bg-indigo-500 border-indigo-500 text-white" : "border-zinc-300")}>{viewOptions.showAnnotations && <Check size={10} />}</div><span>Show Annotations</span></button>
                            <button onClick={() => setViewOptions(p => ({ ...p, showLabels: !p.showLabels }))} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-50 rounded text-xs text-zinc-700"><div className={cn("w-4 h-4 flex items-center justify-center rounded border", viewOptions.showLabels ? "bg-indigo-500 border-indigo-500 text-white" : "border-zinc-300")}>{viewOptions.showLabels && <Check size={10} />}</div><span>Show Labels</span></button>
                        </div>
                    </>
                )}
            </div>
        </FloatingToolbar>

        {/* Viewport */}
        <div className="absolute top-0 left-0 right-0 bg-zinc-50 overflow-hidden" style={{ bottom: isInspectorOpen ? `${inspectorHeight}px` : '3rem', cursor, transition: isResizing ? 'none' : 'bottom 0.1s ease-out' }}>
            {isLoading ? ( 
                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400">
                    <Loader2 size={32} className="animate-spin mb-2 text-indigo-500" />
                    <span className="text-sm font-medium">Converting Preview...</span>
                </div> 
            ) : previewError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400">
                    <span className="text-sm font-medium text-red-500 mb-2">{previewError}</span>
                    <Button variant="outline" size="sm" onClick={() => generatePreview(file)}>Retry</Button>
                </div>
            ) : previewUrl ? (
                <>
                    <div ref={containerRef} className="w-full h-full" />
                    <div className="absolute bottom-6 right-6 flex flex-col gap-1 z-30 pointer-events-auto">
                        <Button variant="secondary" size="icon" onClick={() => { const s = stageRef.current; if(s) { setScale(Math.min(scale * 1.2, 50)); s.scale({ x: Math.min(scale * 1.2, 50), y: Math.min(scale * 1.2, 50) }); s.batchDraw(); }}} className="rounded-full shadow-sm bg-white hover:bg-zinc-50"><Plus size={16} /></Button>
                        <Button variant="secondary" size="icon" onClick={() => { const s = stageRef.current; if(s) { setScale(Math.max(scale / 1.2, 0.1)); s.scale({ x: Math.max(scale / 1.2, 0.1), y: Math.max(scale / 1.2, 0.1) }); s.batchDraw(); }}} className="rounded-full shadow-sm bg-white hover:bg-zinc-50"><Minus size={16} /></Button>
                        <Button variant="secondary" size="icon" onClick={() => { const s = stageRef.current; if(s) { setScale(1); setPosition({x:0,y:0}); s.scale({x:1,y:1}); s.position({x:0,y:0}); s.batchDraw(); }}} className="rounded-full shadow-sm bg-white hover:bg-zinc-50"><RotateCcw size={14} /></Button>
                    </div>
                </>
            ) : <div className="absolute inset-0 flex items-center justify-center text-zinc-300">No Image Loaded</div>}
        </div>
        <InspectorPanel file={file} isOpen={isInspectorOpen} height={inspectorHeight} onResizeStart={startResizing} onToggle={() => setIsInspectorOpen(!isInspectorOpen)} dispatch={dispatch} />
    </div>
  );
};
