
import { AppFile, FileCategory } from "../types";
import { generateArtifactName } from "../lib/utils";
import { getCoreModuleSource } from "./roles/core";
import { Role } from "./roles/types";

declare global {
  interface Window {
    loadPyodide: any;
    pyodide: any;
  }
}

export type FileSystemSnapshot = Record<string, number>;

export interface ScannedFile {
    name: string;
    blob: Blob;
    category: FileCategory;
    virtualPath: string;
}

export type PyodideStatus = 'IDLE' | 'LOADING_RUNTIME' | 'INSTALLING_PACKAGES' | 'READY' | 'ERROR';

class PyodideService {
  private pyodide: any = null;
  private _status: PyodideStatus = 'IDLE';
  private subscribers: ((status: PyodideStatus) => void)[] = [];
  private outputBuffer: string[] = [];
  private initPromise: Promise<void> | null = null;
  private currentRoleId: string | null = null;

  constructor() {
    this._status = 'IDLE';
  }

  get status() { return this._status; }

  subscribe(callback: (status: PyodideStatus) => void) {
    this.subscribers.push(callback);
    callback(this._status);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  private setStatus(status: PyodideStatus) {
    this._status = status;
    this.subscribers.forEach(cb => cb(status));
  }

  async initialize() {
    if (this._status === 'READY' && this.pyodide) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize() {
    try {
      this.setStatus('LOADING_RUNTIME');
      
      if (!window.loadPyodide) {
         await new Promise<void>((resolve, reject) => {
             const script = document.createElement('script');
             script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
             script.onload = () => resolve();
             script.onerror = () => reject(new Error("Failed to load Pyodide script"));
             document.head.appendChild(script);
         });
      }

      this.pyodide = await window.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/",
        stdout: (text: string) => {
             console.log("[Python Stdout]", text);
             this.outputBuffer.push(text);
        },
        stderr: (text: string) => {
             console.warn("[Python Stderr]", text);
             this.outputBuffer.push(text);
        }
      });

      // Basic FS Setup
      try {
          this.pyodide.FS.mkdir('/workspace');
          this.pyodide.FS.mkdir('/workspace/data');
          this.pyodide.FS.mkdir('/.session');
          this.pyodide.FS.mkdir('/lib');
      } catch(e) {}

      await this.pyodide.loadPackage('micropip');
      await this.injectCoreModule();

      this.setStatus('READY');

    } catch (e) {
      console.error("Pyodide Initialization Failed", e);
      this.setStatus('ERROR');
      this.initPromise = null;
      throw e;
    }
  }

  async injectCoreModule(): Promise<void> {
     const source = getCoreModuleSource();
     this.pyodide.FS.writeFile('/lib/core.py', source);
     
     await this.pyodide.runPythonAsync(`
       import sys
       if '/lib' not in sys.path:
         sys.path.insert(0, '/lib')
       import core
     `);
  }

  async loadRole(role: Role, force: boolean = false) {
      if (!this.pyodide) await this.initialize();
      if (this.currentRoleId === role.manifest.id && !force) return;

      this.setStatus('INSTALLING_PACKAGES');
      
      // 1. Install Packages
      if (role.manifest.packages.length > 0) {
          try {
            await this.pyodide.loadPackage('micropip');
            const micropip = this.pyodide.pyimport('micropip');
            for (const pkg of role.manifest.packages) {
                try {
                    await micropip.install(pkg);
                } catch (e) {
                    console.warn(`Failed to install ${pkg}`, e);
                }
            }
          } catch(e) {
              console.warn("Package installation failed", e);
          }
      }

      // 2. Inject Helpers
      for (const helper of role.helpers) {
          const path = `/lib/${helper.filename}`;
          this.pyodide.FS.writeFile(path, helper.source);
      }

      // 3. Import helpers
      for (const helper of role.helpers) {
          try {
            // Force reload if already imported
            await this.pyodide.runPythonAsync(`
                import sys
                import importlib
                if '${helper.moduleName}' in sys.modules:
                    importlib.reload(sys.modules['${helper.moduleName}'])
                else:
                    import ${helper.moduleName}
            `);
          } catch(e) {
              console.warn(`Failed to import helper ${helper.moduleName}`, e);
          }
      }

      this.currentRoleId = role.manifest.id;
      this.setStatus('READY');
  }

