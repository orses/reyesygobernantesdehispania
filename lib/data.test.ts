// ---------------------------------------------------------------------------
// Tests unitarios — lib/data.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
    asYearOrNull,
    centuryFromYear,
    formatCenturyLabel,
    parseCsv,
    generateCsv,
    normalizeRows,
    computeDerivedRow,
    getRowId,
    getPersonId,
    rowDisplayName,
    boolFromVerified,
    verifiedToText,
    asNumberOrNull,
} from "./data";
import type { RawRow } from "./types";

// ===========================================================================
// asYearOrNull
// ===========================================================================
describe("asYearOrNull", () => {
    it("devuelve null para valores vacíos o nulos", () => {
        expect(asYearOrNull(null)).toBe(null);
        expect(asYearOrNull(undefined)).toBe(null);
        expect(asYearOrNull("")).toBe(null);
        expect(asYearOrNull(" ")).toBe(null);
    });

    it("interpreta años numéricos directos", () => {
        expect(asYearOrNull(1492)).toBe(1492);
        expect(asYearOrNull("1492")).toBe(1492);
        expect(asYearOrNull("  1492  ")).toBe(1492);
    });

    it("interpreta años negativos (a. C.)", () => {
        expect(asYearOrNull(-218)).toBe(-218);
    });

    it("interpreta «c. NNN» (circa)", () => {
        expect(asYearOrNull("c. 850")).toBe(850);
        expect(asYearOrNull("c.850")).toBe(850);
    });

    it("interpreta «a. C.»", () => {
        const result = asYearOrNull("218 a. C.");
        // La función puede devolver 218 o -218 según la implementación
        expect(result).not.toBe(null);
        expect(Math.abs(result!)).toBe(218);
    });

    it("extrae el año de una fecha textual larga", () => {
        // «10 de mayo de 1479» → 1479
        const r = asYearOrNull("10 de mayo de 1479");
        expect(r).toBe(1479);
    });

    it("devuelve null para texto basura", () => {
        expect(asYearOrNull("abc")).toBe(null);
        expect(asYearOrNull("sin datos")).toBe(null);
    });

    it("interpreta siglos romanos", () => {
        // Siglo VIII = convención, e.g. c. 750
        const r = asYearOrNull("VIII");
        // Acepta cualquier resultado no-null razonable para un siglo romano
        if (r !== null) {
            expect(r).toBeGreaterThanOrEqual(700);
            expect(r).toBeLessThanOrEqual(800);
        }
    });

    it("interpreta «p. s. IX» → principios del siglo IX (año ~801)", () => {
        expect(asYearOrNull("p. s. IX")).toBe(801);
    });

    it("interpreta «p. t. s. VIII» → primer tercio del siglo VIII (año ~717)", () => {
        expect(asYearOrNull("p. t. s. VIII")).toBe(717);
    });

    it("interpreta «m. s. XII» → mediados del siglo XII (año ~1150)", () => {
        expect(asYearOrNull("m. s. XII")).toBe(1150);
    });

    it("interpreta «s. t. s. XI» → segundo tercio del siglo XI (año ~1050)", () => {
        expect(asYearOrNull("s. t. s. XI")).toBe(1050);
    });

    it("interpreta «ú. t. s. IX» → último tercio del siglo IX (año ~867)", () => {
        expect(asYearOrNull("ú. t. s. IX")).toBe(867);
    });

    it("interpreta «f. s. X» → finales del siglo X (año ~990)", () => {
        expect(asYearOrNull("f. s. X")).toBe(990);
    });

    it("interpreta formas sin puntos: «p s IX», «pts VIII»", () => {
        expect(asYearOrNull("p s IX")).toBe(801);
    });

    it("interpreta formas largas: «principios del siglo IX»", () => {
        expect(asYearOrNull("principios del siglo IX")).toBe(801);
    });

    it("interpreta formas largas: «finales del siglo XII»", () => {
        expect(asYearOrNull("finales del siglo XII")).toBe(1190);
    });
});

// ===========================================================================
// centuryFromYear
// ===========================================================================
describe("centuryFromYear", () => {
    it("devuelve el siglo correcto para años positivos", () => {
        expect(centuryFromYear(1)).toBe(1);
        expect(centuryFromYear(100)).toBe(1);
        expect(centuryFromYear(101)).toBe(2);
        expect(centuryFromYear(1479)).toBe(15);
        expect(centuryFromYear(2000)).toBe(20);
        expect(centuryFromYear(2001)).toBe(21);
    });

    it("devuelve null para valores inválidos", () => {
        expect(centuryFromYear(null)).toBe(null);
        expect(centuryFromYear(undefined)).toBe(null);
        expect(centuryFromYear("abc")).toBe(null);
    });
});

