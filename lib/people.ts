import type { FilterState, Person, RawRow } from "./types";
import {
    asYearOrNull,
    boolFromVerified,
    centuryFromYear,
    getPersonId,
    personPrincipalName,
} from "./data";
import { compareChronologicalPersonCandidates } from "./selection";

export function groupRowsByPerson(rows: RawRow[]): Map<string, RawRow[]> {
    const grouped = new Map<string, RawRow[]>();

    for (const row of rows) {
        const personId = String(getPersonId(row) || "(sin PersonID)");
        const personRows = grouped.get(personId) || [];
        personRows.push(row);
        grouped.set(personId, personRows);
    }

    for (const personRows of grouped.values()) {
        personRows.sort((a, b) => {
            const yearA = asYearOrNull(a?.["Inicio del reinado (año)"]);
            const yearB = asYearOrNull(b?.["Inicio del reinado (año)"]);
            return (yearA ?? 0) - (yearB ?? 0);
        });
    }

    return grouped;
}

export function buildPeople(byPerson: Map<string, RawRow[]>): Person[] {
    const people: Person[] = [];

    for (const [personId, reinados] of byPerson.entries()) {
        const nombres = Array.from(
            new Set(reinados.map((row) => String(row?.Nombre || "").trim()).filter(Boolean))
        );
        const nombrePrincipal = personPrincipalName(reinados);
        const reinos = Array.from(
            new Set(reinados.map((row) => String(row?.Reino || "").trim()).filter(Boolean))
        );
        const apelativos = Array.from(
            new Set(reinados.map((row) => String(row?.Apelativo || row?.apelativo || "").trim()).filter(Boolean))
        );
        const dinastia = String(reinados[0]?.Dinastía || "").trim();
        const verifiedAll = reinados.every((row) =>
            boolFromVerified(row?.["Información verificada"])
        );

        const years = reinados
            .map((row) => asYearOrNull(row?.["Inicio del reinado (año)"]))
            .filter((year): year is number => year !== null);
        const minInicioAnio = years.length ? Math.min(...years) : null;

        const firstRow = reinados[0] || {};
        const birthYear = asYearOrNull(
            firstRow["Nacimiento (Fecha)"] ?? firstRow["Nacimiento (año)"] ?? firstRow["Nacimiento (Año)"] ?? null
        );
        const deathYear = asYearOrNull(
            firstRow["Fallecimiento (Fecha)"] ?? firstRow["Fallecimiento (año)"] ?? firstRow["Fallecimiento (Año)"] ?? null
        );
        const birthRaw = String(
            firstRow["Nacimiento (Fecha)"] ?? firstRow["Nacimiento (año)"] ?? firstRow["Nacimiento (Año)"] ?? ""
        );
        const deathRaw = String(
            firstRow["Fallecimiento (Fecha)"] ?? firstRow["Fallecimiento (año)"] ?? firstRow["Fallecimiento (Año)"] ?? ""
        );
        const age =
            birthYear !== null && deathYear !== null && deathYear > birthYear
                ? deathYear - birthYear
                : null;

        people.push({
            personId,
            nombrePrincipal,
            nombres,
            apelativos,
            reinos,
            dinastia,
            verifiedAll,
            minInicioAnio,
            birthYear,
            deathYear,
            birthRaw,
            deathRaw,
            age,
            reinados,
        });
    }

    return people.sort(compareChronologicalPersonCandidates);
}

export function derivePeopleFromRows(rows: RawRow[]): {
    byPerson: Map<string, RawRow[]>;
    allPeople: Person[];
} {
    const byPerson = groupRowsByPerson(rows);
    return {
        byPerson,
        allPeople: buildPeople(byPerson),
    };
}

