// src/components/assistant/AssistantMarkdown.tsx
// Renders the assistant's replies as Markdown. react-markdown builds React
// elements and ignores raw HTML, so a reply can't inject markup into the page.

import { useMemo } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Pages the assistant links to (from its tool results); other relative links
// are shown as plain text
const IN_APP_LINK = /^\/(tasks|notes|calendar|travel|dashboard|settings)(\?|\/|$)/;

const linkClass = "text-leaf underline underline-offset-2";

const staticComponents: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => <h3 className="mt-3 mb-1 font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 mb-1 font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h3 className="mt-3 mb-1 font-semibold first:mt-0">{children}</h3>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ol>,
  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md bg-muted p-3 text-xs [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border px-2 py-1 align-top">{children}</td>,
  hr: () => <hr className="my-3" />,
};

export function AssistantMarkdown({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const components = useMemo<Components>(
    () => ({
      ...staticComponents,
      a: ({ href, children }) => {
        if (href && IN_APP_LINK.test(href)) {
          return (
            <Link href={href} onClick={onNavigate} className={linkClass}>
              {children}
            </Link>
          );
        }
        if (href && /^https?:\/\//i.test(href)) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {children}
            </a>
          );
        }
        return <span>{children}</span>;
      },
    }),
    [onNavigate]
  );

  return (
    <div className="break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