  async syncContext(files: AppFile[], activeFileId: string | null) {
      await this.initialize();
      try {
          const contextObj = {
              active_file: activeFileId ? files.find(f => f.id === activeFileId) : null,
              files: files.map(f => ({
                  id: f.id,
                  name: f.name,
                  type: f.type,
                  virtualPath: f.virtualPath,
                  analysis: f.analysis
              }))
          };
          
          const jsonStr = JSON.stringify(contextObj).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          await this.pyodide.runPythonAsync(`
import core
import json
try:
    core._set_context(json.loads('${jsonStr}'))
except Exception as e:
    print(f"Context sync error: {e}")
`);
      } catch (e) {
          console.warn("[Pyodide] Failed to sync context", e);
      }
  }

  async getActions(): Promise<any[]> {
      if (!this.pyodide) return [];
      try {
          const proxy = await this.pyodide.runPythonAsync(`
import core
import json
json.dumps(core._get_actions())
`);
          return JSON.parse(proxy);
      } catch (e) {
          return [];
      }
  }

  // Legacy alias for compatibility during migration if something calls it directly
  async getPendingActions() { return this.getActions(); }

  async mountFile(file: AppFile) {
      await this.initialize();
      let path = file.virtualPath;
      if (!path) {
          const dir = file.category === 'project' ? '/workspace/data' : '/.session';
          path = `${dir}/${file.name}`;
      }
      const dir = path.substring(0, path.lastIndexOf('/'));
      if (dir.length > 1) {
          try { this.pyodide.FS.mkdirTree(dir); } catch (e) {}
      }
      try {
          const response = await fetch(file.url);
          const blob = await response.blob();
          const buffer = await blob.arrayBuffer();
          const data = new Uint8Array(buffer);
          this.pyodide.FS.writeFile(path, data);
          file.virtualPath = path; 
      } catch (e) {
          console.warn(`Failed to mount ${file.name}`, e);
          throw e;
      }
  }

  async prepareEnvironment(activeThreadId: string, files: AppFile[]) {
      await this.initialize();
      try {
          // Cleanup session? Maybe too aggressive if keeping state
          // const sessionFiles = this.pyodide.FS.readdir('/.session');
      } catch (e) {}

      for (const file of files) {
          if (file.category === 'session' && file.threadId !== activeThreadId) continue;
          try { await this.mountFile(file); } catch (e) {}
      }
  }
  
  async createDirectory(path: string) {
      await this.initialize();
      try { this.pyodide.FS.mkdirTree(path); } catch (e) {}
  }

  async renameNode(oldPath: string, newPath: string) {
      await this.initialize();
      try {
          try { this.pyodide.FS.stat(oldPath); } catch (e) { return; }
          const destDir = newPath.substring(0, newPath.lastIndexOf('/'));
          try { this.pyodide.FS.mkdirTree(destDir); } catch(e) {}
          this.pyodide.FS.rename(oldPath, newPath);
      } catch (e) { console.error("Rename failed", e); }
  }

  getFileSystemSnapshot(): FileSystemSnapshot {
      if (!this.pyodide) return {};
      const snapshot: FileSystemSnapshot = {};
      const walk = (dir: string) => {
          try {
            if (!this.pyodide.FS.analyzePath(dir).exists) return;
            const files = this.pyodide.FS.readdir(dir);
            for (const f of files) {
                if (f === '.' || f === '..') continue;
                const path = `${dir}/${f}`;
                const stat = this.pyodide.FS.stat(path);
                if (this.pyodide.FS.isDir(stat.mode)) walk(path);
                else snapshot[path] = stat.mtime.getTime();
            }
          } catch (e) {}
      };
      walk('/.session');
      walk('/workspace/data');
      return snapshot;
  }

