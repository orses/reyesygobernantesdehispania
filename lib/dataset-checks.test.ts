import { describe, expect, it } from "vitest";
import { checkDatasetRows } from "./dataset-checks";

describe("comprobaciones estructurales del conjunto de datos", () => {
    it("identifica con precisión la fila que contiene una incoherencia cronológica", () => {
        const result = checkDatasetRows([
            {
                _rowId: "fruela-leon",
                ID: "fruela-leon",
                PersonID: "fruela-2",
                "Nombre principal": "Fruela II",
                Reino: "Reino de León",
                "Inicio del reinado (año)": 924,
                "Final del reinado (año)": 924,
                "Fin Reinado (Fecha)": "agosto de 925",
            },
        ]);

        expect(result.ok).toBe(false);
        expect(result.issues).toEqual([
            "Fila 1 · Fruela II · Reino de León · PersonID «fruela-2» · ID «fruela-leon»: La fecha de final contiene el año 925, pero el campo de año indica «924».",
        ]);
    });

    it("detalla cada clase de problema y la fila en la que aparece", () => {
        const result = checkDatasetRows([
            {
                _rowId: "duplicado",
                PersonID: "primero",
                Nombre: "Gobernante válido",
                Reino: "Reino A",
            },
            {
                _rowId: "duplicado",
                Nombre: "https://example.com",
                Reino: "Reino B",
                "Inicio del reinado (año)": 930,
                "Final del reinado (año)": 925,
            },
        ]);

        expect(result.ok).toBe(false);
        expect(result.issues).toHaveLength(4);
        expect(result.issues.every((issue) => issue.includes("Fila 2"))).toBe(true);
        expect(result.issues.join(" ")).toContain("repite el identificador de la fila 1");
        expect(result.issues.join(" ")).toContain("falta el PersonID");
        expect(result.issues.join(" ")).toContain("parece contener una URL");
    });

    it("no genera avisos para filas coherentes", () => {
        expect(checkDatasetRows([{
            _rowId: "fila-correcta",
            PersonID: "persona-correcta",
            Nombre: "Gobernante",
            Reino: "Reino",
            "Inicio del reinado (año)": 924,
            "Final del reinado (año)": 925,
            "Fin Reinado (Fecha)": "agosto de 925",
        }])).toEqual({ ok: true, issues: [] });
    });
});
