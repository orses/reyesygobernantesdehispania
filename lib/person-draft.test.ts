import { describe, expect, it } from "vitest";
import { applyPersonDraftToRows } from "./person-draft";
import type { RawRow } from "./types";

describe("applyPersonDraftToRows", () => {
    it("sincroniza el Apelativo de persona en todos sus reinados", () => {
        const rows: RawRow[] = [
            {
                _rowId: "alfonso-leon",
                PersonID: "alfonso",
                Nombre: "Alfonso X",
                Apelativo: "",
                Reino: "Reino de León",
                "Inicio del reinado (año)": 1252,
                "Final del reinado (año)": 1284,
            },
            {
                _rowId: "alfonso-castilla",
                PersonID: "alfonso",
                Nombre: "Alfonso X",
                Apelativo: "el Astrónomo",
                Reino: "Reino de Castilla",
                "Inicio del reinado (año)": 1252,
                "Final del reinado (año)": 1284,
            },
            {
                _rowId: "sancho-castilla",
                PersonID: "sancho",
                Nombre: "Sancho IV",
                Apelativo: "el Bravo",
                Reino: "Reino de Castilla",
            },
        ];

        const result = applyPersonDraftToRows(rows, "alfonso", {
            "Nombre principal": "Alfonso X",
            Apelativo: "el Sabio",
            "Información verificada": "sí",
        });

        expect(result.filter((row) => row.PersonID === "alfonso").map((row) => row.Apelativo)).toEqual([
            "el Sabio",
            "el Sabio",
        ]);
        expect(result.find((row) => row._rowId === "sancho-castilla")?.Apelativo).toBe("el Bravo");
    });

    it("mantiene los campos propios de cada gobierno al aplicar datos de persona", () => {
        const rows: RawRow[] = [
            {
                _rowId: "alfonso-leon",
                PersonID: "alfonso",
                Nombre: "Alfonso X",
                Reino: "Reino de León",
                "Inicio del reinado (año)": 1252,
                "Final del reinado (año)": 1284,
            },
            {
                _rowId: "alfonso-castilla",
                PersonID: "alfonso",
                Nombre: "Alfonso X",
                Reino: "Reino de Castilla",
                "Inicio del reinado (año)": 1252,
                "Final del reinado (año)": 1284,
            },
        ];

        const result = applyPersonDraftToRows(rows, "alfonso", {
            "Nombre principal": "Alfonso X",
            Apelativo: "el Sabio",
            "Nacimiento (Fecha)": "23 de noviembre de 1221",
            "Información verificada": "no",
        });

        expect(result.map((row) => row.Reino)).toEqual(["Reino de León", "Reino de Castilla"]);
        expect(result.map((row) => row["Inicio del reinado (año)"])).toEqual([1252, 1252]);
        expect(result.map((row) => row["Nacimiento (Fecha)"])).toEqual([
            "23 de noviembre de 1221",
            "23 de noviembre de 1221",
        ]);
    });

    it("aplica la dinastía editada en persona a todos sus gobiernos", () => {
        const rows: RawRow[] = [
            {
                _rowId: "fernando-castilla",
                PersonID: "fernando",
                Nombre: "Fernando",
                Reino: "Corona de Castilla",
                Dinastía: "Sin revisar",
            },
            {
                _rowId: "fernando-aragon",
                PersonID: "fernando",
                Nombre: "Fernando",
                Reino: "Corona de Aragón",
                Dinastía: "Sin revisar",
            },
        ];

        const result = applyPersonDraftToRows(rows, "fernando", {
            "Nombre principal": "Fernando II",
            Dinastía: "Trastámara",
            "Información verificada": "sí",
        });

        expect(result.map((row) => row.Dinastía)).toEqual(["Trastámara", "Trastámara"]);
    });

    it("no borra dinastías de gobiernos si el borrador de persona no trae dinastía", () => {
        const rows: RawRow[] = [
            {
                _rowId: "alfonso-leon",
                PersonID: "alfonso",
                Nombre: "Alfonso",
                Reino: "Reino de León",
                Dinastía: "Borgoña",
            },
            {
                _rowId: "alfonso-castilla",
                PersonID: "alfonso",
                Nombre: "Alfonso",
                Reino: "Reino de Castilla",
                Dinastía: "Trastámara",
            },
        ];

        const result = applyPersonDraftToRows(rows, "alfonso", {
            "Nombre principal": "Alfonso",
            Dinastía: "",
            "Información verificada": "sí",
        });

        expect(result.map((row) => row.Dinastía)).toEqual(["Borgoña", "Trastámara"]);
    });

    it("preserva Imagen URL cuando el editor de persona no la envía", () => {
        const rows: RawRow[] = [
            {
                _rowId: "isabel",
                PersonID: "isabel",
                Nombre: "Isabel",
                Reino: "Corona de Castilla",
                "Imagen URL": "https://example.test/isabel.jpg",
            },
        ];

        const result = applyPersonDraftToRows(rows, "isabel", {
            "Nombre principal": "Isabel I",
            "Información verificada": "sí",
        });

        expect(result[0]["Imagen URL"]).toBe("https://example.test/isabel.jpg");
    });

    it("no copia sucesión manual desde el borrador de persona", () => {
        const rows: RawRow[] = [
            {
                _rowId: "alfonso",
                PersonID: "alfonso",
                Nombre: "Alfonso X",
                Predecesor: "fernando",
                Sucesor: "sancho",
            },
        ];

        const result = applyPersonDraftToRows(rows, "alfonso", {
            "Nombre principal": "Alfonso X",
            Apelativo: "el Sabio",
            Predecesor: "no-debe-copiarse",
            Sucesor: "no-debe-copiarse",
            "Información verificada": "sí",
        });

        expect(result[0]).toMatchObject({
            Apelativo: "el Sabio",
            Predecesor: "fernando",
            Sucesor: "sancho",
            "Información verificada": "sí",
        });
    });
});
