import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DatasetHydrationGate } from "./dataset-hydration-gate";

describe("bloqueo durante la hidratación del conjunto de datos", () => {
  it("mantiene la interfaz en espera hasta que finaliza la lectura", () => {
    const html = renderToStaticMarkup(
      <DatasetHydrationGate status="pending" onRetry={vi.fn()} />
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Restaurando datos locales");
    expect(html).not.toContain("Volver a intentar");
  });

  it("bloquea la interfaz y ofrece reintento tras una hidratación fallida", () => {
    const html = renderToStaticMarkup(
      <DatasetHydrationGate
        status="failed"
        errorMessage="No se pudo leer IndexedDB."
        onRetry={vi.fn()}
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("evitar sobrescribir datos");
    expect(html).toContain("No se pudo leer IndexedDB.");
    expect(html).toContain("Volver a intentar");
  });
});
