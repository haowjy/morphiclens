

import React from 'react';

// Domain Entities

export enum FileType {
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT', // PDF, Markdown, Text, DOCX
  DATASET = 'DATASET', // CSV, JSON
  NOTE = 'NOTE', // Internal Markdown
  FOLDER = 'FOLDER', // New container type
  AUDIO = 'AUDIO', 
  VIDEO = 'VIDEO'
}

export type FileCategory = 'project' | 'session';

export type AnnotationType = 'box' | 'point' | 'polygon' | 'text' | 'arrow';

export interface Annotation {
  id: string;
  type: AnnotationType;
  color: string;
  label?: string;
  geometry: number[] | number[][];
  text?: string;
  fontSize?: number;
  backgroundColor?: string;
  strokeWidth?: number;
  radius?: number;
  timestamp?: number; 
}

export type LayerType = 'RASTER' | 'VECTOR' | 'HEATMAP';

export interface LayerStyle {
  opacity: number;       // 0 to 1
  visible: boolean;
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay';
  colorMap?: string;     // For single-channel masks (e.g., 'viridis')
  strokeColor?: string;  // For vectors
  fillColor?: string;    // For vectors
}

// --- Data Reporting Types ---

export type DataBlockType = 'kv' | 'text' | 'distribution' | 'image';

export interface DataBlockBase {
    id: string;
    type: DataBlockType;
    title?: string;
}

export interface KeyValueBlock extends DataBlockBase {
    type: 'kv';
    data: Record<string, string | number>;
}

export interface TextBlock extends DataBlockBase {
    type: 'text';
    content: string;
    variant?: 'neutral' | 'info' | 'warning' | 'success';
}

export interface DistributionBlock extends DataBlockBase {
    type: 'distribution';
    labels: string[]; // X-Axis labels
    values: number[]; // Heights
    color?: string;
}

export interface ImageBlock extends DataBlockBase {
    type: 'image';
    url: string; // VFS path (e.g. /.session/plot.png) or URL
    caption?: string;
}

export type DataBlock = KeyValueBlock | TextBlock | DistributionBlock | ImageBlock;

export interface AnalysisLayer {
  id: string;
  name: string;
  type: LayerType;
  locked?: boolean;
  source?: string | Annotation[]; 
  style: LayerStyle;
  metrics?: Record<string, any> | { blocks: DataBlock[] }; 
  viewConfig?: {
    preferredView: 'table' | 'chart' | 'summary';
    highlightRules?: string; 
  };
}

export interface AnalysisArtifact {
    id: string;
    name: string;
    type: 'PLOT' | 'IMAGE' | 'DATA';
    source: string; // VFS path
    createdAt: number;
}

export interface AppFile {
  id: string;
  name: string;
  type: FileType;
  mimeType?: string; 
  category: FileCategory; 
  url: string; 
  status?: string; 
  metadata?: Record<string, any>; 
  threadId?: string; 
  createdAt?: number; 
  sortOrder?: number; 
  virtualPath?: string; 
  annotations?: Annotation[];
  analysis?: {
      layers: AnalysisLayer[];
      activeLayerId: string | null;
      artifacts?: AnalysisArtifact[]; 
  };
  preview?: {
      url: string;
      mimeType: string;
      generatedAt: number;
  };
  providerMetadata?: {
    google?: {
      uri: string;
      mimeType: string;
      uploadTimestamp: number; 
    }
  };
}

export type ModelId = 'gemini-3-pro-preview' | 'gemini-2.5-flash' | 'gemini-flash-lite-latest';
export type ImageModelId = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';

export interface ChatThreadConfig {
    model: ModelId;
    imageModel?: ImageModelId;
    roleId?: string;
}

export interface ChatThread {
    id: string;
    title: string;
    updatedAt: number;
    preview: string;
    config?: ChatThreadConfig;
}

export interface ThreadPart {
  text?: string;
  thought?: string; 
  thoughtSignature?: string; 
  code?: string; 
  fileId?: string; 
  error?: string; 
  groundingMetadata?: {
    groundingChunks?: Array<{
      web?: { uri?: string; title?: string };
    }>;
    groundingSupports?: Array<{
      segment: { startIndex?: number; endIndex?: number; text?: string };
      groundingChunkIndices?: number[];
      confidenceScores?: number[];
    }>;
    webSearchQueries?: string[];
  };
  functionCall?: {
      name: string;
      args: Record<string, any>;
      id: string; 
  };
  functionResponse?: {
      name: string;
      response: Record<string, any>;
      id: string; 
  };
}

export interface ThreadContent {
  id: string;
  role: 'user' | 'model' | 'tool';
  parts: ThreadPart[];
  timestamp: number;
  turnId: string; 
}

export interface ThreadTurn {
  id: string;
  threadId: string;
  type: 'user' | 'assistant';
  status: 'streaming' | 'complete' | 'error';
  contents: ThreadContent[]; 
}

// State Management

export type ChatMode = 'plan' | 'agent';

export interface AppState {
  files: AppFile[];
  activeFileId: string | null;
  
