import type { FilterState, Person, RawRow } from "./types";
import {
    asYearOrNull,
    boolFromVerified,
    centuryFromYear,
    getPersonId,
    personPrincipalName,
} from "./data";
import { normalizeSearchText, personMatchesAdvancedSearch } from "./person-search";
import { compareChronologicalPersonCandidates } from "./selection";

export type PersonDinastiaSummaryKind = "empty" | "single" | "conflict";

export interface PersonDinastiaSummary {
    kind: PersonDinastiaSummaryKind;
    label: string;
    values: string[];
}

function uniqueTrimmedValues(values: unknown[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];

    for (const value of values) {
        const text = String(value ?? "").trim();
        const key = normalizeSearchText(text);
        if (!text || seen.has(key)) continue;
        seen.add(key);
        output.push(text);
    }

    return output;
}

function rowDinastia(row: RawRow): string {
    return String(row?.Dinastía ?? "").trim();
}

export function personHasDinastia(person: Pick<Person, "dinastias" | "reinados">, dinastia: string): boolean {
    const key = normalizeSearchText(dinastia);
    if (!key) return false;
    return person.reinados.some((row) => normalizeSearchText(rowDinastia(row)) === key);
}

export function personDinastiaSummary(person: Pick<Person, "dinastias" | "reinados">): PersonDinastiaSummary {
    const values = person.dinastias.length ? person.dinastias : uniqueTrimmedValues(person.reinados.map(rowDinastia));

    if (values.length === 0) {
        return { kind: "empty", label: "sin dinastía", values };
    }

    if (values.length === 1) {
        return { kind: "single", label: values[0], values };
    }

    return { kind: "conflict", label: "Dinastía incoherente en sus gobiernos", values };
}

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
        const dinastias = uniqueTrimmedValues(reinados.map(rowDinastia));
        const dinastia = dinastias[0] ?? "";
        const hasDinastiaConflict = dinastias.length > 1;
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
            dinastias,
            hasDinastiaConflict,
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
    return normalizeSearchText(value);
}

export function personMatchesSearch(person: Person, searchText: string): boolean {
    return personMatchesAdvancedSearch(person, searchText);
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
        output = output.filter((person) => personHasDinastia(person, filters.filterDinastia));
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
            comparison = a.dinastias.join(",").localeCompare(b.dinastias.join(","), "es");
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
    const dinastias = uniqueTrimmedValues(rows.map(rowDinastia))
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
