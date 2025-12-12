
import React from 'react';
import { FunctionDeclaration } from "@google/genai";
import { AppFile, FileCategory, AnalysisLayer } from "../../../types";

export interface ToolContext {
  files: AppFile[];
  activeThreadId: string | null;
  activeFileId: string | null;
}

export interface GeneratedImage {
    name: string;
    blob: Blob;
    category: FileCategory; // New field to distinguish where it was saved
    virtualPath?: string;
}

export interface ToolResult {
  result: string; 
  display?: React.ReactNode; 
  error?: string;
  images?: GeneratedImage[]; 
  layers?: { fileId: string; layer: AnalysisLayer }[];
  data?: any; 
}

export interface AgentTool {
  name: string;
  declaration: FunctionDeclaration;
  execute: (args: any, context: ToolContext) => Promise<ToolResult>;
}