  // Chat State
  threads: ChatThread[];
  activeThreadId: string | null;
  turnsByThread: Record<string, ThreadTurn[]>; 
  activeChatMode: ChatMode; // Kept for backward compat typing if needed, but unused
  activeRoleId: string; // New Role System
  
  // UI State
  isFilesCollapsed: boolean; 
  isLoading: boolean;
}

export enum AppActionType {
  HYDRATE = 'HYDRATE',
  SET_ACTIVE_FILE = 'SET_ACTIVE_FILE',
  ADD_FILE = 'ADD_FILE',
  REPLACE_FILE = 'REPLACE_FILE', 
  DELETE_FILE = 'DELETE_FILE',   
  MOVE_FILE = 'MOVE_FILE', 
  REORDER_FILE = 'REORDER_FILE', 
  UPDATE_FILE_METADATA = 'UPDATE_FILE_METADATA',
  UPDATE_FILE_ANNOTATIONS = 'UPDATE_FILE_ANNOTATIONS', 
  UPDATE_FILE_UPLOAD_STATUS = 'UPDATE_FILE_UPLOAD_STATUS', 

  // Layer Management Actions
  ADD_LAYER = 'ADD_LAYER',
  REMOVE_LAYER = 'REMOVE_LAYER',
  UPDATE_LAYER = 'UPDATE_LAYER',
  UPDATE_LAYER_ANNOTATIONS = 'UPDATE_LAYER_ANNOTATIONS',
  SET_ACTIVE_LAYER = 'SET_ACTIVE_LAYER',
  ATTACH_RELATED_FILE = 'ATTACH_RELATED_FILE',
  
  // Chat Actions
  CREATE_THREAD = 'CREATE_THREAD',
  SET_ACTIVE_THREAD = 'SET_ACTIVE_THREAD',
  RENAME_THREAD = 'RENAME_THREAD',
  UPDATE_THREAD_CONFIG = 'UPDATE_THREAD_CONFIG', 
  SET_CHAT_MODE = 'SET_CHAT_MODE',
  SET_ACTIVE_ROLE = 'SET_ACTIVE_ROLE',
  
  // Turn Actions
  ADD_TURN = 'ADD_TURN',
  UPDATE_TURN = 'UPDATE_TURN',
  
  TOGGLE_FILES = 'TOGGLE_FILES',
  SET_FILES_COLLAPSED = 'SET_FILES_COLLAPSED',
  SET_LOADING = 'SET_LOADING',
}

export type AppAction =
  | { type: AppActionType.HYDRATE; payload: Partial<AppState> }
  | { type: AppActionType.SET_ACTIVE_FILE; payload: string | null }
  | { type: AppActionType.ADD_FILE; payload: AppFile }
  | { type: AppActionType.REPLACE_FILE; payload: AppFile }
  | { type: AppActionType.DELETE_FILE; payload: string }
  | { type: AppActionType.MOVE_FILE; payload: { fileId: string; newVirtualPath: string } }
  | { type: AppActionType.REORDER_FILE; payload: { fileId: string; sortOrder: number; newVirtualPath?: string } }
  | { type: AppActionType.UPDATE_FILE_METADATA; payload: { id: string; metadata: Record<string, any> } }
  | { type: AppActionType.UPDATE_FILE_ANNOTATIONS; payload: { id: string; annotations: Annotation[] } }
  | { type: AppActionType.UPDATE_FILE_UPLOAD_STATUS; payload: { id: string; providerMetadata: any } }
  
  // Layer Actions
  | { type: AppActionType.ADD_LAYER; payload: { fileId: string; layer: AnalysisLayer } }
  | { type: AppActionType.REMOVE_LAYER; payload: { fileId: string; layerId: string } }
  | { type: AppActionType.UPDATE_LAYER; payload: { fileId: string; layerId: string; updates: Partial<AnalysisLayer> } }
  | { type: AppActionType.UPDATE_LAYER_ANNOTATIONS; payload: { fileId: string; layerId: string; annotations: Annotation[] } }
  | { type: AppActionType.SET_ACTIVE_LAYER; payload: { fileId: string; layerId: string | null } }
  | { type: AppActionType.ATTACH_RELATED_FILE; payload: { fileId: string; artifact: AnalysisArtifact } }

  | { type: AppActionType.CREATE_THREAD; payload: AppActionType.CREATE_THREAD extends any ? ChatThread : never }
  | { type: AppActionType.SET_ACTIVE_THREAD; payload: string | null }
  | { type: AppActionType.RENAME_THREAD; payload: { threadId: string; newTitle: string } }
  | { type: AppActionType.UPDATE_THREAD_CONFIG; payload: { threadId: string; config: Partial<ChatThreadConfig> } }
  | { type: AppActionType.SET_CHAT_MODE; payload: ChatMode }
  | { type: AppActionType.SET_ACTIVE_ROLE; payload: string }
  | { type: AppActionType.ADD_TURN; payload: { threadId: string; turn: ThreadTurn } }
  | { type: AppActionType.UPDATE_TURN; payload: { threadId: string; turn: ThreadTurn } }
  | { type: AppActionType.TOGGLE_FILES }
  | { type: AppActionType.SET_FILES_COLLAPSED; payload: boolean }
  | { type: AppActionType.SET_LOADING; payload: boolean };

export interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}