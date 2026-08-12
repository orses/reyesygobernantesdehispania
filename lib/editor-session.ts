import { getPersonId, verifiedToText } from "./data";
import type { Person, RawRow } from "./types";

/** Sesión sin un editor activo ni borradores residuales. */
export interface ClosedEditorSession {
    kind: "closed";
}

/** Sesión que edita los datos comunes y los gobiernos de una persona. */
export interface PersonEditorSession {
    kind: "person";
    personId: string | number;
    draft: RawRow;
    governmentRows: RawRow[];
}

/** Sesión que edita exclusivamente una fila de gobierno. */
export interface RowEditorSession {
    kind: "row";
    personId: string | null;
    rowId: string | number;
    draft: RawRow;
}

export type EditorSession =
    | ClosedEditorSession
    | PersonEditorSession
    | RowEditorSession;

export type EditorDraftUpdate =
    | RawRow
    | null
    | ((current: RawRow | null) => RawRow | null);

export type GovernmentRowsUpdate =
    | RawRow[]
    | ((current: RawRow[]) => RawRow[]);

export type EditorSessionAction =
    | { type: "close" }
    | { type: "open-person"; person: Person }
    | { type: "open-row"; row: RawRow; rowId: string | number }
    | {
        type: "open-new-person";
        personId: string | number;
        row: RawRow;
    }
    | { type: "set-draft"; value: EditorDraftUpdate }
    | { type: "set-government-rows"; value: GovernmentRowsUpdate };

export interface CompleteEditorSaveOptions {
    commit: () => Promise<string | null>;
    closeAfterSave: boolean;
    setError: (error: string | null) => void;
    close: () => void;
}

/** Cierra el editor únicamente después de que la persistencia confirme el borrador. */
export async function completeEditorSave({
    commit,
    closeAfterSave,
    setError,
    close,
}: CompleteEditorSaveOptions): Promise<boolean> {
    const error = await commit();
    if (error) {
        setError(error);
        return false;
    }

    setError(null);
    if (closeAfterSave) close();
    return true;
}

function cloneRow(row: RawRow): RawRow {
    return structuredClone(row);
}

function cloneRows(rows: RawRow[]): RawRow[] {
    return rows.map(cloneRow);
}

/** Construye los campos personales que muestra el editor a partir del modelo derivado. */
export function createPersonDraft(person: Person): RawRow {
    const base = person.reinados[0] ?? {};

    return {
        PersonID: person.personId,
        "Nombre principal": person.nombrePrincipal === "(sin nombre)"
            ? ""
            : person.nombrePrincipal,
        Apelativo: person.apelativos[0] ?? base.Apelativo ?? base.apelativo ?? "",
        Dinastía: person.hasDinastiaConflict ? "" : person.dinastia,
        "Información verificada": verifiedToText(person.verifiedAll),
        "Nacimiento (Fecha)": base["Nacimiento (Fecha)"] ?? "",
        "Nacimiento (lugar)": base["Nacimiento (lugar)"] ?? "",
        "Nacimiento (ciudad)": base["Nacimiento (ciudad)"] ?? "",
        "Nacimiento (provincia)": base["Nacimiento (provincia)"] ?? "",
        "Nacimiento (País)": base["Nacimiento (País)"] ?? "",
        "Fallecimiento (Fecha)": base["Fallecimiento (Fecha)"] ?? "",
        "Fallecimiento (lugar)": base["Fallecimiento (lugar)"] ?? "",
        "Fallecimiento (ciudad)": base["Fallecimiento (ciudad)"] ?? "",
        "Fallecimiento (provincia)": base["Fallecimiento (provincia)"] ?? "",
        "Fallecimiento (País)": base["Fallecimiento (País)"] ?? "",
        Enterramiento: base.Enterramiento ?? "",
        "Ficha RAH URL": base["Ficha RAH URL"] ?? "",
        Descripción: base.Descripción ?? "",
    };
}

/** Construye el borrador vacío que acompaña a una persona recién creada. */
export function createNewPersonDraft(personId: string | number): RawRow {
    return {
        PersonID: personId,
        "Nombre principal": "",
        Apelativo: "",
        Dinastía: "",
        "Información verificada": verifiedToText(false),
        "Nacimiento (Fecha)": "",
        "Nacimiento (lugar)": "",
        "Nacimiento (ciudad)": "",
        "Nacimiento (provincia)": "",
        "Nacimiento (País)": "",
        "Fallecimiento (Fecha)": "",
        "Fallecimiento (lugar)": "",
        "Fallecimiento (ciudad)": "",
        "Fallecimiento (provincia)": "",
        "Fallecimiento (País)": "",
        Enterramiento: "",
        "Ficha RAH URL": "",
        Descripción: "",
    };
}

export function createClosedEditorSession(): ClosedEditorSession {
    return { kind: "closed" };
}

export function createPersonEditorSession(person: Person): PersonEditorSession {
    return {
        kind: "person",
        personId: person.personId,
        draft: createPersonDraft(person),
        governmentRows: cloneRows(person.reinados),
    };
}

export function createRowEditorSession(
    row: RawRow,
    rowId: string | number = String(row._rowId ?? "")
): RowEditorSession {
    return {
        kind: "row",
        personId: getPersonId(row) || null,
        rowId,
        draft: cloneRow(row),
    };
}

export function createNewPersonEditorSession(
    personId: string | number,
    row: RawRow
): PersonEditorSession {
    return {
        kind: "person",
        personId,
        draft: createNewPersonDraft(personId),
        governmentRows: [cloneRow(row)],
    };
}

/** Mantiene juntas las propiedades válidas para cada modo de edición. */
export function editorSessionReducer(
    session: EditorSession,
    action: EditorSessionAction
): EditorSession {
    switch (action.type) {
        case "close":
            return createClosedEditorSession();
        case "open-person":
            return createPersonEditorSession(action.person);
        case "open-row":
            return createRowEditorSession(action.row, action.rowId);
        case "open-new-person":
            return createNewPersonEditorSession(action.personId, action.row);
        case "set-draft": {
            if (session.kind === "closed") return session;
            const currentDraft = cloneRow(session.draft);
            const nextDraft = typeof action.value === "function"
                ? action.value(currentDraft)
                : action.value;
            if (nextDraft === null) return createClosedEditorSession();
            return { ...session, draft: cloneRow(nextDraft) };
        }
        case "set-government-rows": {
            if (session.kind !== "person") return session;
            const currentRows = cloneRows(session.governmentRows);
            const nextRows = typeof action.value === "function"
                ? action.value(currentRows)
                : action.value;
            return { ...session, governmentRows: cloneRows(nextRows) };
        }
    }
}
