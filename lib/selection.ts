// ---------------------------------------------------------------------------
// Reglas puras de selección de personajes.
// ---------------------------------------------------------------------------

export function resolveSelectedPersonId(
    currentId: string | null | undefined,
    availableIds: Array<string | number>
): string | null {
    const ids = availableIds.map((id) => String(id));
    if (!ids.length) return null;

    const normalizedCurrentId = currentId ? String(currentId) : "";
    if (normalizedCurrentId && ids.includes(normalizedCurrentId)) {
        return normalizedCurrentId;
    }

    return ids[0];
}

export interface ChronologicalPersonCandidate {
    personId: string | number;
    minInicioAnio?: number | null;
    nombrePrincipal?: string;
}

export function compareChronologicalPersonCandidates(
    a: ChronologicalPersonCandidate,
    b: ChronologicalPersonCandidate
): number {
    const valA = a.minInicioAnio ?? 9999;
    const valB = b.minInicioAnio ?? 9999;
    const byYear = valA - valB;
    if (byYear !== 0) return byYear;
    return String(a.nombrePrincipal ?? "").localeCompare(String(b.nombrePrincipal ?? ""), "es");
}

export function getChronologicalDefaultPersonId(
    people: ChronologicalPersonCandidate[]
): string {
    const first = [...people].sort(compareChronologicalPersonCandidates)[0];
    return first ? String(first.personId) : "";
}

export function getAdjacentPersonIds(
    people: ChronologicalPersonCandidate[],
    currentId: string | number | null | undefined
): { predecessorId: string | null; successorId: string | null } {
    const normalizedCurrentId = String(currentId ?? "");
    if (!normalizedCurrentId) return { predecessorId: null, successorId: null };

    const ids = people.map((person) => String(person.personId));
    const index = ids.indexOf(normalizedCurrentId);
    if (index < 0) return { predecessorId: null, successorId: null };

    return {
        predecessorId: index > 0 ? ids[index - 1] : null,
        successorId: index < ids.length - 1 ? ids[index + 1] : null,
    };
}

export function personIdExists(
    personId: string | null | undefined,
    availableIds: Array<string | number>
): boolean {
    if (!personId) return false;
    const normalizedPersonId = String(personId);
    return availableIds.some((id) => String(id) === normalizedPersonId);
}

export function resolveRouteSelectedPersonId(
    routePersonId: string | null | undefined,
    currentId: string | null | undefined,
    availableIds: Array<string | number>
): string | null {
    if (routePersonId && personIdExists(routePersonId, availableIds)) {
        return String(routePersonId);
    }

    return resolveSelectedPersonId(currentId, availableIds);
}

export function resolveStartupAwareRouteSelectedPersonId(
    routePersonId: string | null | undefined,
    currentId: string | null | undefined,
    availableIds: Array<string | number>
): string | null {
    if (!currentId) {
        return resolveSelectedPersonId(null, availableIds);
    }

    return resolveRouteSelectedPersonId(routePersonId, currentId, availableIds);
}
