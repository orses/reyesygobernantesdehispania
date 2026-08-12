export type ApplicationErrorEvent =
    | "application.render.failed"
    | "export.zip.failed"
    | "import.file.read_failed"
    | "import.text.failed"
    | "import.zip.failed"
    | "media.blob.cleanup_failed"
    | "media.person.cleanup_failed"
    | "media.preview.load_failed"
    | "media.snapshot.save_failed"
    | "persistence.dataset.load_failed"
    | "persistence.dataset.save_failed"
    | "persistence.filters.load_failed"
    | "persistence.filters.save_failed"
    | "statistics.compute.failed";

export type SafeErrorValue =
    | boolean
    | number
    | string
    | null
    | readonly SafeErrorValue[]
    | { readonly [key: string]: SafeErrorValue };

export interface ErrorReportContext {
    event: ApplicationErrorEvent;
    recoverable: boolean;
    metadata?: Readonly<Record<string, unknown>>;
}

export interface ApplicationErrorReport {
    level: "error";
    event: ApplicationErrorEvent;
    recoverable: boolean;
    occurredAt: string;
    error: {
        name: string;
        message: string;
    };
    metadata: Readonly<Record<string, SafeErrorValue>>;
}

export type ErrorReportSink = (report: ApplicationErrorReport) => void;
export type ErrorReporter = (
    error: unknown,
    context: ErrorReportContext
) => ApplicationErrorReport;

export interface CreateErrorReporterOptions {
    sink?: ErrorReportSink;
    now?: () => Date;
}

const MAX_TEXT_LENGTH = 500;
const MAX_COLLECTION_LENGTH = 20;
const MAX_CONTEXT_DEPTH = 3;
const REDACTED_VALUE = "[REDACTADO]";
const SENSITIVE_KEY_PATTERN = /authorization|cookie|credential|password|secret|token|api[-_]?key/i;
const SENSITIVE_TEXT_PATTERN = /\b(authorization|cookie|credential|password|secret|token|api[-_]?key)(\s*[:=]\s*)([^\s,;&]+)/gi;

function sanitizeText(value: string): string {
    const redacted = value.replace(
        SENSITIVE_TEXT_PATTERN,
        (_match, key: string, separator: string) => `${key}${separator}${REDACTED_VALUE}`
    );
    return redacted.length <= MAX_TEXT_LENGTH
        ? redacted
        : `${redacted.slice(0, MAX_TEXT_LENGTH)}…`;
}

function sanitizeValue(
    value: unknown,
    depth: number,
    ancestors: ReadonlySet<object>
): SafeErrorValue {
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
    if (typeof value === "string") return sanitizeText(value);
    if (typeof value === "bigint") return value.toString();
    if (typeof value === "undefined") return "[NO_DEFINIDO]";
    if (typeof value === "function" || typeof value === "symbol") {
        return "[VALOR_NO_SERIALIZABLE]";
    }
    if (depth >= MAX_CONTEXT_DEPTH) return "[PROFUNDIDAD_LIMITADA]";

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? "Fecha no válida" : value.toISOString();
    }
    if (value instanceof Error) {
        return {
            message: sanitizeText(value.message),
            name: sanitizeText(value.name || "Error"),
        };
    }
    if (ancestors.has(value)) return "[REFERENCIA_CIRCULAR]";

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(value);
    if (Array.isArray(value)) {
        return value
            .slice(0, MAX_COLLECTION_LENGTH)
            .map((item) => sanitizeValue(item, depth + 1, nextAncestors));
    }

    const output: Record<string, SafeErrorValue> = {};
    const keys = Object.keys(value).sort().slice(0, MAX_COLLECTION_LENGTH);
    for (const key of keys) {
        output[key] = SENSITIVE_KEY_PATTERN.test(key)
            ? REDACTED_VALUE
            : sanitizeValue(
                (value as Record<string, unknown>)[key],
                depth + 1,
                nextAncestors
            );
    }
    return output;
}

function sanitizeMetadata(
    metadata: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, SafeErrorValue>> {
    if (!metadata) return {};
    try {
        return sanitizeValue(metadata, 0, new Set()) as Readonly<Record<string, SafeErrorValue>>;
    } catch {
        return { sanitization: "[CONTEXTO_NO_DISPONIBLE]" };
    }
}

function describeError(error: unknown): ApplicationErrorReport["error"] {
    try {
        if (error instanceof Error) {
            return {
                name: sanitizeText(error.name || "Error"),
                message: sanitizeText(error.message || "Error sin mensaje."),
            };
        }
        if (typeof error === "string" || typeof error === "number" || typeof error === "boolean") {
            return {
                name: "Error no estándar",
                message: sanitizeText(String(error)),
            };
        }
    } catch {
        // Un error no fiable tampoco debe impedir el registro del incidente.
    }
    return {
        name: "Error no estándar",
        message: "Se capturó un valor que no es una instancia de Error.",
    };
}

function safeTimestamp(now: () => Date): string {
    try {
        const value = now();
        if (!Number.isNaN(value.getTime())) return value.toISOString();
    } catch {
        // El registro de un error nunca debe provocar un segundo fallo.
    }
    return new Date(0).toISOString();
}

const consoleErrorSink: ErrorReportSink = (report) => {
    console.error("[error-aplicación]", report);
};

/**
 * Crea un registrador sustituible que limita y sanea todo el contexto antes de
 * entregarlo al transporte elegido.
 */
export function createErrorReporter({
    sink = consoleErrorSink,
    now = () => new Date(),
}: CreateErrorReporterOptions = {}): ErrorReporter {
    return (error, context) => {
        const report: ApplicationErrorReport = {
            level: "error",
            event: context.event,
            recoverable: context.recoverable,
            occurredAt: safeTimestamp(now),
            error: describeError(error),
            metadata: sanitizeMetadata(context.metadata),
        };

        try {
            sink(report);
        } catch {
            // La observabilidad es auxiliar y no debe alterar el flujo principal.
        }
        return report;
    };
}

export const reportError = createErrorReporter();
