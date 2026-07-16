import { MarkdownContent } from "../../ui/markdown-content";

interface PersonDescriptionProps {
  description: unknown;
}

export function PersonDescription({ description }: PersonDescriptionProps) {
  const content = String(description ?? "");

  if (!content.trim()) return <div className="text-base text-slate-100">—</div>;

  return <MarkdownContent content={content} className="text-base" />;
}
