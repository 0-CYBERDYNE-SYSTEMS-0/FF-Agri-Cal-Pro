import React from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  return (
    <div className={cn("prose prose-invert max-w-none", className)}>
      <ReactMarkdown
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold text-foreground mt-6 mb-4" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl font-bold text-foreground mt-5 mb-3" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="text-base font-semibold text-foreground mt-3 mb-1" {...props} />
          ),
          h5: ({ node, ...props }) => (
            <h5 className="text-sm font-semibold text-foreground mt-3 mb-1" {...props} />
          ),
          h6: ({ node, ...props }) => (
            <h6 className="text-xs font-semibold text-foreground mt-3 mb-1" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="text-base text-foreground my-2" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a className="text-primary hover:underline" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside my-4 pl-4" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside my-4 pl-4" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="my-1" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-primary pl-4 italic my-4" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-border" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-muted/50" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-border" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-muted/20" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-4 py-3 text-left text-sm font-medium text-foreground tracking-wider" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-4 py-2 text-sm text-foreground" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-6 border-border" {...props} />
          ),
          code: ({ node, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            return match ? (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                className="rounded border border-border my-4"
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code
                className="bg-muted px-1.5 py-0.5 rounded-sm text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ node, ...props }) => (
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4" {...props} />
          ),
          img: ({ node, ...props }) => (
            <img className="max-w-full h-auto rounded-lg my-4" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;