  scanForChanges(prevSnapshot: FileSystemSnapshot): ScannedFile[] {
      if (!this.pyodide) return [];
      const currentSnapshot = this.getFileSystemSnapshot();
      const detected: ScannedFile[] = [];

      for (const [path, mtime] of Object.entries(currentSnapshot)) {
          if (prevSnapshot[path] !== mtime) {
              try {
                  if (!this.pyodide.FS.analyzePath(path).exists) continue;
                  const content = this.pyodide.FS.readFile(path, { encoding: 'binary' });
                  const name = path.split('/').pop() || 'unknown';
                  const ext = name.split('.').pop()?.toLowerCase();
                  let mime = 'application/octet-stream';
                  if (ext === 'png') mime = 'image/png';
                  if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
                  if (ext === 'tif' || ext === 'tiff') mime = 'image/tiff';
                  if (ext === 'csv') mime = 'text/csv';
                  if (ext === 'json') mime = 'application/json';
                  if (ext === 'txt') mime = 'text/plain';

                  detected.push({
                      name,
                      blob: new Blob([content], { type: mime }),
                      category: path.startsWith('/workspace/data') ? 'project' : 'session',
                      virtualPath: path
                  });
              } catch (e) {}
          }
      }
      return detected;
  }

  async getFileAsBlob(path: string): Promise<Blob> {
      await this.initialize();
      const content = this.pyodide.FS.readFile(path, { encoding: 'binary' });
      const ext = path.split('.').pop()?.toLowerCase();
      let mime = 'application/octet-stream';
      if (ext === 'png') mime = 'image/png';
      else if (ext === 'jpg') mime = 'image/jpeg';
      else if (ext === 'svg') mime = 'image/svg+xml';
      return new Blob([content], { type: mime });
  }

  async convertImageToPng(virtualPath: string): Promise<Blob> {
      await this.initialize();
      // Ensure PIL is installed for core conversion
      try {
          await this.pyodide.runPythonAsync(`
import importlib.util
import micropip
if importlib.util.find_spec("PIL") is None:
    await micropip.install("Pillow")
import core
core.convert_image('${virtualPath}')
`);
          const proxy = this.pyodide.pyimport("core").convert_image(virtualPath);
          const jsArray = proxy.toJs();
          proxy.destroy();
          return new Blob([jsArray], { type: 'image/png' });
      } catch (e: any) {
          console.warn("Image conversion failed", e);
          throw e; 
      }
  }

  async convertVideoToGif(virtualPath: string): Promise<Blob> {
      await this.initialize();
      // Ensure OpenCV is installed for core conversion
      try {
          await this.pyodide.runPythonAsync(`
import importlib.util
import micropip
if importlib.util.find_spec("cv2") is None:
    await micropip.install("opencv-python")
import core
core.convert_video_to_gif('${virtualPath}')
`);
          const proxy = this.pyodide.pyimport("core").convert_video_to_gif(virtualPath);
          const jsArray = proxy.toJs();
          proxy.destroy();
          return new Blob([jsArray], { type: 'image/gif' });
      } catch (e: any) {
          console.warn("Video conversion failed", e);
          throw e;
      }
  }

  async runCode(code: string) {
      await this.initialize();
      this.outputBuffer = [];

      try {
          try { this.pyodide.FS.chdir('/.session'); } catch(e) {}
          const result = await this.pyodide.runPythonAsync(code);
          
          if (result && !result.type && typeof result === 'object') {
              try {
                  const typeName = String(result.type || result); 
                  if (typeName.includes('PIL') || typeName.includes('Figure')) {
                      const tempName = generateArtifactName() + ".png";
                      if (result.save) {
                          result.save(tempName);
                          this.outputBuffer.push(`[System] Implicitly saved PIL Image to ${tempName}`);
                      } else if (result.savefig) {
                          result.savefig(tempName);
                          this.outputBuffer.push(`[System] Implicitly saved Plot to ${tempName}`);
                      }
                      
                      // Auto-register implicit artifacts
                      await this.pyodide.runPythonAsync(`
                        import core
                        core.register_artifact('/.session/${tempName}', 'image')
                      `);
                  }
              } catch (e) {}
          }

          return {
              stdout: this.outputBuffer.join('\n'),
              result: result?.toJs ? result.toJs({dict_converter: Object.fromEntries}) : result,
              error: null
          };
      } catch (err: any) {
          return { stdout: this.outputBuffer.join('\n'), result: null, error: err.message || String(err) };
      }
  }
}

export const pyodideService = new PyodideService();
