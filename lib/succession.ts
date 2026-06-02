import { asYearOrNull, looksLikeUrlText, rowDisplayName } from "./data";
import type { Person, RawRow } from "./types";

export type SuccessionSource = "chronological" | "manual" | "none";

export interface SuccessionPersonRef {
    personId: string;
    nombrePrincipal: string;
    nombreReinado: string;
}

export interface GovernmentSuccession {
    rowId: string;
    reino: string;
    predecessor: SuccessionPersonRef | null;
    successor: SuccessionPersonRef | null;
    predecessorSource: SuccessionSource;
    successorSource: SuccessionSource;
}

interface GovernmentNode {
    person: Person;
    personId: string;
    row: RawRow;
    rowId: string;
    reino: string;
    kingdomKey: string;
    startYear: number | null;
    endYear: number | null;
    order: number;
}

function normalizeSuccessionText(value: unknown): string {
    return String(value ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function rowIdForSuccession(row: RawRow, fallbackIndex: number): string {
    return String(row?._rowId ?? row?.ID ?? `row-${fallbackIndex + 1}`);
}

function toSuccessionRef(node: GovernmentNode): SuccessionPersonRef {
    return {
        personId: node.personId,
        nombrePrincipal: node.person.nombrePrincipal,
        nombreReinado: rowSuccessionName(node.row),
    };
}

function rowSuccessionName(row: RawRow): string {
    const nombre = String(row?.Nombre ?? row?.nombre ?? "").trim();
    return nombre && !looksLikeUrlText(nombre) ? nombre : rowDisplayName(row);
}

function findPersonReignName(person: Person, kingdomKey: string): string {
    const sameKingdomRow = person.reinados.find(
        (row) => normalizeSuccessionText(row?.Reino) === kingdomKey
    );
    return rowSuccessionName(sameKingdomRow ?? person.reinados[0] ?? {});
}

function personToSuccessionRef(person: Person, kingdomKey: string): SuccessionPersonRef {
    return {
        personId: String(person.personId),
        nombrePrincipal: person.nombrePrincipal,
        nombreReinado: findPersonReignName(person, kingdomKey),
    };
}

function compareGovernmentNodes(a: GovernmentNode, b: GovernmentNode): number {
    const startA = a.startYear ?? 9999;
    const startB = b.startYear ?? 9999;
    if (startA !== startB) return startA - startB;

    const endA = a.endYear ?? 9999;
    const endB = b.endYear ?? 9999;
    if (endA !== endB) return endA - endB;

    const byName = rowDisplayName(a.row).localeCompare(rowDisplayName(b.row), "es");
    if (byName !== 0) return byName;

    return a.order - b.order;
}

function resolveManualSuccessionRef(
    rawPersonId: unknown,
    peopleById: Map<string, Person>,
    kingdomKey: string
): SuccessionPersonRef | null {
    const personId = String(rawPersonId ?? "").trim();
    if (!personId) return null;

    const person = peopleById.get(personId);
    return person ? personToSuccessionRef(person, kingdomKey) : null;
}

export function buildGovernmentSuccession(people: Person[]): Map<string, GovernmentSuccession> {
    const peopleById = new Map(people.map((person) => [String(person.personId), person]));
    const nodes: GovernmentNode[] = [];
    let order = 0;

    for (const person of people) {
        for (const row of person.reinados) {
            const rowId = rowIdForSuccession(row, order);
            const reino = String(row?.Reino ?? "").trim();
            nodes.push({
                person,
                personId: String(person.personId),
                row,
                rowId,
                reino,
                kingdomKey: normalizeSuccessionText(reino),
                startYear: asYearOrNull(row?.["Inicio del reinado (año)"]),
                endYear: asYearOrNull(row?.["Final del reinado (año)"]),
                order,
            });
            order += 1;
        }
    }

    const nodesByKingdom = new Map<string, GovernmentNode[]>();
    for (const node of nodes) {
        if (!node.kingdomKey) continue;
        const group = nodesByKingdom.get(node.kingdomKey) ?? [];
        group.push(node);
        nodesByKingdom.set(node.kingdomKey, group);
    }

    const automaticByRowId = new Map<string, Pick<GovernmentSuccession, "predecessor" | "successor">>();
    for (const group of nodesByKingdom.values()) {
        const sorted = [...group].sort(compareGovernmentNodes);
        sorted.forEach((node, index) => {
            automaticByRowId.set(node.rowId, {
                predecessor: index > 0 ? toSuccessionRef(sorted[index - 1]) : null,
                successor: index < sorted.length - 1 ? toSuccessionRef(sorted[index + 1]) : null,
            });
        });
    }

    const output = new Map<string, GovernmentSuccession>();
    for (const node of nodes) {
        const automatic = automaticByRowId.get(node.rowId) ?? { predecessor: null, successor: null };
        const manualPredecessor = resolveManualSuccessionRef(node.row?.Predecesor, peopleById, node.kingdomKey);
        const manualSuccessor = resolveManualSuccessionRef(node.row?.Sucesor, peopleById, node.kingdomKey);
        const predecessor = manualPredecessor ?? automatic.predecessor;
        const successor = manualSuccessor ?? automatic.successor;

        output.set(node.rowId, {
            rowId: node.rowId,
            reino: node.reino,
            predecessor,
            successor,
            predecessorSource: manualPredecessor ? "manual" : predecessor ? "chronological" : "none",
            successorSource: manualSuccessor ? "manual" : successor ? "chronological" : "none",
        });
    }

    return output;
}
