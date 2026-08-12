import React from "react";
import type { NotificationProps } from "../../lib/types";

export function Notification({ type, message, list, rawText, onClose }: NotificationProps) {
    const titleId = React.useId();
    const colors: Record<string, string> = {
        csv: "border-emerald-400/30",
        warn: "border-amber-400/30",
        error: "border-red-400/30",
    };
    const title =
        type === "csv" ? "csv detectado" : type === "warn" ? "advertencias" : "error";

    return (
        <div
            className={`rounded-[3px] border ${colors[type]} bg-slate-900/70 backdrop-blur px-4 py-3 shadow-lg`}
            role={type === "error" ? "alert" : "status"}
            aria-live={type === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            aria-labelledby={titleId}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div id={titleId} className="text-sm font-medium text-slate-100">{title}</div>
                    <div
                        className={`text-sm ${type === "error" ? "text-red-200" : "text-slate-200/90"}`}
                    >
                        {message}
                    </div>
                    {list && (
                        <ul className="mt-2 max-h-[50vh] list-disc space-y-1 overflow-y-auto pl-5 pr-2 text-sm text-slate-200/90">
                            {list.map((x, i) => (
                                <li key={i}>{x}</li>
                            ))}
                        </ul>
                    )}
                    {rawText && (
                        <details className="mt-2 text-sm text-slate-200/90">
                            <summary className="cursor-pointer">ver texto</summary>
                            <pre className="mt-2 max-h-40 overflow-auto rounded-[3px] border border-slate-700/60 bg-slate-950/60 p-3">
                                {rawText}
                            </pre>
                        </details>
                    )}
                </div>
                <button
                    type="button"
                    aria-label={`Cerrar ${title}`}
                    title={`Cerrar ${title}`}
                    onClick={onClose}
                    className="rounded-[3px] px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                >
                    <span aria-hidden="true">×</span>
                </button>
            </div>
        </div>
    );
}
