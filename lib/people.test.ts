import { describe, expect, it } from "vitest";
import {
    buildPeople,
    collectCenturiesFromRows,
    derivePeopleFromRows,
    filterAndSortPeople,
    filterRowsForPeople,
    getFirstMatchingPersonId,
    getPersonFilterOptions,
    getSelectedCenturies,
    groupRowsByPerson,
    personMatchesSearch,
    rowCenturies,
    rowSpansCentury,
} from "./people";
import type { FilterState, RawRow } from "./types";

const DEFAULT_FILTERS: FilterState = {
    query: "",
    filterReino: "__all__",
    filterDinastia: "__all__",
    filterSiglo: "__all__",
    filterDinastiaLocked: false,
    sortKey: "cronologia",
    sortDir: "asc",
};

function rowsFixture(): RawRow[] {
    return [
        {
            ID: "alfonso-leon-1",
            PersonID: "alfonso",
            "Nombre principal": "Alfonso el Pruebas",
            Nombre: "Alfonso",
            Reino: "Reino de León",
            Dinastía: "Astur-Leonesa",
            "Inicio del reinado (año)": 1000,
            "Final del reinado (año)": 1005,
            "Información verificada": "sí",
        },
        {
            ID: "alfonso-castilla",
            PersonID: "alfonso",
            Nombre: "Alfonso",
            Reino: "Reino de Castilla",
            Dinastía: "Astur-Leonesa",
            "Inicio del reinado (año)": 1005,
            "Final del reinado (año)": 1010,
            "Información verificada": "sí",
        },
        {
            ID: "alfonso-leon-2",
            PersonID: "alfonso",
            Nombre: "Alfonso",
            Reino: "Reino de León",
            Dinastía: "Astur-Leonesa",
            "Inicio del reinado (año)": 1012,
            "Final del reinado (año)": 1028,
            "Información verificada": "sí",
        },
        {
            ID: "pelayo",
            PersonID: "pelayo",
            Nombre: "Pelayo",
            Reino: "Reino de Asturias",
            Dinastía: "Astur-Leonesa",
            "Inicio del reinado (año)": "siglo VIII",
            "Final del reinado (año)": 737,
            "Nacimiento (Fecha)": "VII",
            "Fallecimiento (Fecha)": "737",
            "Información verificada": "no",
        },
        {
            ID: "isabel",
            PersonID: "isabel",
            Nombre: "Isabel I",
            Reino: "Corona de Castilla",
            Dinastía: "Trastámara",
            "Inicio del reinado (año)": 1474,
            "Final del reinado (año)": 1504,
            _duracionCalc: 30,
        },
        {
            ID: "fernando",
            PersonID: "fernando",
            Nombre: "Fernando V",
            Reino: "Corona de Castilla",
            Dinastía: "Trastámara",
            "Inicio del reinado (año)": 1474,
            "Final del reinado (año)": 1516,
            _duracionCalc: 42,
        },
    ];
}

describe("groupRowsByPerson", () => {
    it("agrupa por PersonID y conserva periodos discontinuos del mismo reino", () => {
        const grouped = groupRowsByPerson(rowsFixture());
        const alfonsoRows = grouped.get("alfonso") ?? [];

        expect(alfonsoRows.map((row) => row.ID)).toEqual([
            "alfonso-leon-1",
            "alfonso-castilla",
            "alfonso-leon-2",
        ]);
        expect(alfonsoRows.map((row) => row.Reino)).toEqual([
            "Reino de León",
            "Reino de Castilla",
            "Reino de León",
        ]);
    });
});

describe("buildPeople", () => {
    it("construye personas con nombre principal, reinos únicos y reinados íntegros", () => {
        const people = buildPeople(groupRowsByPerson(rowsFixture()));
        const alfonso = people.find((person) => person.personId === "alfonso");

        expect(alfonso).toMatchObject({
            nombrePrincipal: "Alfonso el Pruebas",
            reinos: ["Reino de León", "Reino de Castilla"],
            dinastia: "Astur-Leonesa",
            verifiedAll: true,
            minInicioAnio: 1000,
        });
        expect(alfonso?.reinados.map((row) => row.ID)).toEqual([
            "alfonso-leon-1",
            "alfonso-castilla",
            "alfonso-leon-2",
        ]);
    });

    it("calcula edad a partir del primer reinado cronológico", () => {
        const people = buildPeople(groupRowsByPerson(rowsFixture()));
        const pelayo = people.find((person) => person.personId === "pelayo");

        expect(pelayo).toMatchObject({
            birthYear: 650,
            deathYear: 737,
            age: 87,
        });
    });
});

