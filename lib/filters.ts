import type { FilterState } from "./types";

export const ALL_FILTER_VALUE = "__all__";

export const DEFAULT_FILTERS: FilterState = {
    query: "",
    literalSearch: false,
    filterReino: ALL_FILTER_VALUE,
    filterTipo: ALL_FILTER_VALUE,
    filterDinastia: ALL_FILTER_VALUE,
    filterSiglo: ALL_FILTER_VALUE,
    filterDinastiaLocked: false,
    sortKey: "cronologia",
    sortDir: "asc",
};

export type StatsFilterKind = "reino" | "tipo" | "dinastia" | "siglo";

const VALID_SORT_KEYS = new Set([
    "cronologia",
    "nombre",
    "dinastia",
    "reinos",
    "duracion",
    "edad",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function storedString(
    value: Record<string, unknown>,
    key: keyof FilterState,
    fallback: string
): string {
    return typeof value[key] === "string" ? value[key] : fallback;
}

/** Migra y sanea el estado procedente de localStorage. */
export function normalizeStoredFilters(value: unknown): FilterState {
    if (!isRecord(value)) return { ...DEFAULT_FILTERS };

    const sortKey = storedString(value, "sortKey", DEFAULT_FILTERS.sortKey);
    const sortDir = storedString(value, "sortDir", DEFAULT_FILTERS.sortDir);

    return {
        query: storedString(value, "query", DEFAULT_FILTERS.query),
        literalSearch:
            typeof value.literalSearch === "boolean"
                ? value.literalSearch
                : DEFAULT_FILTERS.literalSearch,
        filterReino: storedString(value, "filterReino", DEFAULT_FILTERS.filterReino),
        filterTipo: storedString(value, "filterTipo", DEFAULT_FILTERS.filterTipo),
        filterDinastia: storedString(value, "filterDinastia", DEFAULT_FILTERS.filterDinastia),
        filterSiglo: storedString(value, "filterSiglo", DEFAULT_FILTERS.filterSiglo),
        filterDinastiaLocked:
            typeof value.filterDinastiaLocked === "boolean"
                ? value.filterDinastiaLocked
                : DEFAULT_FILTERS.filterDinastiaLocked,
        sortKey: VALID_SORT_KEYS.has(sortKey) ? sortKey : DEFAULT_FILTERS.sortKey,
        sortDir: sortDir === "asc" || sortDir === "desc" ? sortDir : DEFAULT_FILTERS.sortDir,
    };
}

/** Aplica de forma exhaustiva el filtro asociado a un elemento estadístico. */
export function applyStatsChartFilter(
    filters: FilterState,
    kind: StatsFilterKind,
    value: string | number
): FilterState {
    const normalizedValue = String(value).trim();

    switch (kind) {
        case "reino":
            return { ...filters, filterReino: normalizedValue };
        case "tipo":
            return { ...filters, filterTipo: normalizedValue };
        case "dinastia":
            return { ...filters, filterDinastia: normalizedValue };
        case "siglo":
            return { ...filters, filterSiglo: normalizedValue };
    }
}

/** Indica si alguna regla reduce realmente el conjunto de datos. */
export function hasActiveDatasetFilters(filters: FilterState): boolean {
    return Boolean(
        String(filters.query ?? "").trim() ||
        filters.filterReino !== ALL_FILTER_VALUE ||
        filters.filterTipo !== ALL_FILTER_VALUE ||
        filters.filterDinastia !== ALL_FILTER_VALUE ||
        filters.filterSiglo !== ALL_FILTER_VALUE
    );
}
