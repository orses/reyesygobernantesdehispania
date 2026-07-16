import React from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "../ui/button";
import { CopyButton } from "../ui/copy-button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

const TEXTAREA_CLASS =
  "min-h-[180px] rounded-[3px] border border-slate-700/60 bg-slate-900/60 text-base font-medium text-slate-50 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

interface MarkdownEditorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function MarkdownEditorField({ label, value, onChange }: MarkdownEditorFieldProps) {
  const textareaId = React.useId();
  const helpId = `${textareaId}-help`;
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const hasContent = value.length > 0;

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "";
    if (isExpanded && hasContent) textarea.style.height = `${textarea.scrollHeight}px`;
  }, [hasContent, isExpanded, value]);

  return (
    <div className="space-y-1 md:col-span-2">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <Label htmlFor={textareaId} className="text-sm font-medium text-slate-300">
          {label}
        </Label>
        <div className="flex items-center gap-1">
          <CopyButton value={value} label="Copiar contenido" />
          {hasContent ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-[3px] px-2 text-xs"
              aria-controls={textareaId}
              aria-expanded={isExpanded}
              onClick={() => setIsExpanded((expanded) => !expanded)}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              )}
              {isExpanded ? "replegar" : "ver todo"}
            </Button>
          ) : null}
        </div>
      </div>
      <p id={helpId} className="text-xs text-slate-400">
        Admite Markdown por sintaxis. El HTML y las imágenes escritas en Markdown no se representan.
      </p>
      <Textarea
        ref={textareaRef}
        id={textareaId}
        rows={hasContent ? 10 : undefined}
        className={`${TEXTAREA_CLASS} ${
          isExpanded && hasContent ? "resize-none overflow-hidden" : "resize-y"
        }`}
        value={value}
        aria-describedby={helpId}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
