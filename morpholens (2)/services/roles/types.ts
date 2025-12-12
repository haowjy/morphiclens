
export type ArtifactType = 'image' | 'audio' | 'video' | 'file' | 'layer' | 'data';

export interface RoleManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  packages: string[];
  helpers: string[];
  artifactTypes: ArtifactType[];
  thinkingBudget: number;
}

export interface RoleHelper {
  filename: string;
  source: string;
  moduleName: string;
}

export interface Role {
  manifest: RoleManifest;
  systemPrompt: string;
  helpers: RoleHelper[];
  isBuiltIn: boolean;
}

export interface StoredRole {
  id: string;
  roleData: Blob;
  loadedAt: number;
}
