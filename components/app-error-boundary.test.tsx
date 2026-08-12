import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
    AppErrorBoundary,
    ApplicationErrorFallback,
} from "./app-error-boundary";
import type { ErrorReporter } from "../lib/observability";

describe("ApplicationErrorFallback", () => {
    it("renderiza una recuperación accesible sin depender del DOM", () => {
        const html = renderToStaticMarkup(<ApplicationErrorFallback />);

        expect(html).toContain('role="alert"');
        expect(html).toContain('aria-labelledby="application-error-title"');
        expect(html).toContain("No se ha podido mostrar la aplicación");
        expect(html).toContain("Recargar la aplicación");
        expect(html).toContain('type="button"');
    });
});

describe("AppErrorBoundary", () => {
    it("cambia al estado de recuperación tras un error de renderizado", () => {
        expect(AppErrorBoundary.getDerivedStateFromError()).toEqual({ hasError: true });
    });

    it("registra el fallo con un evento estable y la traza de componentes", () => {
        const reporter = vi.fn<ErrorReporter>();
        const boundary = new AppErrorBoundary({
            children: <span>Contenido</span>,
            reporter,
        });
        const error = new Error("fallo de renderizado");

        boundary.componentDidCatch(error, { componentStack: "\n    at BrokenView" });

        expect(reporter).toHaveBeenCalledWith(error, {
            event: "application.render.failed",
            recoverable: true,
            metadata: { componentStack: "\n    at BrokenView" },
        });
    });
});
