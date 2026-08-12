import { describe, expect, it, vi } from "vitest";
import {
    completeEditorSave,
    createClosedEditorSession,
    createNewPersonEditorSession,
    createPersonEditorSession,
    createRowEditorSession,
    editorSessionReducer,
} from "./editor-session";
import type { Person, RawRow } from "./types";

function createPerson(governmentRows: RawRow[]): Person {
    return {
        personId: "7",
        nombrePrincipal: "Alfonso",
        nombres: ["Alfonso"],
        apelativos: ["el Sabio"],
        reinos: ["Castilla"],
        dinastia: "Borgoña",
        dinastias: ["Borgoña"],
        hasDinastiaConflict: false,
        verifiedAll: true,
        minInicioAnio: 1252,
        birthYear: 1221,
        deathYear: 1284,
        birthRaw: "1221",
        deathRaw: "1284",
        age: 63,
        reinados: governmentRows,
    };
}

const governmentRow: RawRow = {
    ID: "documental-7",
    id: "documental-legado-7",
    _rowId: "interno-7",
    PersonID: "7",
    Nombre: "Alfonso",
    Apelativo: "el Sabio",
    Dinastía: "Borgoña",
    "Información verificada": "sí",
    "Nacimiento (Fecha)": "1221",
    "Fallecimiento (Fecha)": "1284",
    Reino: "Castilla",
    metadata: { source: { page: 7 } },
};

describe("constructores de la sesión de edición", () => {
    it("crea una sesión cerrada sin conservar datos de una edición anterior", () => {
        expect(createClosedEditorSession()).toEqual({ kind: "closed" });
    });

    it("crea el borrador de persona y clona profundamente sus gobiernos", () => {
        const sourceRow = structuredClone(governmentRow);
        const person = createPerson([sourceRow]);

        const session = createPersonEditorSession(person);

        expect(session).toMatchObject({
            kind: "person",
            personId: "7",
            draft: {
                PersonID: "7",
                "Nombre principal": "Alfonso",
                Apelativo: "el Sabio",
                Dinastía: "Borgoña",
                "Información verificada": "sí",
                "Nacimiento (Fecha)": "1221",
                "Fallecimiento (Fecha)": "1284",
            },
            governmentRows: [{
                ID: "documental-7",
                id: "documental-legado-7",
                _rowId: "interno-7",
            }],
        });
        expect(session.governmentRows[0]).not.toBe(sourceRow);

        session.governmentRows[0].Nombre = "Nombre editado";
        const sessionMetadata = session.governmentRows[0].metadata as {
            source: { page: number };
        };
        sessionMetadata.source.page = 99;

        expect(sourceRow.Nombre).toBe("Alfonso");
        expect(sourceRow.metadata).toEqual({ source: { page: 7 } });
    });

    it("crea el borrador de fila sin perder identificadores internos ni documentales", () => {
        const sourceRow = structuredClone(governmentRow);

        const session = createRowEditorSession(sourceRow, "interno-7");

        expect(session).toMatchObject({
            kind: "row",
            rowId: "interno-7",
            personId: "7",
            draft: {
                ID: "documental-7",
                id: "documental-legado-7",
                _rowId: "interno-7",
            },
        });
        expect(session.draft).not.toBe(sourceRow);

        const sessionMetadata = session.draft.metadata as {
            source: { page: number };
        };
        sessionMetadata.source.page = 99;

        expect(sourceRow.metadata).toEqual({ source: { page: 7 } });
    });

    it("crea una sesión de persona nueva sin alterar la fila ya añadida", () => {
        const newRow: RawRow = {
            ID: "documental-nuevo",
            _rowId: "interno-nuevo",
            PersonID: "8",
            Nombre: "",
        };

        const session = createNewPersonEditorSession("8", newRow);

        expect(session).toEqual({
            kind: "person",
            personId: "8",
            draft: {
                PersonID: "8",
                "Nombre principal": "",
                Apelativo: "",
                Dinastía: "",
                "Información verificada": "no",
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
            },
            governmentRows: [{
                ID: "documental-nuevo",
                _rowId: "interno-nuevo",
                PersonID: "8",
                Nombre: "",
            }],
        });
        expect(session.governmentRows[0]).not.toBe(newRow);
        expect(newRow).toEqual({
            ID: "documental-nuevo",
            _rowId: "interno-nuevo",
            PersonID: "8",
            Nombre: "",
        });
    });
});

