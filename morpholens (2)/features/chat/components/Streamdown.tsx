
import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../../lib/utils';
import { Check, Copy } from 'lucide-react';

const PreBlock = ({ children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = () => {
    if (preRef.current) {
      const text = preRef.current.innerText;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden border border-zinc-200/20 shadow-sm">
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={handleCopy}
          className="p-1.5 bg-zinc-700/50 backdrop-blur hover:bg-zinc-600 text-zinc-300 rounded-md transition-all border border-zinc-600/50"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
      </div>
      <pre
        ref={preRef}
        className="bg-[#1e1e1e] text-zinc-100 p-4 overflow-x-auto text-sm font-mono leading-relaxed scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent m-0"
        {...props}
      >
        {children}
      </pre>
    </div>
  );
};

interface StreamdownProps {
  children: string;
  className?: string;
}

export const Streamdown: React.FC<StreamdownProps> = ({ children, className }) => {
  return (
    <div className={cn("prose prose-zinc prose-sm max-w-none prose-p:leading-relaxed prose-code:before:content-none prose-code:after:content-none", className)}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
            // Override basic elements to match the "clean agent" style
            p: ({node, ...props}) => <p className="mb-2 last:mb-0 text-zinc-800" {...props} />,
            a: ({node, ...props}) => <a className="text-blue-600 hover:underline font-medium" {...props} />,
            ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1 text-zinc-800" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-1 text-zinc-800" {...props} />,
            li: ({node, ...props}) => <li className="pl-1" {...props} />,
            strong: ({node, ...props}) => <strong className="font-semibold text-zinc-900" {...props} />,
            pre: PreBlock,
            code: ({node, className, children, ...props}: any) => {
                 // Check if it's a block code (has language class)
                 const isBlock = /language-(\w+)/.exec(className || '');
                 if (isBlock) {
                     return <code className={cn("font-mono text-sm bg-transparent text-inherit", className)} {...props}>{children}</code>;
                 }
                 // Inline code style
                 return <code className={cn("font-mono text-[0.85em] bg-zinc-100 text-pink-600 px-1 py-0.5 rounded border border-zinc-200/50", className)} {...props}>{children}</code>;
            }
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};
