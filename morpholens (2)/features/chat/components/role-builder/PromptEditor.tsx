
import React from 'react';
import { CodeEditor } from './CodeEditor';

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function PromptEditor({ value, onChange }: PromptEditorProps) {
  return (
    <div className="h-full flex flex-col">
      <p className="text-sm text-zinc-600 mb-2">
        Write the system prompt in Markdown. This defines the AI's persona and capabilities.
      </p>
      <div className="flex-1 min-h-[400px]">
        <CodeEditor
          value={value}
          onChange={onChange}
          language="markdown"
          placeholder="You are a helpful assistant that..."
        />
      </div>
    </div>
  );
}
