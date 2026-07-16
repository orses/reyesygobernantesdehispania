import { getPersonId } from "./data";
import { applyPersonDraftToRows } from "./person-draft";
import type { RawRow } from "./types";

export interface PersonEditorDocument {
    "Datos personales": RawRow;
    Gobiernos: RawRow[];
}

export type PersonEditorDocumentValidation =
    | { ok: true; value: PersonEditorDocument }
    | { ok: false; error: string };

export type PersonEditorDocumentApplication =
    | { ok: true; value: RawRow[] }
    | { ok: false; error: string };

function isRecord(value: unknown): value is RawRow {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rowIdentity(row: RawRow): string {
    return String(row._rowId ?? "").trim();
}

function samePersonId(value: unknown, expectedPersonId: string): boolean {
    return String(value ?? "").trim() === expectedPersonId;
}

export function createPersonEditorDocument(
    personalData: RawRow,
    governmentRows: RawRow[]
): PersonEditorDocument {
    return {
        "Datos personales": { ...personalData },
        Gobiernos: governmentRows.map((row) => ({ ...row })),
    };
}

export function validatePersonEditorDocument(
    value: unknown,
    expectedPersonId: string,
    originalGovernmentRows: RawRow[]
): PersonEditorDocumentValidation {
    if (!isRecord(value)) {
        return { ok: false, error: "El documento JSON debe ser un objeto." };
    }

    const personalData = value["Datos personales"];
    const governmentRows = value.Gobiernos;

    if (!isRecord(personalData)) {
        return { ok: false, error: "«Datos personales» debe ser un objeto JSON." };
    }
    if (!Array.isArray(governmentRows)) {
        return { ok: false, error: "«Gobiernos» debe ser un array JSON." };
    }
    if (!samePersonId(getPersonId(personalData), expectedPersonId)) {
        return {
            ok: false,
            error: `El PersonID de los datos personales debe seguir siendo «${expectedPersonId}».`,
        };
    }
    if (!governmentRows.every(isRecord)) {
        return { ok: false, error: "Todos los elementos de «Gobiernos» deben ser objetos JSON." };
    }
    if (governmentRows.length !== originalGovernmentRows.length) {
        return {
            ok: false,
            error: "El documento debe conservar las mismas filas de gobierno; añádalas o elimínelas desde sus controles específicos.",
        };
    }
    if (governmentRows.some((row) => !samePersonId(getPersonId(row), expectedPersonId))) {
        return {
            ok: false,
            error: `Todas las filas de gobierno deben conservar el PersonID «${expectedPersonId}».`,
        };
    }

    const originalIds = originalGovernmentRows.map(rowIdentity);
    const editedIds = governmentRows.map(rowIdentity);
    const uniqueEditedIds = new Set(editedIds);
    const originalIdSet = new Set(originalIds);
    const hasInvalidIdentities =
        originalIds.some((id) => !id) ||
        editedIds.some((id) => !id) ||
        uniqueEditedIds.size !== editedIds.length ||
        editedIds.some((id) => !originalIdSet.has(id));

    if (hasInvalidIdentities) {
        return {
            ok: false,
            error: "El documento debe conservar los identificadores internos de todas sus filas de gobierno.",
        };
    }

    return {
        ok: true,
        value: {
            "Datos personales": personalData,
            Gobiernos: governmentRows,
        },
    };
}

export function applyPersonEditorDocumentToRows(
    rows: RawRow[],
    personId: string,
    document: PersonEditorDocument
): PersonEditorDocumentApplication {
    const currentGovernmentRows = rows.filter((row) => getPersonId(row) === personId);
    const validation = validatePersonEditorDocument(document, personId, currentGovernmentRows);
    if (!validation.ok) return validation;

    const editedRowsById = new Map(
        validation.value.Gobiernos.map((row) => [rowIdentity(row), row] as const)
    );
    const rowsWithGovernmentChanges = rows.map((row) => {
        if (getPersonId(row) !== personId) return row;
        return editedRowsById.get(rowIdentity(row)) ?? row;
    });

    return {
        ok: true,
        value: applyPersonDraftToRows(
            rowsWithGovernmentChanges,
            personId,
            validation.value["Datos personales"]
        ),
    };
}