describe("transiciones de la sesión de edición", () => {
    it("cambia de persona a fila y descarta el estado incompatible", () => {
        const personSession = createPersonEditorSession(createPerson([governmentRow]));

        const rowSession = editorSessionReducer(personSession, {
            type: "open-row",
            row: governmentRow,
            rowId: "interno-7",
        });

        expect(rowSession.kind).toBe("row");
        expect("governmentRows" in rowSession).toBe(false);
        expect(rowSession).toMatchObject({
            rowId: "interno-7",
            personId: "7",
        });
    });

    it("cierra cualquier modo y elimina todos sus borradores", () => {
        const rowSession = createRowEditorSession(governmentRow, "interno-7");

        const closedSession = editorSessionReducer(rowSession, { type: "close" });

        expect(closedSession).toEqual({ kind: "closed" });
        expect("draft" in closedSession).toBe(false);
    });

    it("actualiza solo los campos admitidos por el modo activo", () => {
        const personSession = createPersonEditorSession(createPerson([governmentRow]));
        const updatedPersonSession = editorSessionReducer(personSession, {
            type: "set-government-rows",
            value: (rows) => rows.map((row) => ({ ...row, Reino: "León" })),
        });
        expect(updatedPersonSession.kind).toBe("person");
        if (updatedPersonSession.kind !== "person") throw new Error("Sesión inesperada.");
        expect(updatedPersonSession.governmentRows[0].Reino).toBe("León");
        expect(personSession.governmentRows[0].Reino).toBe("Castilla");

        const rowSession = createRowEditorSession(governmentRow, "interno-7");
        const unchangedRowSession = editorSessionReducer(rowSession, {
            type: "set-government-rows",
            value: [],
        });
        expect(unchangedRowSession).toBe(rowSession);
    });
});

describe("confirmación persistente del editor", () => {
    it("no cierra el editor antes de que termine la escritura", async () => {
        let confirm: ((error: string | null) => void) | undefined;
        const commit = vi.fn(() => new Promise<string | null>((resolve) => {
            confirm = resolve;
        }));
        const close = vi.fn();
        const setError = vi.fn();

        const saving = completeEditorSave({
            commit,
            closeAfterSave: true,
            setError,
            close,
        });

        await Promise.resolve();
        expect(close).not.toHaveBeenCalled();

        confirm?.(null);
        await expect(saving).resolves.toBe(true);
        expect(setError).toHaveBeenLastCalledWith(null);
        expect(close).toHaveBeenCalledOnce();
    });

    it("conserva abierto el editor y muestra el error si la escritura falla", async () => {
        const close = vi.fn();
        const setError = vi.fn();

        await expect(completeEditorSave({
            commit: async () => "Persistencia: escritura fallida.",
            closeAfterSave: true,
            setError,
            close,
        })).resolves.toBe(false);

        expect(setError).toHaveBeenCalledWith("Persistencia: escritura fallida.");
        expect(close).not.toHaveBeenCalled();
    });

    it("confirma sin cerrar cuando se guarda mediante el atajo de teclado", async () => {
        const close = vi.fn();
        const setError = vi.fn();

        await expect(completeEditorSave({
            commit: async () => null,
            closeAfterSave: false,
            setError,
            close,
        })).resolves.toBe(true);

        expect(setError).toHaveBeenCalledWith(null);
        expect(close).not.toHaveBeenCalled();
    });
});
