import { Button } from "./ui/button";

interface DatasetHydrationGateProps {
  status: "pending" | "failed";
  errorMessage?: string | null;
  onRetry: () => void;
}

export function DatasetHydrationGate({
  status,
  errorMessage,
  onRetry,
}: DatasetHydrationGateProps) {
  const failed = status === "failed";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-lg rounded-md border border-slate-800 bg-slate-900/60 p-8 text-center shadow-xl">
        {failed ? (
          <div role="alert" aria-live="assertive">
            <h1 className="text-xl font-semibold">No se pudieron restaurar los datos locales</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              La aplicación se ha bloqueado para evitar sobrescribir datos que no se han podido
              leer de forma segura.
            </p>
            {errorMessage ? (
              <p className="mt-3 text-sm text-amber-300">{errorMessage}</p>
            ) : null}
            <Button type="button" className="mt-6" onClick={onRetry}>
              Volver a intentar
            </Button>
          </div>
        ) : (
          <div role="status" aria-live="polite" aria-busy="true">
            <h1 className="text-xl font-semibold">Restaurando datos locales…</h1>
            <p className="mt-3 text-sm text-slate-300">
              La edición estará disponible cuando termine la comprobación del almacenamiento.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
