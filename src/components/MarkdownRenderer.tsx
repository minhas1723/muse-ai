import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css"; // Import KaTeX styles

// Custom renderer components to match existing styles
const components: Components = {
  // Headings - Map levels to match previous visual hierarchy
  h1: ({ children, ...props }) => (
    <h2 className="text-base font-bold mt-3 mb-1.5 text-text-primary" {...props}>
      {children}
    </h2>
  ),
  h2: ({ children, ...props }) => (
    <h3 className="text-[14px] font-semibold mt-2.5 mb-1 text-text-primary" {...props}>
      {children}
    </h3>
  ),
  h3: ({ children, ...props }) => (
    <h4 className="text-[length:var(--font-size-base)] font-semibold mt-2 mb-1 text-text-primary" {...props}>
      {children}
    </h4>
  ),
  h4: ({ children, ...props }) => (
    <h5 className="text-[length:var(--font-size-sm)] font-semibold mt-2 mb-1 text-text-primary" {...props}>
      {children}
    </h5>
  ),

  // Paragraphs
  p: ({ children, ...props }) => (
    <p className="my-[3px] leading-relaxed break-words" {...props}>
      {children}
    </p>
  ),

  // Lists
  ul: ({ children, ...props }) => (
    <ul className="pl-4 list-disc space-y-1 my-2 text-text-secondary" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="pl-4 list-decimal space-y-1 my-2 text-text-secondary" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="pl-1" {...props}>
      {children}
    </li>
  ),

  // Links
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent-primary hover:underline break-all cursor-pointer"
      {...props}
    >
      {children}
    </a>
  ),

  // Images
  img: ({ src, alt, ...props }) => (
    <img
      src={src}
      alt={alt}
      className="max-w-full rounded-lg my-2 border border-border"
      loading="lazy"
      {...props}
    />
  ),

  // Code
  code: ({ node, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || "");
    const lang = match ? match[1] : "";

    // react-markdown v7+ dropped the `inline` prop.
    // Block code always has a trailing newline in children; inline never does.
    const childStr = typeof children === "string" ? children : String(children ?? "");
    const isInline = !childStr.includes("\n");

    if (!isInline && match) {
      return (
        <div className="my-2 bg-surface-1 border border-border rounded-lg overflow-hidden">
          {lang && (
            <div className="text-[length:var(--font-size-xxs)] font-semibold px-3 py-1.5 bg-bg-hover text-text-tertiary uppercase tracking-[0.5px] border-b border-border">
              {lang}
            </div>
          )}
          <pre className="p-3 overflow-x-auto text-[11.5px] leading-relaxed">
            <code className={`font-mono text-text-primary ${className}`} {...props}>
              {children}
            </code>
          </pre>
        </div>
      );
    }

    // Fallback for block code without language
    if (!isInline) {
      return (
        <div className="my-2 bg-surface-1 border border-border rounded-lg overflow-hidden">
          <pre className="p-3 overflow-x-auto text-[11.5px] leading-relaxed">
            <code className="font-mono text-text-primary" {...props}>
              {children}
            </code>
          </pre>
        </div>
      );
    }

    return (
      <code
        className="px-[4px] py-[1px] bg-accent-primary/10 rounded-[3px] font-mono text-[0.88em] text-accent-primary"
        {...props}
      >
        {children}
      </code>
    );
  },

  // Formatting
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-text-primary" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="text-text-primary italic" {...props}>
      {children}
    </em>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-4 border-border pl-4 my-2 text-text-secondary italic" {...props}>
      {children}
    </blockquote>
  ),

  // Tables (GFM)
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-4 border border-border rounded-lg">
      <table className="min-w-full divide-y divide-border" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-surface-2" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }) => (
    <tbody className="divide-y divide-border bg-surface-1" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }) => <tr {...props}>{children}</tr>,
  th: ({ children, ...props }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td
      className="px-3 py-2 whitespace-nowrap text-sm text-text-primary border-r border-border last:border-r-0"
      {...props}
    >
      {children}
    </td>
  ),
};

export function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={components}
    >
      {text}
    </ReactMarkdown>
  );
}

// Deprecated: kept for compability, efficiently wraps un-paragraphed markdown
export function processInline(text: string): React.ReactNode {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        ...components,
        p: ({ children }) => <>{children}</>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
