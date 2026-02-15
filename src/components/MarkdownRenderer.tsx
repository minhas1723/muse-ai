import React from "react";

export function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  const lines = text.split("\n");
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";
  let keyCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        parts.push(
          <div key={keyCounter++} className="my-2 bg-surface-1 border border-border rounded-lg overflow-hidden">
            {codeLang && (
              <div className="text-[length:var(--font-size-xxs)] font-semibold px-3 py-1.5 bg-bg-hover text-text-tertiary uppercase tracking-[0.5px] border-b border-border">
                {codeLang}
              </div>
            )}
            <pre className="p-3 overflow-x-auto text-[11.5px] leading-relaxed">
              <code className="font-mono text-text-primary">{codeLines.join("\n")}</code>
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeLang = "";
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("### ")) {
      parts.push(
        <h4 key={keyCounter++} className="text-[length:var(--font-size-base)] font-semibold mt-2 mb-1 text-text-primary">
          {processInline(line.slice(4))}
        </h4>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      parts.push(
        <h3 key={keyCounter++} className="text-[14px] font-semibold mt-2.5 mb-1 text-text-primary">
          {processInline(line.slice(3))}
        </h3>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      parts.push(
        <h2 key={keyCounter++} className="text-base font-bold mt-3 mb-1.5 text-text-primary">
          {processInline(line.slice(2))}
        </h2>
      );
      continue;
    }

    if (line.match(/^[\s]*[-*]\s/)) {
      parts.push(
        <div key={keyCounter++} className="pl-1 my-0.5 text-text-secondary">
          • {processInline(line.replace(/^[\s]*[-*]\s/, ""))}
        </div>
      );
      continue;
    }

    if (line.trim() === "") {
      parts.push(<div key={keyCounter++} className="h-1.5" />);
      continue;
    }

    parts.push(
      <p key={keyCounter++} className="my-[3px]">
        {processInline(line)}
      </p>
    );
  }

  if (inCodeBlock && codeLines.length > 0) {
    parts.push(
      <div key={keyCounter++} className="my-2 bg-surface-1 border border-border rounded-lg overflow-hidden">
        {codeLang && (
          <div className="text-[10px] font-semibold px-3 py-1.5 bg-bg-hover text-text-tertiary uppercase tracking-[0.5px] border-b border-border">
            {codeLang}
          </div>
        )}
        <pre className="p-3 overflow-x-auto text-[11.5px] leading-relaxed">
          <code className="font-mono text-text-primary">{codeLines.join("\n")}</code>
        </pre>
      </div>
    );
  }

  return <>{parts}</>;
}

export function processInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`(.+?)`|_(.+?)_)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(
        <strong key={key++} className="font-semibold text-text-primary">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      parts.push(
        <code
          key={key++}
          className="px-[5px] py-[1px] bg-surface-1 border border-border-subtle rounded-[4px] font-mono text-[0.9em] text-accent-primary"
        >
          {match[3]}
        </code>
      );
    } else if (match[4]) {
      parts.push(<em key={key++}>{match[4]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}
