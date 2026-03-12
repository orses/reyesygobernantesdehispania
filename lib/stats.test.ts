// ---------------------------------------------------------------------------
// Tests unitarios — lib/stats.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { calculateStatsHelper } from "./stats";
import { computeDerivedRow, getRowId } from "./data";
import type { RawRow, Person, Stats } from "./types";

function makeRow(overrides: Partial<RawRow>, idx: number): RawRow {
    const base: RawRow = {
        ID: `test-${idx}`,
        PersonID: idx,
        Nombre: `Monarca ${idx}`,
        Reino: "Castilla",
        Dinastía: "Test",
        "Tipo de gobierno": "Monarquía",
        "Inicio del reinado (año)": 1400 + idx * 10,
        "Final del reinado (año)": 1410 + idx * 10,
        "Información verificada": "sí",
        ...overrides,
    };
    return { ...computeDerivedRow(base), _rowId: getRowId(base, idx) };
}

function makePerson(rows: RawRow[], idx: number): Person {
    return {
        personId: idx,
        nombrePrincipal: String(rows[0]?.Nombre || "Test"),
        nombres: [String(rows[0]?.Nombre || "Test")],
        apelativos: [],
        reinos: ["Castilla"],
        dinastia: "Test",
        verifiedAll: true,
        minInicioAnio: 1400 + idx * 10,
        birthYear: 1380 + idx * 10,
        deathYear: 1420 + idx * 10,
        birthRaw: String(1380 + idx * 10),
        deathRaw: String(1420 + idx * 10),
        age: 40,
        reinados: rows,
    };
}

describe("calculateStatsHelper", () => {
    it("devuelve estadísticas vacías para arrays vacíos", () => {
        const stats = calculateStatsHelper([], []);
        expect(stats.totalFilas).toBe(0);
        expect(stats.totalMonarcas).toBe(0);
        expect(stats.verifiedMonarcas).toBe(0);
        expect(stats.mean).toBe(null);
        expect(stats.byDinastia).toEqual([]);
    });

    it("calcula correctamente totalFilas y totalMonarcas", () => {
        const r1 = makeRow({}, 0);
        const r2 = makeRow({}, 1);
        const p1 = makePerson([r1], 0);
        const p2 = makePerson([r2], 1);

        const stats = calculateStatsHelper([r1, r2], [p1, p2]);
        expect(stats.totalFilas).toBe(2);
        expect(stats.totalMonarcas).toBe(2);
    });

    it("calcula la duración media", () => {
        const r1 = makeRow({ "Inicio del reinado (año)": 1400, "Final del reinado (año)": 1410 }, 0);
        const r2 = makeRow({ "Inicio del reinado (año)": 1420, "Final del reinado (año)": 1450 }, 1);
        const p1 = makePerson([r1], 0);
        const p2 = makePerson([r2], 1);

        const stats = calculateStatsHelper([r1, r2], [p1, p2]);
        // Duración: 10 y 30 → media = 20
        expect(stats.mean).toBe(20);
    });

    it("genera las listas de top reinados", () => {
        const rows = Array.from({ length: 15 }, (_, i) =>
            makeRow({ "Inicio del reinado (año)": 1400, "Final del reinado (año)": 1400 + (i + 1) * 2 }, i)
        );
        const people = rows.map((r, i) => makePerson([r], i));

        const stats = calculateStatsHelper(rows, people);
        expect(stats.topLongestReign.length).toBeLessThanOrEqual(10);
        expect(stats.topShortestReign.length).toBeLessThanOrEqual(10);
        // El más largo debe tener duración mayor que el más corto
        if (stats.topLongestReign.length > 0 && stats.topShortestReign.length > 0) {
            expect(stats.topLongestReign[0].years).toBeGreaterThanOrEqual(
                stats.topShortestReign[0].years
            );
        }
    });

    it("cuenta monarcas verificados", () => {
        const r1 = makeRow({ "Información verificada": "sí" }, 0);
        const r2 = makeRow({ "Información verificada": "no" }, 1);
        const p1 = makePerson([r1], 0);
        const p2: Person = { ...makePerson([r2], 1), verifiedAll: false };

        const stats = calculateStatsHelper([r1, r2], [p1, p2]);
        expect(stats.verifiedMonarcas).toBe(1);
    });

    it("agrupa por dinastía", () => {
        const r1 = makeRow({ Dinastía: "Habsburgo" }, 0);
        const r2 = makeRow({ Dinastía: "Borbón" }, 1);
        const r3 = makeRow({ Dinastía: "Habsburgo" }, 2);
        const p1: Person = { ...makePerson([r1], 0), dinastia: "Habsburgo" };
        const p2: Person = { ...makePerson([r2], 1), dinastia: "Borbón" };
        const p3: Person = { ...makePerson([r3], 2), dinastia: "Habsburgo" };

        const stats = calculateStatsHelper([r1, r2, r3], [p1, p2, p3]);
        const hab = stats.byDinastia.find((d) => d.name === "Habsburgo");
        expect(hab?.count).toBe(2);
    });

    it("genera datos por siglo", () => {
        const r1 = makeRow({ "Inicio del reinado (año)": 1479, "Final del reinado (año)": 1516 }, 0);
        const p1 = makePerson([r1], 0);

        const stats = calculateStatsHelper([r1], [p1]);
        expect(stats.perCentury.length).toBeGreaterThan(0);
        const s15 = stats.perCentury.find((c) => c.c === 15);
        const s16 = stats.perCentury.find((c) => c.c === 16);
        // Fernando V reinó del siglo XV al XVI
        expect(s15?.count).toBeGreaterThanOrEqual(1);
        expect(s16?.count).toBeGreaterThanOrEqual(1);
    });
});
