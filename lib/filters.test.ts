import { describe, expect, it } from "vitest";
import {
    DEFAULT_FILTERS,
    applyStatsChartFilter,
    hasActiveDatasetFilters,
    normalizeStoredFilters,
} from "./filters";

describe("filtros compartidos", () => {
    it.each([
        ["reino", "Reino de León", "filterReino", "Reino de León"],
        ["tipo", "Regencia", "filterTipo", "Regencia"],
        ["dinastia", "Trastámara", "filterDinastia", "Trastámara"],
        ["siglo", 15, "filterSiglo", "15"],
    ] as const)(
        "convierte un clic estadístico de %s en un filtro real",
        (kind, value, key, expected) => {
            const result = applyStatsChartFilter({ ...DEFAULT_FILTERS }, kind, value);

            expect(result[key]).toBe(expected);
            expect(Object.keys(result).sort()).toEqual(Object.keys(DEFAULT_FILTERS).sort());
        }
    );

    it("preserva las opciones ajenas al filtro elegido", () => {
        const result = applyStatsChartFilter(
            { ...DEFAULT_FILTERS, filterDinastiaLocked: true, sortDir: "desc" },
            "reino",
            "Reino de León"
        );

        expect(result.filterDinastiaLocked).toBe(true);
        expect(result.sortDir).toBe("desc");
    });

    it("distingue los filtros que alteran el conjunto de una mera opción de búsqueda", () => {
        expect(hasActiveDatasetFilters({ ...DEFAULT_FILTERS })).toBe(false);
        expect(hasActiveDatasetFilters({ ...DEFAULT_FILTERS, literalSearch: true })).toBe(false);
        expect(hasActiveDatasetFilters({ ...DEFAULT_FILTERS, filterTipo: "Regencia" })).toBe(true);
        expect(hasActiveDatasetFilters({ ...DEFAULT_FILTERS, query: "alfonso" })).toBe(true);
    });

    it("migra el estado persistido anterior a la incorporación del tipo", () => {
        const result = normalizeStoredFilters({
            query: "alfonso",
            filterReino: "Reino de León",
        });

        expect(result).toMatchObject({
            query: "alfonso",
            filterReino: "Reino de León",
            filterTipo: "__all__",
        });
    });

    it("descarta valores persistidos con tipos u opciones inválidos", () => {
        const result = normalizeStoredFilters({
            query: null,
            literalSearch: "sí",
            filterTipo: 7,
            sortKey: "desconocido",
            sortDir: "lateral",
        });

        expect(result).toEqual(DEFAULT_FILTERS);
    });
});