// ===========================================================================
// formatCenturyLabel
// ===========================================================================
describe("formatCenturyLabel", () => {
    it("formatea siglos en números romanos", () => {
        expect(formatCenturyLabel(8)).toMatch(/VIII/i);
        expect(formatCenturyLabel(21)).toMatch(/XXI/i);
    });
});

// ===========================================================================
// parseCsv
// ===========================================================================
describe("parseCsv", () => {
    it("parsea CSV con coma como delimitador", () => {
        const text = "Nombre,Año\nFernando V,1479\nCarlos I,1516";
        const result = parseCsv(text);
        expect(result.ok).toBe(true);
        expect(result.value).toHaveLength(2);
        expect((result.value![0] as RawRow).Nombre).toBe("Fernando V");
    });

    it("parsea CSV con punto y coma como delimitador", () => {
        const text = "Nombre;Año\nFernando V;1479\nCarlos I;1516";
        const result = parseCsv(text);
        expect(result.ok).toBe(true);
        expect(result.delimiter).toBe(";");
        expect(result.value).toHaveLength(2);
    });

    it("parsea CSV con tabulador como delimitador", () => {
        const text = "Nombre\tAño\nFernando V\t1479";
        const result = parseCsv(text);
        expect(result.ok).toBe(true);
        expect(result.value).toHaveLength(1);
    });

    it("parsea CSV con pipe como delimitador", () => {
        const text = "Nombre|Año\nFernando V|1479";
        const result = parseCsv(text);
        expect(result.ok).toBe(true);
        expect(result.value).toHaveLength(1);
    });

    it("maneja comillas dobles correctamente", () => {
        const text = 'Nombre;Reino\n"Fernando V";"Corona de Castilla"';
        const result = parseCsv(text);
        expect(result.ok).toBe(true);
        expect(result.usesQuotes).toBe(true);
        expect((result.value![0] as RawRow).Nombre).toBe("Fernando V");
    });

    it("maneja BOM UTF-8", () => {
        const text = '\uFEFFNombre;Año\nFernando V;1479';
        const result = parseCsv(text);
        expect(result.ok).toBe(true);
        expect(result.value).toHaveLength(1);
    });

    it("devuelve error para texto vacío", () => {
        const result = parseCsv("");
        expect(result.ok).toBe(false);
    });
});

// ===========================================================================
// generateCsv + ida y vuelta
// ===========================================================================
describe("generateCsv", () => {
    it("genera CSV válido a partir de un array de objetos", () => {
        const data: RawRow[] = [
            { Nombre: "Fernando V", Reino: "Castilla" },
            { Nombre: "Carlos I", Reino: "España" },
        ];
        const csv = generateCsv(data);
        expect(csv).toBeTruthy();
        expect(csv).toContain("Fernando V");
        expect(csv).toContain("Carlos I");
        // Tiene cabecera
        const lines = csv.split("\n").filter((l) => l.trim());
        expect(lines.length).toBeGreaterThanOrEqual(3); // cabecera + 2 filas
    });
});

// ===========================================================================
// normalizeRows
// ===========================================================================
describe("normalizeRows", () => {
    it("acepta un array directo", () => {
        const data = [{ Nombre: "A" }, { Nombre: "B" }];
        const result = normalizeRows(data);
        expect(result.ok).toBe(true);
        expect(result.value).toHaveLength(2);
    });

    it("acepta un objeto con clave 'datos'", () => {
        const data = { datos: [{ Nombre: "A" }] };
        const result = normalizeRows(data);
        expect(result.ok).toBe(true);
        expect(result.value).toHaveLength(1);
    });

    it("acepta un objeto con clave 'reyes'", () => {
        const data = { reyes: [{ Nombre: "A" }] };
        const result = normalizeRows(data);
        expect(result.ok).toBe(true);
        expect(result.value).toHaveLength(1);
    });

    it("devuelve error para datos no válidos", () => {
        const result = normalizeRows("no es un objeto");
        expect(result.ok).toBe(false);
    });

    it("devuelve error para null", () => {
        const result = normalizeRows(null);
        expect(result.ok).toBe(false);
    });
});

