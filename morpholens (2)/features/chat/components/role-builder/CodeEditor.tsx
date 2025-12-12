
import React, { useEffect, useRef } from 'react';
import { 
  EditorView, 
  keymap, 
  lineNumbers, 
  highlightActiveLine, 
  highlightSpecialChars, 
  drawSelection, 
  placeholder as placeholderExt 
} from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { 
  defaultHighlightStyle, 
  syntaxHighlighting, 
  bracketMatching 
} from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { cn } from '../../../../lib/utils';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: 'python' | 'markdown';
  placeholder?: string;
  className?: string;
}

export function CodeEditor({ value, onChange, language, placeholder, className }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const languageExtension = language === 'python' ? python() : markdown();

    const extensions = [
        lineNumbers(),
        highlightActiveLine(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        bracketMatching(),
        syntaxHighlighting(defaultHighlightStyle, {fallback: true}),
        keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
        ]),
        languageExtension,
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
        }),
    ];

    if (placeholder) {
        extensions.push(placeholderExt(placeholder));
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => view.destroy();
  }, [language, placeholder]);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={cn("h-full rounded-lg overflow-hidden border border-zinc-700", className)}
    />
  );
}
