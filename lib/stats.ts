// ---------------------------------------------------------------------------
// Cálculo de estadísticas — extraído de App.tsx
// ---------------------------------------------------------------------------

import type {
    RawRow,
    Person,
    Stats,
    DurationEntry,
    AgeEntry,
    CountEntry,
    DurationByEntityEntry,
    CenturyEntry,
} from "./types";
import {
    asYearOrNull,
    asNumberOrNull,
    centuryFromYear,
    formatCenturyLabel,
    rowDisplayName,
    getPersonId,
} from "./data";

/**
 * Calcula el bloque completo de estadísticas a partir de las filas
 * y la lista de personas ya agrupadas.
 */
export function calculateStatsHelper(
    inputRows: RawRow[],
    inputPeople: Person[]
): Stats {
    try {
        const totalFilas = inputRows.length;
        const totalMonarcas = inputPeople.length;
        const verifiedMonarcas = inputPeople.filter((p) => p.verifiedAll).length;

        const durations = inputRows
            .map((r) => r._duracionCalc)
            .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
        durations.sort((a, b) => a - b);
        const sum = durations.reduce((acc, n) => acc + n, 0);
        const mean = durations.length ? sum / durations.length : null;

        // --- Dinastías ---
        const byDinastiaMap = new Map<string, number>();
        for (const p of inputPeople) {
            const k = String(p.dinastia || "sin dinastía").trim() || "sin dinastía";
            byDinastiaMap.set(k, (byDinastiaMap.get(k) || 0) + 1);
        }
        const byDinastia: CountEntry[] = Array.from(byDinastiaMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));

        // --- Tipos de Gobierno y Entidades ---
        const byTipoMap = new Map<string, number>();
        const byEntityMap = new Map<string, number>();
        const byEntityDurationMap = new Map<string, number>();

        for (const r of inputRows) {
            const k =
                String(r?.["Tipo de gobierno"] || "sin tipo").trim() || "sin tipo";
            const reino = String(r?.Reino || "sin reino").trim() || "sin reino";

            byTipoMap.set(k, (byTipoMap.get(k) || 0) + 1);
            byEntityMap.set(reino, (byEntityMap.get(reino) || 0) + 1);

            const dur =
                typeof r._duracionCalc === "number" && Number.isFinite(r._duracionCalc)
                    ? r._duracionCalc
                    : 0;
            byEntityDurationMap.set(
                reino,
                (byEntityDurationMap.get(reino) || 0) + dur
            );
        }

        const byTipoGobierno: CountEntry[] = Array.from(byTipoMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));

        const byEntity: CountEntry[] = Array.from(byEntityMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));

        const byEntityDuration: DurationByEntityEntry[] = Array.from(
            byEntityDurationMap.entries()
        )
            .map(([name, years]) => ({ name, years }))
            .sort((a, b) => b.years - a.years || a.name.localeCompare(b.name, "es"));

        // --- Duraciones de gobierno individuales ---
        const durationRows: DurationEntry[] = inputRows
            .map((r) => {
                const y = r?._duracionCalc;
                if (!(typeof y === "number" && Number.isFinite(y))) return null;
                const nombre = rowDisplayName(r);
                const reino = String(r?.Reino ?? "").trim();
                const inicio = asYearOrNull(r?.["Inicio del reinado (año)"]);
                const fin = asYearOrNull(r?.["Final del reinado (año)"]);
                const rango =
                    inicio !== null || fin !== null
                        ? `${inicio ?? "—"}–${fin ?? "—"}`
                        : "";
                const base =
                    [nombre, reino].filter(Boolean).join(" · ") || "(sin etiqueta)";
                const label = rango ? `${base} (${rango})` : base;
                return { label, years: y, personId: String(getPersonId(r) || "") };
            })
            .filter((x): x is DurationEntry => x !== null);

        const topLongestReign = [...durationRows]
            .sort((a, b) => b.years - a.years)
            .slice(0, 10);
        const topShortestReign = [...durationRows]
            .sort((a, b) => a.years - b.years)
            .slice(0, 10);

        // --- Edad ---
        const ageData: AgeEntry[] = inputPeople
            .map((p) => {
                if (typeof p.age === "number" && p.age > 0) {
                    const isApprox =
                        isNaN(Number(p.birthRaw)) || isNaN(Number(p.deathRaw));
                    return {
                        label: `${p.nombrePrincipal} (${p.birthYear}-${p.deathYear})`,
                        age: p.age,
                        isApprox,
                        personId: String(p.personId),
                    };
                }
                return null;
            })
            .filter((x): x is AgeEntry => x !== null);

        const topOldestMonarch = [...ageData]
            .sort((a, b) => b.age - a.age)
            .slice(0, 10);
        const topYoungestMonarch = [...ageData]
            .sort((a, b) => a.age - b.age)
            .slice(0, 10);

        // --- Personajes por siglo ---
        const perCentury: CenturyEntry[] = (() => {
            const MIN_C = 8;
            const MAX_C = 21;
            const m = new Map<number, Set<string>>();

            for (const r of inputRows) {
                const pid = String(getPersonId(r) || "(sin PersonID)");
                const yStart = asYearOrNull(r?.["Inicio del reinado (año)"]);
                if (yStart === null) continue;

                const yEndRaw = asYearOrNull(r?.["Final del reinado (año)"]);
                const yEnd = yEndRaw === null ? yStart : yEndRaw;

                const cStart = centuryFromYear(yStart);
                const cEnd = centuryFromYear(yEnd);
                if (cStart === null || cEnd === null) continue;

                const from = Math.min(cStart, cEnd);
                const to = Math.max(cStart, cEnd);

                for (let c = from; c <= to; c++) {
                    if (c < MIN_C || c > MAX_C) continue;
                    const set = m.get(c) || new Set<string>();
                    set.add(pid);
                    m.set(c, set);
                }
            }

            const out: CenturyEntry[] = [];
            for (let c = MIN_C; c <= MAX_C; c++) {
                const set = m.get(c);
                out.push({
                    c,
                    century: formatCenturyLabel(c),
                    count: set ? set.size : 0,
                });
            }
            return out;
        })();

        return {
            totalFilas,
            totalMonarcas,
            verifiedMonarcas,
            mean,
            byDinastia,
            byTipoGobierno,
            byEntity,
            byEntityDuration,
            topLongestReign,
            topShortestReign,
            topOldestMonarch,
            topYoungestMonarch,
            perCentury,
        };
    } catch (e) {
        console.error("Error calculando estadísticas:", e);
        return {
            totalFilas: 0,
            totalMonarcas: 0,
            verifiedMonarcas: 0,
            mean: 0,
            byDinastia: [],
            byTipoGobierno: [],
            byEntity: [],
            byEntityDuration: [],
            topLongestReign: [],
            topShortestReign: [],
            topOldestMonarch: [],
            topYoungestMonarch: [],
            perCentury: [],
        };
    }
}
