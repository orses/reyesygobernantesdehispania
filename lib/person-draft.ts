import { boolFromVerified, computeDerivedRow, getPersonId, verifiedToText } from "./data";
import type { RawRow } from "./types";

export function applyPersonDraftToRows(rows: RawRow[], personId: string, draft: RawRow): RawRow[] {
    const { Predecesor: _predecesor, Sucesor: _sucesor, ...personDraft } = draft;
    const verifiedText = String(draft["Información verificada"] ?? "").trim();
    const verifiedBool = boolFromVerified(verifiedText);

    return rows
        .map((row) => {
            if (String(getPersonId(row)) !== personId) return row;

            const next = {
                ...row,
                ...personDraft,
                "Información verificada": verifiedToText(verifiedBool),
            };
            return computeDerivedRow(next);
        })
        .map((row) => ({ ...row }));
}
