
import Dexie, { Table } from 'dexie';
import { AppFile, ChatThread, ThreadContent, FileType, ThreadPart, FileCategory, ChatThreadConfig } from '../types';
import { INITIAL_THREADS } from '../constants';
import { StoredRole } from '../services/roles/types';

export interface DBFile {
  id: string;
  name: string;
  type: FileType;
  category: FileCategory;
  blob: Blob;
  createdAt: number;
  threadId?: string;
  virtualPath?: string;
  metadata?: Record<string, any>;
  sortOrder?: number;
}

export interface DBThread {
  id: string;
  title: string;
  updatedAt: number;
  preview: string;
  config?: ChatThreadConfig;
}

export interface DBThreadContent {
  id: string;
  threadId: string;
  turnId: string;
  role: 'user' | 'model' | 'tool';
  parts: ThreadPart[];
  timestamp: number;
}

export class MorphoLensDatabase extends Dexie {
  files!: Table<DBFile>;
  threads!: Table<DBThread>;
  messages!: Table<DBThreadContent>;
  roles!: Table<StoredRole>;

  constructor() {
    super('MorphoLensDB');
    (this as any).version(7).stores({
      files: 'id, type, category, threadId, createdAt, virtualPath, sortOrder', 
      threads: 'id, updatedAt', 
      messages: 'id, threadId, turnId, timestamp',
      roles: 'id, loadedAt'
    });
  }

  async seedIfEmpty() {
     const threadCount = await this.threads.count();
     if (threadCount === 0 && INITIAL_THREADS.length > 0) {
        console.log("Seeding Database with Demo Content...");
        await this.threads.bulkAdd(INITIAL_THREADS);
     }
  }
}

export const db = new MorphoLensDatabase();
