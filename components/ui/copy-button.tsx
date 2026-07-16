import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyTextToClipboard } from "../../lib/clipboard";
import { cn } from "../../lib/utils";
import { Button } from "./button";

interface CopyButtonProps {
  value: string;
  label: string;
  copiedLabel?: string;
  iconOnly?: boolean;
  className?: string;
}

export function CopyButton({
  value,
  label,
  copiedLabel = "Copiado",
  iconOnly = false,
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const currentLabel = copied ? copiedLabel : label;

  const handleCopy = async () => {
    const didCopy = await copyTextToClipboard(value);
    if (!didCopy) return;

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? "icon" : "sm"}
      className={cn(
        iconOnly
          ? "h-7 w-7 shrink-0 rounded-[3px] border-slate-700/70 bg-slate-950/30 text-slate-100 hover:bg-slate-900/70 hover:text-slate-50"
          : "h-8 gap-1.5 rounded-[3px] border-slate-700/70 bg-slate-950/30 px-2 text-xs text-slate-100 hover:bg-slate-900/70 hover:text-slate-50",
        className
      )}
      title={currentLabel}
      aria-label={currentLabel}
      disabled={!value}
      onClick={() => {
        void handleCopy();
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {iconOnly ? null : <span>{currentLabel}</span>}
    </Button>
  );
}
