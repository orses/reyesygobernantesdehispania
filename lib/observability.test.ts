import { describe, expect, it, vi } from "vitest";
import {
    createErrorReporter,
    type ApplicationErrorReport,
} from "./observability";

describe("createErrorReporter", () => {
    it("genera un registro estable sin conservar datos sensibles ni la pila", () => {
        const reports: ApplicationErrorReport[] = [];
        const metadata: Record<string, unknown> = {
            rowCount: 3,
            token: "token-supersecreto",
            nested: {
                password: "clave-supersecreta",
                format: "zip",
            },
        };
        metadata.circular = metadata;

        const reportError = createErrorReporter({
            sink: (report) => reports.push(report),
            now: () => new Date("2026-08-05T12:00:00.000Z"),
        });
        const sourceError = new Error(
            "Fallo remoto: token=valor-supersecreto en https://example.test/file?secret=oculto"
        );
        sourceError.stack = "pila privada";

        const report = reportError(sourceError, {
            event: "import.zip.failed",
            recoverable: true,
            metadata,
        });

        expect(reports).toEqual([report]);
        expect(report).toMatchObject({
            level: "error",
            event: "import.zip.failed",
            recoverable: true,
            occurredAt: "2026-08-05T12:00:00.000Z",
            error: { name: "Error" },
            metadata: {
                circular: "[REFERENCIA_CIRCULAR]",
                nested: {
                    format: "zip",
                    password: "[REDACTADO]",
                },
                rowCount: 3,
                token: "[REDACTADO]",
            },
        });

        const serialized = JSON.stringify(report);
        expect(serialized).not.toContain("valor-supersecreto");
        expect(serialized).not.toContain("token-supersecreto");
        expect(serialized).not.toContain("clave-supersecreta");
        expect(serialized).not.toContain("oculto");
        expect(serialized).not.toContain("pila privada");
    });

    it("no propaga los fallos del transporte de observabilidad", () => {
        const sink = vi.fn(() => {
            throw new Error("transporte no disponible");
        });
        const reportError = createErrorReporter({ sink });

        expect(() =>
            reportError({ token: "no debe serializarse" }, {
                event: "persistence.dataset.save_failed",
                recoverable: true,
            })
        ).not.toThrow();
        expect(sink).toHaveBeenCalledOnce();
    });

    it("tolera metadatos con accesores defectuosos", () => {
        const metadata = Object.defineProperty({}, "unstable", {
            enumerable: true,
            get() {
                throw new Error("acceso fallido");
            },
        });
        const reportError = createErrorReporter({ sink: () => undefined });

        expect(() =>
            reportError(new Error("fallo principal"), {
                event: "media.snapshot.save_failed",
                recoverable: true,
                metadata,
            })
        ).not.toThrow();

        const report = reportError(new Error("fallo principal"), {
            event: "media.snapshot.save_failed",
            recoverable: true,
            metadata,
        });
        expect(report.metadata).toEqual({
            sanitization: "[CONTEXTO_NO_DISPONIBLE]",
        });
    });
});
