import { describe, expect, it } from "vitest";
import {
    applyConfirmedReignYear,
    extractExplicitYearFromDate,
    getExplicitReignDateYear,
    getReignYearMismatches,
    reignYearMismatchMessage,
} from "./reign-chronology";

describe("sincronización de la cronología de los reinados", () => {
    it.each([
        ["10 de mayo de 1479", 1479],
        ["agosto de 925", 925],
        ["12/08/0925", 925],
        ["218 a. C.", -218],
    ])("extrae el año explícito de «%s»", (date, expectedYear) => {
        expect(extractExplicitYearFromDate(date)).toBe(expectedYear);
    });

    it.each(["", "siglo X", "principios del siglo IX", "entre 924 y 925"])(
        "no inventa un año para una fecha imprecisa o ambigua: «%s»",
        (date) => {
            expect(extractExplicitYearFromDate(date)).toBeNull();
        }
    );

    it("señala los años de inicio y fin que discrepan de las fechas", () => {
        const mismatches = getReignYearMismatches({
            "Inicio del reinado (año)": 924,
            "Final del reinado (año)": "",
            "Inicio Reinado (Fecha)": "enero de 925",
            "Fin Reinado (Fecha)": "18 de junio de 930",
        });

        expect(mismatches.map((mismatch) => mismatch.suggestedYear)).toEqual([925, 930]);
        expect(reignYearMismatchMessage(mismatches[0])).toContain("indica «924»");
        expect(reignYearMismatchMessage(mismatches[1])).toContain("está vacío");
    });

    it("solo aplica el año propuesto mediante la operación de confirmación", () => {
        const row = {
            "Final del reinado (año)": 924,
            "Fin Reinado (Fecha)": "agosto de 925",
        };

        expect(row["Final del reinado (año)"]).toBe(924);
        expect(applyConfirmedReignYear(row, "end")["Final del reinado (año)"]).toBe(925);
    });

    it("acepta una datación aproximada que ya alude al mismo año", () => {
        expect(getReignYearMismatches({
            "Final del reinado (año)": "c. 925",
            "Fin Reinado (Fecha)": "agosto de 925",
        })).toEqual([]);
    });

    it("conserva el dato introducido cuando la fecha no ofrece un año explícito", () => {
        const row = {
            "Inicio del reinado (año)": "p. s. X",
            "Inicio Reinado (Fecha)": "principios del siglo X",
        };

        expect(getReignYearMismatches(row)).toEqual([]);
        expect(applyConfirmedReignYear(row, "start")).toBe(row);
    });

    it("reconoce las variantes históricas del nombre del campo de fecha", () => {
        expect(getExplicitReignDateYear({ finReinado: "agosto de 925" }, "end")).toBe(925);
    });
});
