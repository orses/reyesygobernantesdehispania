import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/utils";

function MarkdownLink({ href, children, ...props }: ComponentPropsWithoutRef<"a">) {
  const opensNewTab = Boolean(href && /^https?:\/\//i.test(href));

  return (
    <a
      {...props}
      href={href}
      className="font-medium text-emerald-300 underline decoration-emerald-400/50 underline-offset-2 hover:text-emerald-200"
      target={opensNewTab ? "_blank" : undefined}
      rel={opensNewTab ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  );
}

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => <h3 className="mt-5 text-xl font-semibold text-slate-50 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h4 className="mt-4 text-lg font-semibold text-slate-50 first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="mt-4 text-base font-semibold text-slate-50 first:mt-0">{children}</h5>,
  h4: ({ children }) => <h6 className="mt-3 text-base font-medium text-slate-100 first:mt-0">{children}</h6>,
  h5: ({ children }) => <h6 className="mt-3 text-sm font-medium text-slate-100 first:mt-0">{children}</h6>,
  h6: ({ children }) => <h6 className="mt-3 text-sm font-medium text-slate-300 first:mt-0">{children}</h6>,
  p: ({ children }) => <p className="leading-7 text-slate-100">{children}</p>,
  ul: ({ children }) => <ul className="ml-6 list-disc space-y-1 text-slate-100">{children}</ul>,
  ol: ({ children }) => <ol className="ml-6 list-decimal space-y-1 text-slate-100">{children}</ol>,
  li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-emerald-400/60 bg-slate-950/30 py-1 pl-4 italic text-slate-300">
      {children}
    </blockquote>
  ),
  a: MarkdownLink,
  hr: () => <hr className="my-4 border-slate-700" />,
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-[3px] border border-slate-700/70 bg-slate-950/70 p-3 text-sm text-slate-100">
      {children}
    </pre>
  ),
  code: ({ children, className }) => (
    <code className={cn("rounded bg-slate-950/70 px-1 py-0.5 font-mono text-[0.9em] text-emerald-100", className)}>
      {children}
    </code>
  ),
  table: ({ children }) => (
    <table className="block w-full overflow-x-auto border-collapse text-left text-sm text-slate-100">
      {children}
    </table>
  ),
  th: ({ children }) => <th className="border border-slate-700 bg-slate-950/50 px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-slate-700 px-3 py-2 align-top">{children}</td>,
  img: ({ alt }) => (
    <span className="text-sm italic text-slate-400">
      {alt ? `Imagen Markdown omitida: ${alt}` : "Imagen Markdown omitida"}
    </span>
  ),
};

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn("min-w-0 space-y-3", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={MARKDOWN_COMPONENTS}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
