
import React from 'react';
import { RoleManifest, ArtifactType } from '../../../../services/roles/types';

interface ManifestEditorProps {
  manifest: Partial<RoleManifest>;
  onChange: (manifest: Partial<RoleManifest>) => void;
}

const ARTIFACT_TYPES: ArtifactType[] = ['image', 'audio', 'video', 'file', 'layer', 'data'];

export function ManifestEditor({ manifest, onChange }: ManifestEditorProps) {
  const updateField = <K extends keyof RoleManifest>(
    field: K,
    value: RoleManifest[K]
  ) => {
    onChange({ ...manifest, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* ID and Version row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={manifest.id || ''}
            onChange={(e) => updateField('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="my-role"
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
          />
          <p className="text-xs text-zinc-500 mt-1">Lowercase, letters, numbers, hyphens only</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Version</label>
          <input
            type="text"
            value={manifest.version || ''}
            onChange={(e) => updateField('version', e.target.value)}
            placeholder="1.0.0"
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
          />
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={manifest.name || ''}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="My Custom Role"
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
        <textarea
          value={manifest.description || ''}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="What this role does..."
          rows={2}
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm resize-none"
        />
      </div>

      {/* Packages */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Python Packages</label>
        <input
          type="text"
          value={(manifest.packages || []).join(', ')}
          onChange={(e) => updateField('packages', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="scikit-learn, midiutil, librosa"
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
        />
        <p className="text-xs text-zinc-500 mt-1">Comma-separated. Core packages (numpy, PIL, opencv) are always available.</p>
      </div>

      {/* Artifact Types */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">Artifact Types</label>
        <div className="flex flex-wrap gap-3">
          {ARTIFACT_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(manifest.artifactTypes || []).includes(type)}
                onChange={(e) => {
                  const current = manifest.artifactTypes || [];
                  updateField('artifactTypes', e.target.checked
                    ? [...current, type]
                    : current.filter(t => t !== type)
                  );
                }}
                className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-300"
              />
              <span className="text-sm text-zinc-600">{type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Thinking Budget */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Thinking Budget (tokens)</label>
        <input
          type="number"
          value={manifest.thinkingBudget || 8192}
          onChange={(e) => updateField('thinkingBudget', parseInt(e.target.value) || 8192)}
          min={1024}
          max={65536}
          step={1024}
          className="w-32 px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
        />
        <p className="text-xs text-zinc-500 mt-1">8192 typical, 32768 for complex reasoning</p>
      </div>
    </div>
  );
}
