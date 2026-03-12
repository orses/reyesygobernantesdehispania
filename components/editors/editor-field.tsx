import React from "react";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";

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

    return (
        <div className={wrapperClass}>
            <Label className="text-sm font-semibold text-slate-300">{label}</Label>
            {multiline ? (
                <Textarea
                    className={`${FIELD_INPUT_CLASS} border min-h-[110px]`}
                    value={value}
                    readOnly={readOnly}
                    onChange={onChange ? (e) => onChange(e.target.value) : undefined}
                />
            ) : (
                <Input
                    className={FIELD_INPUT_CLASS}
                    value={value}
                    readOnly={readOnly}
                    onChange={onChange ? (e) => onChange(e.target.value) : undefined}
                />
            )}
        </div>
    );
}
