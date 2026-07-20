import { asYearOrNull } from "./data";
import type { RawRow } from "./types";

export type ReignBoundary = "start" | "end";

export interface ReignYearMismatch {
    boundary: ReignBoundary;
    yearField: "Inicio del reinado (año)" | "Final del reinado (año)";
    currentValue: unknown;
    suggestedYear: number;
}

interface ReignChronologyFields {
    year: "Inicio del reinado (año)" | "Final del reinado (año)";
    dates: readonly string[];
}

const REIGN_CHRONOLOGY_FIELDS: Record<ReignBoundary, ReignChronologyFields> = {
    start: {
        year: "Inicio del reinado (año)",
        dates: ["Inicio Reinado (Fecha)", "Inicio reinado (fecha)", "inicioReinado"],
    },
    end: {
        year: "Final del reinado (año)",
        dates: ["Fin Reinado (Fecha)", "Fin reinado (fecha)", "finReinado"],
    },
};

function firstPopulatedValue(row: RawRow, keys: readonly string[]): unknown {
    for (const key of keys) {
        const value = row[key];
        if (String(value ?? "").trim()) return value;
    }
    return null;
}

/**
 * Extrae un año explícito de una fecha histórica, incluso si esta solo indica
 * el mes y el año. No infiere años a partir de siglos ni de intervalos ambiguos.
 */
export function extractExplicitYearFromDate(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);

    const text = String(value ?? "").trim();
    if (!text) return null;

    const candidates = Array.from(text.matchAll(/(?:^|[^\d])(-?\d{3,4})(?!\d)/g), (match) =>
        Number.parseInt(match[1], 10)
    ).filter((year) => Number.isFinite(year) && year !== 0);
    const uniqueYears = Array.from(new Set(candidates));

    if (uniqueYears.length !== 1) return null;

    const [year] = uniqueYears;
    const isBeforeChrist = /(?:a\.?\s*c\.?|antes\s+de\s+cristo)/i.test(text);
    return isBeforeChrist ? -Math.abs(year) : year;
}

export function getExplicitReignDateYear(
    row: RawRow,
    boundary: ReignBoundary
): number | null {
    const fields = REIGN_CHRONOLOGY_FIELDS[boundary];
    return extractExplicitYearFromDate(firstPopulatedValue(row, fields.dates));
}

function matchesYearValue(value: unknown, expectedYear: number): boolean {
    return asYearOrNull(value) === expectedYear;
}

export function getReignYearMismatch(
    row: RawRow,
    boundary: ReignBoundary
): ReignYearMismatch | null {
    const fields = REIGN_CHRONOLOGY_FIELDS[boundary];
    const suggestedYear = getExplicitReignDateYear(row, boundary);
    if (suggestedYear === null || matchesYearValue(row[fields.year], suggestedYear)) return null;

    return {
        boundary,
        yearField: fields.year,
        currentValue: row[fields.year],
        suggestedYear,
    };
}

export function getReignYearMismatches(row: RawRow): ReignYearMismatch[] {
    return (["start", "end"] as const)
        .map((boundary) => getReignYearMismatch(row, boundary))
        .filter((mismatch): mismatch is ReignYearMismatch => mismatch !== null);
}

/** Aplica únicamente la corrección que el usuario ya ha confirmado. */
export function applyConfirmedReignYear<T extends RawRow>(
    row: T,
    boundary: ReignBoundary
): T {
    const mismatch = getReignYearMismatch(row, boundary);
    if (!mismatch) return row;

    return { ...row, [mismatch.yearField]: mismatch.suggestedYear };
}

export function reignYearMismatchMessage(mismatch: ReignYearMismatch): string {
    const boundaryLabel = mismatch.boundary === "start" ? "inicio" : "final";
    const currentText = String(mismatch.currentValue ?? "").trim();
    const currentDescription = currentText ? `indica «${currentText}»` : "está vacío";
    return `La fecha de ${boundaryLabel} contiene el año ${mismatch.suggestedYear}, pero el campo de año ${currentDescription}.`;
}
