
import JSZip from 'jszip';
import { Role, RoleManifest, RoleHelper } from './types';

export class RoleLoader {
  async loadFromFile(file: File): Promise<Role> {
    const zip = await JSZip.loadAsync(file);
    return this.parseZip(zip, false);
  }

  private async parseZip(zip: JSZip, isBuiltIn: boolean): Promise<Role> {
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      throw new Error('Role missing manifest.json');
    }
    const manifestJson = await manifestFile.async('string');
    const manifest = this.parseManifest(JSON.parse(manifestJson));

    const promptFile = zip.file('prompt.md');
    if (!promptFile) {
      throw new Error('Role missing prompt.md');
    }
    const systemPrompt = await promptFile.async('string');

    const helpers: RoleHelper[] = [];
    if (manifest.helpers && manifest.helpers.length > 0) {
        for (const helperFilename of manifest.helpers) {
            const helperFile = zip.file(`helpers/${helperFilename}`);
            if (!helperFile) {
                // Warning only, or throw? Throw for now
                // throw new Error(`Role missing helper: helpers/${helperFilename}`);
                console.warn(`Role missing helper: helpers/${helperFilename}`);
                continue;
            }
            const source = await helperFile.async('string');
            helpers.push({
                filename: helperFilename,
                source,
                moduleName: helperFilename.replace('.py', ''),
            });
        }
    }

    return {
      manifest,
      systemPrompt,
      helpers,
      isBuiltIn,
    };
  }

  parseManifest(json: unknown): RoleManifest {
    if (typeof json !== 'object' || json === null) {
      throw new Error('Manifest must be an object');
    }

    const obj = json as Record<string, unknown>;
    const required = ['id', 'name', 'description', 'version'];
    for (const field of required) {
      if (typeof obj[field] !== 'string') {
        throw new Error(`Manifest missing required field: ${field}`);
      }
    }

    return {
      id: obj.id as string,
      name: obj.name as string,
      description: obj.description as string,
      version: obj.version as string,
      packages: Array.isArray(obj.packages) ? obj.packages : [],
      helpers: Array.isArray(obj.helpers) ? obj.helpers : [],
      artifactTypes: Array.isArray(obj.artifactTypes) ? obj.artifactTypes as any : [],
      thinkingBudget: typeof obj.thinkingBudget === 'number' ? obj.thinkingBudget : 8192,
    };
  }
}

export const roleLoader = new RoleLoader();
