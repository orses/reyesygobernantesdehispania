import { describe, expect, it } from "vitest";
import {
    applyPersonEditorDocumentToRows,
    createPersonEditorDocument,
    validatePersonEditorDocument,
} from "./person-editor-document";
import type { RawRow } from "./types";

const rows: RawRow[] = [
    {
        _rowId: "alfonso-leon",
        PersonID: "alfonso",
        "Nombre principal": "Alfonso X",
        Reino: "Reino de León",
        "Inicio del reinado (año)": 1252,
        Descripción: "Texto anterior",
    },
    {
        _rowId: "alfonso-castilla",
        PersonID: "alfonso",
        "Nombre principal": "Alfonso X",
        Reino: "Reino de Castilla",
        "Inicio del reinado (año)": 1252,
        Descripción: "Texto anterior",
    },
    {
        _rowId: "sancho-castilla",
        PersonID: "sancho",
        "Nombre principal": "Sancho IV",
        Reino: "Reino de Castilla",
    },
];

describe("documento JSON del editor de personaje", () => {
    it("reúne los datos personales y todos sus gobiernos sin compartir referencias", () => {
        const personalData: RawRow = {
            PersonID: "alfonso",
            "Nombre principal": "Alfonso X",
            Descripción: "Texto anterior",
        };

        const document = createPersonEditorDocument(personalData, rows.slice(0, 2));

        expect(document).toEqual({
            "Datos personales": personalData,
            Gobiernos: rows.slice(0, 2),
        });
        expect(document["Datos personales"]).not.toBe(personalData);
        expect(document.Gobiernos[0]).not.toBe(rows[0]);
    });

    it("acepta un documento completo que conserva la identidad de sus filas", () => {
        const document = createPersonEditorDocument(
            { PersonID: "alfonso", "Nombre principal": "Alfonso X" },
            rows.slice(0, 2)
        );

        expect(validatePersonEditorDocument(document, "alfonso", rows.slice(0, 2))).toEqual({
            ok: true,
            value: document,
        });
    });

    it.each([
        [null, "debe ser un objeto"],
        [{ "Datos personales": [], Gobiernos: [] }, "Datos personales"],
        [{ "Datos personales": { PersonID: "alfonso" }, Gobiernos: {} }, "Gobiernos"],
        [
            {
                "Datos personales": { PersonID: "otro" },
                Gobiernos: rows.slice(0, 2),
            },
            "PersonID",
        ],
        [
            {
                "Datos personales": { PersonID: "alfonso" },
                Gobiernos: [rows[0]],
            },
            "mismas filas",
        ],
        [
            {
                "Datos personales": { PersonID: "alfonso" },
                Gobiernos: [rows[0], { ...rows[1], PersonID: "otro" }],
            },
            "PersonID",
        ],
        [
            {
                "Datos personales": { PersonID: "alfonso" },
                Gobiernos: [rows[0], "fila inválida"],
            },
            "elementos",
        ],
        [
            {
                "Datos personales": { PersonID: "alfonso" },
                Gobiernos: [rows[0], { ...rows[1], _rowId: "fila-nueva" }],
            },
            "identificadores",
        ],
        [
            {
                "Datos personales": { PersonID: "alfonso" },
                Gobiernos: [rows[0], { ...rows[1], _rowId: rows[0]._rowId }],
            },
            "identificadores",
        ],
    ])("rechaza estructuras que podrían mezclar personajes o gobiernos", (value, expectedError) => {
        const result = validatePersonEditorDocument(value, "alfonso", rows.slice(0, 2));

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain(expectedError);
    });

    it("aplica por separado los datos personales y los cambios de cada gobierno", () => {
        const document = createPersonEditorDocument(
            {
                PersonID: "alfonso",
                "Nombre principal": "Alfonso X",
                Descripción: "**Nueva descripción**",
            },
            rows.slice(0, 2)
        );
        document.Gobiernos[0].Reino = "Corona de León";
        document.Gobiernos[1]["Inicio del reinado (año)"] = 1253;

        const result = applyPersonEditorDocumentToRows(rows, "alfonso", document);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value[0]).toMatchObject({
            Reino: "Corona de León",
            Descripción: "**Nueva descripción**",
        });
        expect(result.value[1]).toMatchObject({
            Reino: "Reino de Castilla",
            "Inicio del reinado (año)": 1253,
            Descripción: "**Nueva descripción**",
        });
        expect(result.value[2]).toEqual(rows[2]);
    });

    it("no propaga como datos personales los campos exclusivos de un gobierno", () => {
        const document = createPersonEditorDocument(
            {
                PersonID: "alfonso",
                "Nombre principal": "Alfonso X",
                Reino: "No debe propagarse",
                "Inicio del reinado (año)": 9999,
            },
            rows.slice(0, 2)
        );

        const result = applyPersonEditorDocumentToRows(rows, "alfonso", document);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.slice(0, 2).map((row) => row.Reino)).toEqual([
            "Reino de León",
            "Reino de Castilla",
        ]);
        expect(result.value.slice(0, 2).map((row) => row["Inicio del reinado (año)"])).toEqual([
            1252,
            1252,
        ]);
    });

    it("rechaza los gobiernos cuyos años no coinciden con sus fechas detalladas", () => {
        const document = createPersonEditorDocument(
            { PersonID: "alfonso", "Nombre principal": "Alfonso X" },
            rows.slice(0, 2)
        );
        document.Gobiernos[0]["Inicio del reinado (año)"] = 1200;
        document.Gobiernos[0]["Inicio Reinado (Fecha)"] = "agosto de 1252";
        document.Gobiernos[1]["Final del reinado (año)"] = "";
        document.Gobiernos[1]["Fin Reinado (Fecha)"] = "abril de 1284";

        const result = applyPersonEditorDocumentToRows(rows, "alfonso", document);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toContain("contiene el año 1252");
        expect(result.error).toContain("Confirme la corrección");
    });
});