export function normalizePersonSearchText(value: unknown): string {
    return String(value ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

export function personMatchesSearch(person: Person, searchText: string): boolean {
    const query = normalizePersonSearchText(searchText);
    if (!query) return true;

    return [
        person.nombrePrincipal,
        ...person.nombres,
        ...person.apelativos,
        ...person.reinos,
        person.dinastia,
    ].some((value) => normalizePersonSearchText(value).includes(query));
}

export function getFirstMatchingPersonId(people: Person[], searchText: string): string | null {
    const query = normalizePersonSearchText(searchText);
    if (!query) return null;

    const person = people.find((candidate) => personMatchesSearch(candidate, query));
    return person ? String(person.personId) : null;
}

export function filterAndSortPeople(allPeople: Person[], filters: FilterState): Person[] {
    let output = [...allPeople];

    if (filters.query) {
        output = output.filter((person) => personMatchesSearch(person, filters.query));
    }

    if (filters.filterReino !== "__all__") {
        output = output.filter((person) => person.reinos.includes(filters.filterReino));
    }

    if (filters.filterDinastia !== "__all__") {
        output = output.filter((person) => person.dinastia === filters.filterDinastia);
    }

    if (filters.filterSiglo !== "__all__") {
        const century = Number.parseInt(filters.filterSiglo, 10);
        if (Number.isFinite(century)) {
            output = output.filter((person) =>
                person.reinados.some((row) => rowSpansCentury(row, century))
            );
        }
    }

    output.sort((a, b) => comparePeopleByFilter(a, b, filters.sortKey, filters.sortDir));
    return output;
}

export function comparePeopleByFilter(a: Person, b: Person, sortKey: string, sortDir: string): number {
    let comparison: number;

    switch (sortKey) {
        case "cronologia": {
            const valueA = a.minInicioAnio ?? 9999;
            const valueB = b.minInicioAnio ?? 9999;
            comparison = valueA - valueB;
            if (comparison === 0) {
                // En empates cronológicos, priorizamos Isabel sobre Fernando en 1474.
                comparison = b.nombrePrincipal.localeCompare(a.nombrePrincipal, "es");
            }
            break;
        }
        case "nombre":
            comparison = a.nombrePrincipal.localeCompare(b.nombrePrincipal, "es");
            break;
        case "dinastia":
            comparison = a.dinastia.localeCompare(b.dinastia, "es");
            break;
        case "reinos":
            comparison = a.reinos.join(",").localeCompare(b.reinos.join(","), "es");
            break;
        case "duracion":
            comparison = totalDuration(a) - totalDuration(b);
            break;
        case "edad":
            comparison = (a.age ?? 0) - (b.age ?? 0);
            break;
        default:
            comparison = 0;
    }

    return sortDir === "desc" ? -comparison : comparison;
}

function totalDuration(person: Person): number {
    return person.reinados.reduce(
        (total, row) => total + (typeof row._duracionCalc === "number" ? row._duracionCalc : 0),
        0
    );
}

export function getPersonFilterOptions(allPeople: Person[], rows: RawRow[]): {
    reinos: string[];
    dinastias: string[];
    siglos: string[];
} {
    const reinos = Array.from(new Set(allPeople.flatMap((person) => person.reinos)))
        .sort((a, b) => a.localeCompare(b, "es"));
    const dinastias = Array.from(new Set(allPeople.map((person) => person.dinastia).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, "es"));
    const siglos = collectCenturiesFromRows(rows).map((century) => String(century));

    return { reinos, dinastias, siglos };
}

export function collectCenturiesFromRows(rows: RawRow[]): number[] {
    const centuries = new Set<number>();

    for (const row of rows) {
        for (const century of rowCenturies(row)) {
            centuries.add(century);
        }
    }

    return Array.from(centuries).sort((a, b) => a - b);
}

export function rowCenturies(row: RawRow): number[] {
    const startYear = asYearOrNull(row?.["Inicio del reinado (año)"]);
    if (startYear === null) return [];

    const endYearRaw = asYearOrNull(row?.["Final del reinado (año)"]);
    const endYear = endYearRaw === null ? startYear : endYearRaw;
    const startCentury = centuryFromYear(startYear);
    const endCentury = centuryFromYear(endYear);
    if (startCentury === null || endCentury === null) return [];

    const from = Math.min(startCentury, endCentury);
    const to = Math.max(startCentury, endCentury);
    const centuries: number[] = [];
    for (let century = from; century <= to; century++) {
        centuries.push(century);
    }
    return centuries;
}

export function rowSpansCentury(row: RawRow, century: number): boolean {
    return rowCenturies(row).includes(century);
}

export function getSelectedCenturies(person: Person | null): number[] {
    if (!person) return [];
    return collectCenturiesFromRows(person.reinados);
}

export function filterRowsForPeople(rows: RawRow[], people: Person[]): RawRow[] {
    const ids = new Set(people.map((person) => String(person.personId)));
    return rows.filter((row) => ids.has(String(getPersonId(row))));
}
