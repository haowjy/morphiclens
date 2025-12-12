import React, { useState } from 'react';
import { RoleHelper } from '../../../../services/roles/types';
import { CodeEditor } from './CodeEditor';
import { Plus, X, FileCode } from 'lucide-react';
import { cn } from '../../../../lib/utils';

interface HelpersEditorProps {
  helpers: RoleHelper[];
  onChange: (helpers: RoleHelper[]) => void;
}

export function HelpersEditor({ helpers, onChange }: HelpersEditorProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const addHelper = () => {
    const name = `helper_${helpers.length + 1}.py`;
    onChange([
      ...helpers,
      { filename: name, source: `# ${name}\n`, moduleName: name.replace('.py', '') },
    ]);
    setActiveIndex(helpers.length);
  };

  const removeHelper = (index: number) => {
    const newHelpers = helpers.filter((_, i) => i !== index);
    onChange(newHelpers);
    // Adjust active index if needed
    if (activeIndex >= newHelpers.length) {
        setActiveIndex(Math.max(0, newHelpers.length - 1));
    } else if (index < activeIndex) {
        setActiveIndex(activeIndex - 1);
    }
  };

  const updateHelper = (index: number, updates: Partial<RoleHelper>) => {
    onChange(helpers.map((h, i) =>
      i === index
        ? { ...h, ...updates, moduleName: updates.filename?.replace('.py', '') || h.moduleName }
        : h
    ));
  };

  const activeHelper = helpers[activeIndex];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none mb-3">
          <p className="text-sm text-zinc-600">
            Python helpers are injected into Pyodide. Import like: <code className="bg-zinc-100 px-1 rounded font-mono text-xs">import helper_1</code>
          </p>
      </div>

      {/* Tabs Container - Neutral Dark Theme */}
      <div className="flex-none flex items-end gap-1 overflow-x-auto pb-0 -mb-px z-10 pl-1 scrollbar-hide bg-zinc-950 pt-2 rounded-t-lg border-b border-[#282c34]">
        {helpers.map((helper, index) => (
          <div
            key={index}
            onClick={() => setActiveIndex(index)}
            className={cn(
              "group flex items-center gap-2 px-3 py-2.5 rounded-t-md cursor-pointer text-sm shrink-0 border-t border-l border-r transition-all select-none min-w-[120px] max-w-[200px]",
              activeIndex === index 
                ? "bg-[#282c34] text-zinc-100 border-[#282c34]" // Active: Matches editor background
                : "bg-zinc-900 text-zinc-400 border-transparent hover:bg-zinc-800 hover:text-zinc-200" // Inactive: Darker, good contrast
            )}
          >
            <FileCode size={14} className={cn("shrink-0 transition-colors", activeIndex === index ? "text-amber-500" : "text-zinc-500 group-hover:text-zinc-400")} />
            
            <input
              type="text"
              value={helper.filename}
              onChange={(e) => updateHelper(index, { filename: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                  "bg-transparent border-none focus:outline-none w-full min-w-0 text-sm font-mono p-0 transition-colors placeholder:text-zinc-600",
                  activeIndex === index ? "text-zinc-100 focus:ring-0" : "text-zinc-400 group-hover:text-zinc-200"
              )}
            />
            
            <button
              onClick={(e) => { e.stopPropagation(); removeHelper(index); }}
              className={cn(
                  "p-0.5 rounded transition-colors shrink-0 opacity-0 group-hover:opacity-100",
                  activeIndex === index ? "text-zinc-400 hover:text-white hover:bg-white/10" : "text-zinc-500 hover:text-red-400 hover:bg-zinc-700"
              )}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        
        <button 
            onClick={addHelper} 
            className="flex items-center justify-center w-8 h-8 mb-1 ml-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Add File"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Editor Container - Remove CodeMirror default frame to merge with tabs */}
      <div className="flex-1 min-h-0 bg-[#282c34] rounded-lg rounded-tl-none border border-zinc-700 overflow-hidden relative shadow-sm">
        {activeHelper ? (
          <div key={activeHelper.filename} className="h-full">
            <CodeEditor
              value={activeHelper.source}
              onChange={(source) => updateHelper(activeIndex, { source })}
              language="python"
              placeholder="# Write Python helper functions here"
              className="h-full border-none rounded-none" // Override default styling
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-500">
            <div className="text-center">
                <FileCode size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">No file selected</p>
                <button onClick={addHelper} className="text-amber-500 hover:underline mt-1 text-sm">Create one</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}