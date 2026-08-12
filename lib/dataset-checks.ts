import { asYearOrNull, firstNonEmpty, getPersonId } from "./data";
import { getReignYearMismatches, reignYearMismatchMessage } from "./reign-chronology";
import type { DatasetChecks, RawRow } from "./types";

function internalRowIdentifier(row: RawRow): string {
    return String(row._rowId ?? row.ID ?? "").trim();
}

function documentaryRowIdentifier(row: RawRow): string {
    return String(row.ID ?? row.id ?? "").trim();
}

function rowContext(row: RawRow, index: number): string {
    const name = firstNonEmpty(
        row["Nombre principal"],
        row.Nombre,
        row.nombre,
        row.Apelativo,
        "(sin nombre)"
    );
    const kingdom = firstNonEmpty(row.Reino, "(sin reino)");
    const personId = getPersonId(row);
    const identifier = internalRowIdentifier(row);
    const personText = personId ? `PersonID «${personId}»` : "sin PersonID";
    const identifierText = identifier ? `ID «${identifier}»` : "sin ID";
    return `Fila ${index + 1} · ${name} · ${kingdom} · ${personText} · ${identifierText}`;
}

/** Genera avisos localizables y verificables para cada fila afectada. */
export function checkDatasetRows(rows: RawRow[]): DatasetChecks {
    const issues: string[] = [];
    const firstIndexByInternalIdentifier = new Map<string, number>();
    const firstIndexByDocumentaryIdentifier = new Map<string, number>();

    rows.forEach((row, index) => {
        const context = rowContext(row, index);
        const internalIdentifier = internalRowIdentifier(row);
        const firstInternalIndex = internalIdentifier
            ? firstIndexByInternalIdentifier.get(internalIdentifier)
            : undefined;

        if (internalIdentifier && firstInternalIndex !== undefined) {
            issues.push(`${context}: repite el identificador interno de la fila ${firstInternalIndex + 1}.`);
        } else if (internalIdentifier) {
            firstIndexByInternalIdentifier.set(internalIdentifier, index);
        }

        const documentaryIdentifier = documentaryRowIdentifier(row);
        const firstDocumentaryIndex = documentaryIdentifier
            ? firstIndexByDocumentaryIdentifier.get(documentaryIdentifier)
            : undefined;

        if (documentaryIdentifier && firstDocumentaryIndex !== undefined) {
            issues.push(`${context}: repite el ID documental de la fila ${firstDocumentaryIndex + 1}.`);
        } else if (documentaryIdentifier) {
            firstIndexByDocumentaryIdentifier.set(documentaryIdentifier, index);
        }

        const startYear = asYearOrNull(row["Inicio del reinado (año)"]);
        const endYear = asYearOrNull(row["Final del reinado (año)"]);
        if (startYear !== null && endYear !== null && startYear > endYear) {
            issues.push(`${context}: el año de inicio (${startYear}) es posterior al de final (${endYear}).`);
        }

        for (const mismatch of getReignYearMismatches(row)) {
            issues.push(`${context}: ${reignYearMismatchMessage(mismatch)}`);
        }

        if (!getPersonId(row)) {
            issues.push(`${context}: falta el PersonID.`);
        }

        const hasUrlAsName =
            /^(https?:\/\/|www\.)/i.test(String(row.Nombre ?? "")) ||
            /^(https?:\/\/|www\.)/i.test(String(row.Apelativo ?? ""));
        if (hasUrlAsName) {
            issues.push(`${context}: «Nombre» o «Apelativo» parece contener una URL.`);
        }
    });

    return { ok: issues.length === 0, issues };
}
