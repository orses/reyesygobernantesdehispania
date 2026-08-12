import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError, type ErrorReporter } from "../lib/observability";

interface AppErrorBoundaryProps {
    children: ReactNode;
    reporter?: ErrorReporter;
}

interface AppErrorBoundaryState {
    hasError: boolean;
}

export function ApplicationErrorFallback() {
    return (
        <main
            role="alert"
            aria-live="assertive"
            aria-labelledby="application-error-title"
            className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900"
        >
            <section className="w-full max-w-lg rounded-xl border border-red-200 bg-white p-8 shadow-sm">
                <h1 id="application-error-title" className="text-xl font-semibold">
                    No se ha podido mostrar la aplicación
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                    Se ha producido un error inesperado. Recargue la aplicación para volver a
                    intentarlo.
                </p>
                <button
                    type="button"
                    className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                    onClick={() => globalThis.location.reload()}
                >
                    Recargar la aplicación
                </button>
            </section>
        </main>
    );
}

export class AppErrorBoundary extends Component<
    AppErrorBoundaryProps,
    AppErrorBoundaryState
> {
    state: AppErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): AppErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        const reporter = this.props.reporter ?? reportError;
        reporter(error, {
            event: "application.render.failed",
            recoverable: true,
            metadata: { componentStack: errorInfo.componentStack },
        });
    }

    render(): ReactNode {
        return this.state.hasError
            ? <ApplicationErrorFallback />
            : this.props.children;
    }
}
