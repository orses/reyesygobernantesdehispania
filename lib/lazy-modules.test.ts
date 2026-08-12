// ---------------------------------------------------------------------------
// Regresión: los módulos diferidos mantienen sus contratos exportados.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

describe("módulos de interfaz cargados de forma diferida", () => {
    it("resuelve todas las pestañas no iniciales", async () => {
        const [stats, data, timeline, comparison] = await Promise.all([
            import("../components/tabs/stats-tab"),
            import("../components/tabs/data-tab"),
            import("../components/tabs/timeline-tab"),
            import("../components/tabs/comparativa-tab"),
        ]);

        expect(stats.StatsTab).toBeTypeOf("function");
        expect(data.DataTab).toBeTypeOf("function");
        expect(timeline.TimelineTab).toBeTypeOf("function");
        expect(comparison.ComparativaTab).toBeTypeOf("function");
    });

    it("resuelve los tres diálogos desde un único módulo", async () => {
        const editors = await import("../components/editors/editors");

        expect(editors.EditorDialog).toBeTypeOf("function");
        expect(editors.DeleteDialog).toBeTypeOf("function");
        expect(editors.LoadDataDialog).toBeTypeOf("function");
    });

    it("resuelve el renderizador diferido de descripciones", async () => {
        const description = await import("../components/tabs/fichas/person-description");

        expect(description.PersonDescription).toBeTypeOf("function");
    });
});