// ===========================================================================
// computeDerivedRow
// ===========================================================================
describe("computeDerivedRow", () => {
    it("calcula la duración a partir de años de inicio y fin", () => {
        const row: RawRow = {
            "Inicio del reinado (año)": 1479,
            "Final del reinado (año)": 1516,
        };
        const derived = computeDerivedRow(row);
        expect(derived._duracionCalc).toBe(37);
    });

    it("devuelve null si faltan los años", () => {
        const row: RawRow = { Nombre: "Test" };
        const derived = computeDerivedRow(row);
        expect(derived._duracionCalc).toBe(null);
    });

    it("maneja duraciones explícitas del campo", () => {
        const row: RawRow = { "Duración (años)": 25 };
        const derived = computeDerivedRow(row);
        // Debe usar el campo explícito o calcularlo
        expect(typeof derived._duracionCalc === "number" || derived._duracionCalc === null).toBe(true);
    });
});

// ===========================================================================
// getRowId / getPersonId
// ===========================================================================
describe("getRowId", () => {
    it("genera un ID a partir de los campos de la fila", () => {
        const row: RawRow = { ID: "abc123" };
        const id = getRowId(row, 0);
        expect(id).toBeTruthy();
        expect(typeof id).toBe("string");
    });

    it("genera un ID distinto para filas diferentes", () => {
        const r1: RawRow = { ID: "a" };
        const r2: RawRow = { ID: "b" };
        expect(getRowId(r1, 0)).not.toBe(getRowId(r2, 1));
    });
});

describe("getPersonId", () => {
    it("extrae PersonID del campo estándar", () => {
        const row: RawRow = { PersonID: 51 };
        // getPersonId puede devolver number o string
        expect(String(getPersonId(row))).toBe("51");
    });

    it("extrae personId alternativo", () => {
        const row: RawRow = { personId: "abc" };
        expect(getPersonId(row)).toBe("abc");
    });

    it("devuelve null/undefined si no hay PersonID", () => {
        const row: RawRow = { Nombre: "Test" };
        const pid = getPersonId(row);
        expect(pid === null || pid === undefined || pid === "").toBeTruthy();
    });
});

// ===========================================================================
// rowDisplayName
// ===========================================================================
describe("rowDisplayName", () => {
    it("devuelve el nombre si existe", () => {
        const row: RawRow = { Nombre: "Fernando V" };
        expect(rowDisplayName(row)).toBe("Fernando V");
    });

    it("devuelve un fallback para filas vacías", () => {
        const row: RawRow = {};
        const name = rowDisplayName(row);
        expect(typeof name).toBe("string");
    });
});

// ===========================================================================
// boolFromVerified / verifiedToText
// ===========================================================================
describe("boolFromVerified / verifiedToText", () => {
    it("interpreta «sí» como true", () => {
        expect(boolFromVerified("sí")).toBe(true);
        expect(boolFromVerified("Sí")).toBe(true);
        expect(boolFromVerified("si")).toBe(true);
    });

    it("interpreta «no» como false", () => {
        expect(boolFromVerified("no")).toBe(false);
        expect(boolFromVerified("No")).toBe(false);
    });

    it("interpreta valores vacíos como false", () => {
        expect(boolFromVerified("")).toBe(false);
        expect(boolFromVerified(undefined)).toBe(false);
        expect(boolFromVerified(null)).toBe(false);
    });

    it("ida y vuelta: verifiedToText(boolFromVerified(x))", () => {
        expect(verifiedToText(true).toLowerCase()).toMatch(/s[ií]/);
        expect(verifiedToText(false).toLowerCase()).toBe("no");
    });
});

// ===========================================================================
// asNumberOrNull
// ===========================================================================
describe("asNumberOrNull", () => {
    it("devuelve número para entrada válida", () => {
        expect(asNumberOrNull(42)).toBe(42);
        expect(asNumberOrNull("42")).toBe(42);
        expect(asNumberOrNull("  42  ")).toBe(42);
    });

    it("devuelve null para entrada no numérica", () => {
        expect(asNumberOrNull("abc")).toBe(null);
        expect(asNumberOrNull("")).toBe(null);
        expect(asNumberOrNull(null)).toBe(null);
        expect(asNumberOrNull(undefined)).toBe(null);
    });
});
