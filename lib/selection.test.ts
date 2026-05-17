// ---------------------------------------------------------------------------
// Tests unitarios: lib/selection.ts
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
    getAdjacentPersonIds,
    getChronologicalDefaultPersonId,
    personIdExists,
    resolveRouteSelectedPersonId,
    resolveSelectedPersonId,
    resolveStartupAwareRouteSelectedPersonId,
} from "./selection";

describe("resolveSelectedPersonId", () => {
    it("mantiene la selección si existe en el dataset completo", () => {
        expect(resolveSelectedPersonId("102", ["101", "102", "103"])).toBe("102");
    });

    it("elige el primer personaje disponible si la selección falta", () => {
        expect(resolveSelectedPersonId(null, ["101", "102"])).toBe("101");
        expect(resolveSelectedPersonId("999", ["101", "102"])).toBe("101");
    });

    it("devuelve null si no hay personajes disponibles", () => {
        expect(resolveSelectedPersonId("102", [])).toBeNull();
    });
});

describe("personIdExists", () => {
    it("comprueba identificadores normalizados como texto", () => {
        expect(personIdExists("102", [101, 102])).toBe(true);
        expect(personIdExists("999", [101, 102])).toBe(false);
    });
});

describe("resolveRouteSelectedPersonId", () => {
    it("da prioridad a la ruta si apunta a un personaje existente", () => {
        expect(resolveRouteSelectedPersonId("103", "102", ["101", "102", "103"])).toBe("103");
    });

    it("conserva la selección actual si la ruta no corresponde al dataset", () => {
        expect(resolveRouteSelectedPersonId("999", "102", ["101", "102", "103"])).toBe("102");
    });
});

describe("resolveStartupAwareRouteSelectedPersonId", () => {
    it("ignora una ruta previa en el primer arranque y usa el primer personaje cronológico disponible", () => {
        expect(resolveStartupAwareRouteSelectedPersonId("51", null, ["101", "51"])).toBe("101");
    });

    it("respeta la ruta cuando ya existe una selección activa", () => {
        expect(resolveStartupAwareRouteSelectedPersonId("51", "101", ["101", "51"])).toBe("51");
    });
});

describe("getChronologicalDefaultPersonId", () => {
    it("elige el personaje con inicio cronológico más antiguo", () => {
        expect(
            getChronologicalDefaultPersonId([
                { personId: 51, nombrePrincipal: "Fernando V", minInicioAnio: 1479 },
                { personId: 101, nombrePrincipal: "Pelayo", minInicioAnio: 718 },
            ])
        ).toBe("101");
    });

    it("desempata por nombre si el año coincide", () => {
        expect(
            getChronologicalDefaultPersonId([
                { personId: 2, nombrePrincipal: "B", minInicioAnio: 1000 },
                { personId: 1, nombrePrincipal: "A", minInicioAnio: 1000 },
            ])
        ).toBe("1");
    });
});

describe("getAdjacentPersonIds", () => {
    const people = [
        { personId: 101, nombrePrincipal: "Pelayo", minInicioAnio: 718 },
        { personId: 102, nombrePrincipal: "Fávila", minInicioAnio: 737 },
        { personId: 103, nombrePrincipal: "Alfonso I", minInicioAnio: 739 },
    ];

    it("devuelve predecesor y sucesor en el orden recibido", () => {
        expect(getAdjacentPersonIds(people, "102")).toEqual({
            predecessorId: "101",
            successorId: "103",
        });
    });

    it("devuelve null en los extremos", () => {
        expect(getAdjacentPersonIds(people, "101")).toEqual({
            predecessorId: null,
            successorId: "102",
        });
        expect(getAdjacentPersonIds(people, "103")).toEqual({
            predecessorId: "102",
            successorId: null,
        });
    });
});
