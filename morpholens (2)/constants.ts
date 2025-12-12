
import { AppFile, FileType, ChatThread, ThreadContent } from "./types";

export const INITIAL_FILES: AppFile[] = [];

export const INITIAL_THREADS: ChatThread[] = [];

// The protocol signature used to link a Python code block with its execution result
export const SYSTEM_OUTPUT_PREFIX = "[System Output from python:run]";
