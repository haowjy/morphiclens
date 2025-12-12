
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Role, RoleManifest, RoleHelper } from '../../../services/roles/types';
import { roleRegistry } from '../../../services/roles/registry';
import { ManifestEditor } from './role-builder/ManifestEditor';
import { PromptEditor } from './role-builder/PromptEditor';
import { HelpersEditor } from './role-builder/HelpersEditor';
import JSZip from 'jszip';

interface RoleBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoleCreated: (roleId: string) => void;
  editRole?: Role;  // Pass existing role to edit it
}

type Tab = 'manifest' | 'prompt' | 'helpers';

export function RoleBuilderModal({ isOpen, onClose, onRoleCreated, editRole }: RoleBuilderModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('manifest');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state - initialize from editRole if provided
  const [manifest, setManifest] = useState<Partial<RoleManifest>>(
    editRole?.manifest ?? {
      id: '',
      name: '',
      description: '',
      version: '1.0.0',
      packages: [],
      helpers: [],
      artifactTypes: ['file', 'data'],
      thinkingBudget: 8192,
    }
  );
  const [systemPrompt, setSystemPrompt] = useState(editRole?.systemPrompt ?? '');
  const [helpers, setHelpers] = useState<RoleHelper[]>(editRole?.helpers ?? []);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Validate required fields
      if (!manifest.id || !manifest.name) {
        throw new Error('ID and Name are required');
      }

      // Build .role ZIP file
      const zip = new JSZip();

      const fullManifest: RoleManifest = {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description || '',
        version: manifest.version || '1.0.0',
        packages: manifest.packages || [],
        helpers: helpers.map(h => h.filename),
        artifactTypes: manifest.artifactTypes || [],
        thinkingBudget: manifest.thinkingBudget || 8192,
      };

      zip.file('manifest.json', JSON.stringify(fullManifest, null, 2));
      zip.file('prompt.md', systemPrompt);

      for (const helper of helpers) {
        zip.file(`helpers/${helper.filename}`, helper.source);
      }

      const blob = await zip.generateAsync({ type: 'blob' });

      // Create Role object and register
      const role: Role = {
        manifest: fullManifest,
        systemPrompt,
        helpers,
        isBuiltIn: false,
      };

      await roleRegistry.registerRole(role, blob);
      onRoleCreated(role.manifest.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'manifest' as const, label: 'Details' },
    { id: 'prompt' as const, label: 'System Prompt' },
    { id: 'helpers' as const, label: 'Python Helpers' },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-zinc-200 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-50">
          <h2 className="text-lg font-semibold text-zinc-900">
            {editRole ? 'Edit Role' : 'Create Role'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id ? 'text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'manifest' && <ManifestEditor manifest={manifest} onChange={setManifest} />}
          {activeTab === 'prompt' && <PromptEditor value={systemPrompt} onChange={setSystemPrompt} />}
          {activeTab === 'helpers' && <HelpersEditor helpers={helpers} onChange={setHelpers} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50">
          <div>{error && <span className="text-sm text-red-600">{error}</span>}</div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Role'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
