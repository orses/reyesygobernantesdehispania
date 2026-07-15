import React from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Button } from "../ui/button";

const FIELD_INPUT_CLASS =
    "rounded-[3px] text-base font-medium bg-slate-900/60 text-slate-50 placeholder:text-slate-400 border-slate-700/60 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

interface EditorFieldProps {
    label: string;
    value: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
    multiline?: boolean;
    /** Si true, ocupa 2 columnas en el grid md. */
    colSpan2?: boolean;
}

export function EditorField({
    label,
    value,
    onChange,
    readOnly = false,
    multiline = false,
    colSpan2 = false,
}: EditorFieldProps) {
    const wrapperClass = colSpan2 ? "space-y-1 md:col-span-2" : "space-y-1";
    const textareaId = React.useId();
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [isExpanded, setIsExpanded] = React.useState(false);
    const hasContent = value.trim().length > 0;

    React.useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = "";
        if (isExpanded && hasContent) {
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [hasContent, isExpanded, value]);

    return (
        <div className={wrapperClass}>
            {multiline ? (
                <>
                    <div className="flex min-h-8 items-center justify-between gap-2">
                        <Label
                            htmlFor={textareaId}
                            className="text-sm font-medium text-slate-300"
                        >
                            {label}
                        </Label>
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
                    <Textarea
                        ref={textareaRef}
                        id={textareaId}
                        rows={hasContent ? 10 : undefined}
                        className={`${FIELD_INPUT_CLASS} border min-h-[110px] ${
                            isExpanded && hasContent ? "resize-none overflow-hidden" : "resize-y"
                        }`}
                        value={value}
                        readOnly={readOnly}
                        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
                    />
                </>
            ) : (
                <>
                    <Label className="text-sm font-medium text-slate-300">{label}</Label>
                    <Input
                        className={FIELD_INPUT_CLASS}
                        value={value}
                        readOnly={readOnly}
                        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
                    />
                </>
            )}
        </div>
    );
}
