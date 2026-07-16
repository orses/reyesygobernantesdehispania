import React from "react";
import { safeJsonParse } from "../../lib/data";
import { CopyButton } from "../ui/copy-button";
import { Textarea } from "../ui/textarea";

export type JsonValueValidation<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

interface JsonEditorDetailsProps<T> {
  title: string;
  description: string;
  value: T;
  validate: (value: unknown) => JsonValueValidation<T>;
  onValidChange: (value: T) => void;
  onErrorChange: (error: string | null) => void;
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function JsonEditorDetails<T>({
  title,
  description,
  value,
  validate,
  onValidChange,
  onErrorChange,
}: JsonEditorDetailsProps<T>) {
  const externalText = React.useMemo(() => formatJson(value), [value]);
  const [text, setText] = React.useState(externalText);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const publishedTextRef = React.useRef(externalText);
  const textareaId = React.useId();

  React.useEffect(() => {
    if (externalText === publishedTextRef.current) return;

    publishedTextRef.current = externalText;
    setText(externalText);
    setValidationError(null);
    onErrorChange(null);
  }, [externalText, onErrorChange]);

  const reportError = (error: string | null) => {
    setValidationError(error);
    onErrorChange(error);
  };

  const handleChange = (nextText: string) => {
    setText(nextText);
    const parsed = safeJsonParse(nextText);

    if (!parsed.ok) {
      reportError(`JSON inválido: ${parsed.error}`);
      return;
    }

    const validation = validate(parsed.value);
    if (!validation.ok) {
      reportError(validation.error);
      return;
    }

    reportError(null);
    publishedTextRef.current = formatJson(validation.value);
    onValidChange(validation.value);
  };

  return (
    <details className="md:col-span-2">
      <summary className="cursor-pointer rounded-[3px] text-sm text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
        {title}
      </summary>
      <div className="mt-2 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor={textareaId} className="text-sm text-slate-300">
            {description}
          </label>
          <CopyButton value={text} label="Copiar JSON" />
        </div>
        <Textarea
          id={textareaId}
          className="min-h-[160px] rounded-[3px] border border-slate-700/60 bg-slate-900/60 font-mono text-sm text-slate-50 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          value={text}
          aria-invalid={validationError ? true : undefined}
          aria-describedby={validationError ? `${textareaId}-error` : undefined}
          onChange={(event) => handleChange(event.target.value)}
        />
        {validationError ? (
          <p id={`${textareaId}-error`} role="alert" className="text-sm text-red-300">
            {validationError}
          </p>
        ) : null}
      </div>
    </details>
  );
}
