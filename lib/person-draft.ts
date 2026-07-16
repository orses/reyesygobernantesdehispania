import { boolFromVerified, computeDerivedRow, getPersonId, verifiedToText } from "./data";
import type { RawRow } from "./types";

/** Campos que pertenecen al personaje y pueden propagarse a todos sus gobiernos. */
export const PERSON_DRAFT_KEYS = [
    "PersonID",
    "Nombre principal",
    "Apelativo",
    "Dinastía",
    "Información verificada",
    "Nacimiento (Fecha)",
    "Nacimiento (lugar)",
    "Nacimiento (ciudad)",
    "Nacimiento (provincia)",
    "Nacimiento (País)",
    "Fallecimiento (Fecha)",
    "Fallecimiento (lugar)",
    "Fallecimiento (ciudad)",
    "Fallecimiento (provincia)",
    "Fallecimiento (País)",
    "Enterramiento",
    "Descripción",
    "Imagen URL",
    "Galería",
    "Ficha RAH URL",
] as const;

export function pickPersonDraftFields(draft: RawRow): RawRow {
    return PERSON_DRAFT_KEYS.reduce<RawRow>((result, key) => {
        if (Object.prototype.hasOwnProperty.call(draft, key)) {
            (result as Record<string, unknown>)[key] = draft[key];
        }
        return result;
    }, {});
}

export function applyPersonDraftToRows(rows: RawRow[], personId: string, draft: RawRow): RawRow[] {
    const personDraft = pickPersonDraftFields(draft);
    const { Dinastía: draftDinastia, ...personDraftWithoutDinastia } = personDraft;
    const dinastia = String(draftDinastia ?? "").trim();
    const normalizedPersonDraft: RawRow = dinastia
        ? { ...personDraftWithoutDinastia, Dinastía: dinastia }
        : personDraftWithoutDinastia;
    const verifiedText = String(draft["Información verificada"] ?? "").trim();
    const verifiedBool = boolFromVerified(verifiedText);

    return rows
        .map((row) => {
            if (String(getPersonId(row)) !== personId) return row;

            const next = {
                ...row,
                ...normalizedPersonDraft,
                "Información verificada": verifiedToText(verifiedBool),
            };
            return computeDerivedRow(next);
        })
        .map((row) => ({ ...row }));
}
