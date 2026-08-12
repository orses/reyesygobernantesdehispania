import { describe, expect, it } from "vitest";
import {
    applyRowDraftToRows,
    prepareDatasetRows,
    removeRowById,
} from "./dataset-rows";
import type { RawRow } from "./types";

function row(values: RawRow = {}): RawRow {
    return {
        PersonID: "persona",
        Nombre: "Gobernante",
        ...values,
    };
}

describe("regresión: identificadores internos únicos", () => {
    it("asigna identificadores internos únicos sin alterar ID documentales duplicados", () => {
        const source = [row({ ID: "duplicado" }), row({ ID: "duplicado" })];

        const result = prepareDatasetRows(source);

        expect(result.map((item) => item.ID)).toEqual(["duplicado", "duplicado"]);
        expect(result.map((item) => item._rowId)).toEqual(["duplicado", "duplicado~2"]);
        expect(result[0]).not.toBe(source[0]);
        expect(result[1]).not.toBe(source[1]);
    });

    it("reserva los sufijos ya presentes al resolver colisiones", () => {
        const result = prepareDatasetRows([
            row({ _rowId: "fila" }),
            row({ _rowId: "fila" }),
            row({ _rowId: "fila~2" }),
        ]);

        expect(result.map((item) => item._rowId)).toEqual(["fila", "fila~3", "fila~2"]);
    });

    it("usa el primer identificador documental no vacío", () => {
        const result = prepareDatasetRows([row({ ID: "   ", id: "alternativo" })]);

        expect(result[0]._rowId).toBe("alternativo");
        expect(result[0].ID).toBe("   ");
    });

    it("convierte un identificador numérico en una clave técnica de texto", () => {
        const result = prepareDatasetRows([row({ id: 17 })]);

        expect(result[0]._rowId).toBe("17");
        expect(result[0].id).toBe(17);
    });

    it("resuelve la colisión entre una clave de respaldo y un ID documental", () => {
        const result = prepareDatasetRows([row(), row({ ID: "row-1" })]);

        expect(result.map((item) => item._rowId)).toEqual(["row-1", "row-1~2"]);
    });

    it("no modifica las filas de entrada", () => {
        const source = [row({ ID: "duplicado" }), row({ ID: "duplicado" })];
        const snapshot = structuredClone(source);

        prepareDatasetRows(source);

        expect(source).toEqual(snapshot);
    });

    it("repara identificadores internos duplicados recuperados de IndexedDB", () => {
        const result = prepareDatasetRows([
            row({ ID: "documental-1", _rowId: "legado" }),
            row({ ID: "documental-2", _rowId: "legado" }),
        ]);

        expect(result.map((item) => item._rowId)).toEqual(["legado", "legado~2"]);
        expect(result.map((item) => item.ID)).toEqual(["documental-1", "documental-2"]);
    });

    it("es idempotente", () => {
        const once = prepareDatasetRows([
            row({ ID: "duplicado" }),
            row({ ID: "duplicado" }),
            row({}),
        ]);

        const twice = prepareDatasetRows(once);

        expect(twice.map((item) => item._rowId)).toEqual(once.map((item) => item._rowId));
    });

    it("edita solo el gobierno seleccionado aunque el ID documental esté duplicado", () => {
        const prepared = prepareDatasetRows([
            row({ ID: "duplicado", Reino: "Primero" }),
            row({ ID: "duplicado", Reino: "Segundo" }),
        ]);
        const targetId = String(prepared[1]._rowId);

        const result = applyRowDraftToRows(prepared, targetId, {
            ...prepared[1],
            Reino: "Editado",
        });

        expect(result[0]).toBe(prepared[0]);
        expect(result[0].Reino).toBe("Primero");
        expect(result[1].Reino).toBe("Editado");
        expect(result.map((item) => item.ID)).toEqual(["duplicado", "duplicado"]);
    });

    it("impide que el borrador cambie los identificadores de la fila", () => {
        const source = [row({ ID: "documental", id: "alternativo", _rowId: "interno" })];

        const result = applyRowDraftToRows(source, "interno", {
            ...source[0],
            ID: "alterado",
            id: "también-alterado",
            _rowId: "otro-interno",
        });

        expect(result[0]).toMatchObject({
            ID: "documental",
            id: "alternativo",
            _rowId: "interno",
        });
    });

    it("no convierte el identificador interno en un ID documental", () => {
        const source = [row({ _rowId: "solo-interno" })];

        const result = applyRowDraftToRows(source, "solo-interno", {
            ...source[0],
            ID: "inyectado",
            id: "inyectado-alternativo",
            Reino: "Editado",
        });

        expect(Object.hasOwn(result[0], "ID")).toBe(false);
        expect(Object.hasOwn(result[0], "id")).toBe(false);
        expect(result[0].Reino).toBe("Editado");
    });

    it("ante un estado legado corrupto, edita como máximo una fila", () => {
        const source = [
            row({ _rowId: "repetido", Reino: "Primero" }),
            row({ _rowId: "repetido", Reino: "Segundo" }),
        ];

        const result = applyRowDraftToRows(source, "repetido", {
            ...source[0],
            Reino: "Editado",
        });

        expect(result.map((item) => item.Reino)).toEqual(["Editado", "Segundo"]);
        expect(result[1]).toBe(source[1]);
    });

    it("elimina solo el gobierno seleccionado cuando el ID documental está duplicado", () => {
        const prepared = prepareDatasetRows([
            row({ ID: "duplicado", Reino: "Primero" }),
            row({ ID: "duplicado", Reino: "Segundo" }),
        ]);

        const result = removeRowById(prepared, String(prepared[1]._rowId));

        expect(result).toHaveLength(1);
        expect(result[0].Reino).toBe("Primero");
    });

    it("ante un estado legado corrupto, elimina como máximo una fila", () => {
        const source = [
            row({ _rowId: "repetido", Reino: "Primero" }),
            row({ _rowId: "repetido", Reino: "Segundo" }),
        ];

        const result = removeRowById(source, "repetido");

        expect(result.map((item) => item.Reino)).toEqual(["Segundo"]);
    });

    it("conserva la referencia original cuando no encuentra la fila", () => {
        const source = [row({ _rowId: "existente" })];

        expect(applyRowDraftToRows(source, "ausente", row())).toBe(source);
        expect(removeRowById(source, "ausente")).toBe(source);
    });

    it("protege el flujo completo de preparación, edición y borrado", () => {
        const prepared = prepareDatasetRows([
            row({ ID: "duplicado", Reino: "Primero" }),
            row({ ID: "duplicado", Reino: "Segundo" }),
        ]);
        const first = prepared[0];
        const secondId = String(prepared[1]._rowId);

        const edited = applyRowDraftToRows(prepared, secondId, {
            ...prepared[1],
            Reino: "Editado",
        });
        const remaining = removeRowById(edited, secondId);

        expect(edited[0]).toBe(first);
        expect(remaining).toEqual([first]);
    });
});