describe("filterAndSortPeople", () => {
    it("filtra por reino aunque una persona tenga varios reinos", () => {
        const { allPeople } = derivePeopleFromRows(rowsFixture());
        const people = filterAndSortPeople(allPeople, {
            ...DEFAULT_FILTERS,
            filterReino: "Reino de Castilla",
        });

        expect(people.map((person) => person.personId)).toContain("alfonso");
    });

    it("filtra por siglo usando años inferidos", () => {
        const { allPeople } = derivePeopleFromRows(rowsFixture());
        const people = filterAndSortPeople(allPeople, {
            ...DEFAULT_FILTERS,
            filterSiglo: "8",
        });

        expect(people.map((person) => person.personId)).toEqual(["pelayo"]);
    });

    it("filtra por siglo cuando el reinado cruza de siglo", () => {
        const { allPeople } = derivePeopleFromRows(rowsFixture());
        const people = filterAndSortPeople(allPeople, {
            ...DEFAULT_FILTERS,
            filterSiglo: "16",
        });

        expect(people.map((person) => person.personId)).toEqual(["isabel", "fernando"]);
    });

    it("ordena empates cronológicos priorizando Isabel sobre Fernando en 1474", () => {
        const { allPeople } = derivePeopleFromRows(rowsFixture());
        const people = filterAndSortPeople(allPeople, {
            ...DEFAULT_FILTERS,
            filterReino: "Corona de Castilla",
            sortKey: "cronologia",
            sortDir: "asc",
        });

        expect(people.map((person) => person.personId)).toEqual(["isabel", "fernando"]);
    });

    it("ordena por duración acumulada sin fusionar reinados", () => {
        const { allPeople } = derivePeopleFromRows(rowsFixture());
        const people = filterAndSortPeople(allPeople, {
            ...DEFAULT_FILTERS,
            sortKey: "duracion",
            sortDir: "desc",
        });

        expect(people[0]?.personId).toBe("fernando");
    });

    it("busca sin depender de tildes ni mayúsculas", () => {
        const { allPeople } = derivePeopleFromRows(rowsFixture());
        const people = filterAndSortPeople(allPeople, {
            ...DEFAULT_FILTERS,
            query: "leon",
        });

        expect(people.map((person) => person.personId)).toContain("alfonso");
    });

    it("localiza el primer personaje visible que coincide con la búsqueda", () => {
        const { allPeople } = derivePeopleFromRows(rowsFixture());
        const people = filterAndSortPeople(allPeople, {
            ...DEFAULT_FILTERS,
            query: "trastamara",
        });

        expect(getFirstMatchingPersonId(people, "trastamara")).toBe("isabel");
        expect(getFirstMatchingPersonId(people, "")).toBeNull();
        expect(personMatchesSearch(people[0], "corona")).toBe(true);
    });
});

describe("opciones y filas derivadas", () => {
    it("calcula opciones de filtros ordenadas", () => {
        const rows = rowsFixture();
        const { allPeople } = derivePeopleFromRows(rows);

        expect(getPersonFilterOptions(allPeople, rows)).toMatchObject({
            dinastias: ["Astur-Leonesa", "Trastámara"],
            siglos: ["8", "10", "11", "15", "16"],
        });
    });

    it("calcula siglos seleccionados de todos los reinados de una persona", () => {
        const { allPeople } = derivePeopleFromRows(rowsFixture());
        const alfonso = allPeople.find((person) => person.personId === "alfonso") ?? null;

        expect(getSelectedCenturies(alfonso)).toEqual([10, 11]);
        expect(getSelectedCenturies(null)).toEqual([]);
    });

    it("filtra filas por las personas visibles", () => {
        const rows = rowsFixture();
        const { allPeople } = derivePeopleFromRows(rows);
        const people = filterAndSortPeople(allPeople, {
            ...DEFAULT_FILTERS,
            filterReino: "Reino de Asturias",
        });

        expect(filterRowsForPeople(rows, people).map((row) => row.ID)).toEqual(["pelayo"]);
    });

    it("recoge siglos inferidos y exactos sin duplicados", () => {
        expect(collectCenturiesFromRows(rowsFixture())).toEqual([8, 10, 11, 15, 16]);
    });

    it("calcula siglos por tramo completo de fila", () => {
        const row: RawRow = {
            "Inicio del reinado (año)": 1474,
            "Final del reinado (año)": 1516,
        };

        expect(rowCenturies(row)).toEqual([15, 16]);
        expect(rowSpansCentury(row, 16)).toBe(true);
        expect(rowSpansCentury(row, 17)).toBe(false);
    });
});
