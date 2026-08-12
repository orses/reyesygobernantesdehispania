import { computeDerivedRow } from "./data";
import type { RawRow } from "./types";

const IDENTITY_KEYS = ["ID", "id", "_rowId"] as const;

function normalizeIdentityCandidate(value: unknown): string {
    return String(value ?? "").trim();
}

function getIdentityCandidate(row: RawRow, index: number): string {
    for (const value of [row._rowId, row.ID, row.id]) {
        const candidate = normalizeIdentityCandidate(value);
        if (candidate) return candidate;
    }
    return `row-${index + 1}`;
}

function copyOwnProperty(source: RawRow, target: RawRow, key: typeof IDENTITY_KEYS[number]): void {
    const targetRecord = target as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(source, key)) {
        targetRecord[key] = source[key];
        return;
    }
    delete targetRecord[key];
}

/**
 * Calcula los campos derivados y garantiza un identificador técnico único y estable.
 * Los identificadores documentales se conservan sin modificaciones.
 */
export function prepareDatasetRows(rows: readonly RawRow[]): RawRow[] {
    const candidates = rows.map(getIdentityCandidate);
    const reservedCandidates = new Set(candidates);
    const usedIds = new Set<string>();

    return rows.map((row, index) => {
        const baseId = candidates[index];
        let rowId = baseId;

        if (usedIds.has(rowId)) {
            let suffix = 2;
            do {
                rowId = `${baseId}~${suffix}`;
                suffix += 1;
            } while (usedIds.has(rowId) || reservedCandidates.has(rowId));
        }

        usedIds.add(rowId);
        return {
            ...computeDerivedRow(row),
            _rowId: rowId,
        } as RawRow;
    });
}

/** Sustituye como máximo una fila y mantiene inmutables todos sus identificadores. */
export function applyRowDraftToRows(
    rows: RawRow[],
    rowId: string,
    draft: RawRow
): RawRow[] {
    const index = rows.findIndex((row) => String(row._rowId ?? "") === rowId);
    if (index < 0) return rows;

    const original = rows[index];
    const protectedDraft: RawRow = { ...draft };
    for (const key of IDENTITY_KEYS) {
        copyOwnProperty(original, protectedDraft, key);
    }

    const updated = computeDerivedRow(protectedDraft) as RawRow;
    return [...rows.slice(0, index), updated, ...rows.slice(index + 1)];
}

/** Elimina como máximo una fila identificada por su clave técnica. */
export function removeRowById(rows: RawRow[], rowId: string): RawRow[] {
    const index = rows.findIndex((row) => String(row._rowId ?? "") === rowId);
    if (index < 0) return rows;
    return [...rows.slice(0, index), ...rows.slice(index + 1)];
}
