// ---------------------------------------------------------------------------
// AppContext — Estado global compartido vía React Context (R2)
// ---------------------------------------------------------------------------

import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import type { RawRow, Person, Stats, FilterState } from "../lib/types";
import { getPersonId, asYearOrNull, asNumberOrNull, boolFromVerified, centuryFromYear, formatCenturyLabel, rowDisplayName, computeDerivedRow } from "../lib/data";
import { calculateStatsHelper } from "../lib/stats";

interface AppContextData {
    // Datos
    rows: RawRow[];

    // Filtros
    filters: FilterState;
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>;

    // Personas derivadas (no filtradas)
    allPeople: Person[];
    byPerson: Map<string, RawRow[]>;

    // Personas filtradas y ordenadas
    people: Person[];

    // Listas únicas para selectores de filtro
    reinos: string[];
    dinastias: string[];
    siglos: string[];

    // Selección
    selectedPersonId: string | null;
    setSelectedPersonId: (v: string | null) => void;
    selectedPerson: Person | null;

    // Estadísticas
    globalStats: Stats;
    filteredStats: Stats;

    // Siglos seleccionados (para filtro visual)
    selectedCenturies: number[];
}

const AppContext = createContext<AppContextData | null>(null);

export function useAppContext(): AppContextData {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error("useAppContext debe usarse dentro de AppProvider");
    return ctx;
}

interface AppProviderProps {
    rows: RawRow[];
    idbLoaded: boolean;
    datasetLoadedAt: number | null;
    children: React.ReactNode;
}

const DEFAULT_FILTERS: FilterState = {
    query: "",
    filterReino: "__all__",
    filterDinastia: "__all__",
    filterSiglo: "__all__",
    filterDinastiaLocked: false,
    sortKey: "cronologia",
    sortDir: "asc",
};

export function AppProvider({ rows, idbLoaded, datasetLoadedAt, children }: AppProviderProps) {
    const [filters, setFilters] = useState<FilterState>(() => {
        try {
            const stored = localStorage.getItem("reyes_filters");
            if (stored) return JSON.parse(stored);
        } catch (e) {
            console.error("Error reading filters from localStorage:", e);
        }
        return DEFAULT_FILTERS;
    });

    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(() => {
        try {
            return localStorage.getItem("reyes_selected_person") || null;
        } catch (e) {
            return null;
        }
    });

    // Save filters and selectedPersonId to localStorage when they change
    useEffect(() => {
        try {
            localStorage.setItem("reyes_filters", JSON.stringify(filters));
        } catch (e) {
            console.error("Error saving filters to localStorage:", e);
        }
    }, [filters]);

    useEffect(() => {
        try {
            if (selectedPersonId) {
                localStorage.setItem("reyes_selected_person", selectedPersonId);
            } else {
                localStorage.removeItem("reyes_selected_person");
            }
        } catch (e) {
            console.error("Error saving selected person to localStorage:", e);
        }
    }, [selectedPersonId]);

    // --- Agrupar filas por persona ---
    const byPerson = useMemo(() => {
        const m = new Map<string, RawRow[]>();
        for (const r of rows) {
            const pid = String(getPersonId(r) || "(sin PersonID)");
            const arr = m.get(pid) || [];
            arr.push(r);
            m.set(pid, arr);
        }
        for (const arr of m.values()) {
            arr.sort((a, b) => {
                const ya = asYearOrNull(a?.["Inicio del reinado (año)"]);
                const yb = asYearOrNull(b?.["Inicio del reinado (año)"]);
                return (ya ?? 0) - (yb ?? 0);
            });
        }
        return m;
    }, [rows]);

    // --- Derivar lista de personas ---
    const allPeople: Person[] = useMemo(() => {
        const out: Person[] = [];
        for (const [pid, reinados] of byPerson.entries()) {
            const nombres: string[] = Array.from(
                new Set(reinados.map((r) => String(r?.Nombre || "").trim()).filter(Boolean))
            );
            const nombrePrincipal = nombres[0] || "(sin nombre)";
            const reinos: string[] = Array.from(
                new Set(reinados.map((r) => String(r?.Reino || "").trim()).filter(Boolean))
            );
            const apelativos: string[] = Array.from(
                new Set(reinados.map((r) => String(r?.Apelativo || r?.apelativo || "").trim()).filter(Boolean))
            );
            const dinastia = String(reinados[0]?.Dinastía || "").trim();
            const verifiedAll = reinados.every((r) =>
                boolFromVerified(r?.["Información verificada"])
            );

            const years = reinados
                .map((r) => asYearOrNull(r?.["Inicio del reinado (año)"]))
                .filter((y): y is number => y !== null);
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

            out.push({
                personId: pid,
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
        return out;
    }, [byPerson]);

    // --- Filtrar y ordenar ---
    const people: Person[] = useMemo(() => {
        let out = [...allPeople];

        // Filtro de texto
        if (filters.query) {
            const q = filters.query.toLowerCase();
            out = out.filter(
                (p) =>
                    p.nombrePrincipal.toLowerCase().includes(q) ||
                    p.nombres.some((n) => n.toLowerCase().includes(q)) ||
                    p.apelativos.some((a) => a.toLowerCase().includes(q)) ||
                    p.reinos.some((r) => r.toLowerCase().includes(q)) ||
                    p.dinastia.toLowerCase().includes(q)
            );
        }

        // Filtro de reino
        if (filters.filterReino !== "__all__") {
            out = out.filter((p) => p.reinos.includes(filters.filterReino));
        }

        // Filtro de dinastía
        if (filters.filterDinastia !== "__all__") {
            out = out.filter((p) => p.dinastia === filters.filterDinastia);
        }

        // Filtro de siglo
        if (filters.filterSiglo !== "__all__") {
            const c = parseInt(filters.filterSiglo, 10);
            if (Number.isFinite(c)) {
                out = out.filter((p) =>
                    p.reinados.some((r) => {
                        const y = asYearOrNull(r?.["Inicio del reinado (año)"]);
                        return y !== null && centuryFromYear(y) === c;
                    })
                );
            }
        }

        // Ordenar
        out.sort((a, b) => {
            let cmp = 0;
            switch (filters.sortKey) {
                case "cronologia": {
                    const valA = a.minInicioAnio ?? 9999;
                    const valB = b.minInicioAnio ?? 9999;
                    cmp = valA - valB;
                    if (cmp === 0) {
                        // Invertimos el orden alfabético para priorizar nombres como Isabel sobre Fernando
                        // en caso de empate técnico en el año de inicio (ej. 1474).
                        cmp = b.nombrePrincipal.localeCompare(a.nombrePrincipal, "es");
                    }
                    break;
                }
                case "nombre":
                    cmp = a.nombrePrincipal.localeCompare(b.nombrePrincipal, "es");
                    break;
                case "dinastia":
                    cmp = a.dinastia.localeCompare(b.dinastia, "es");
                    break;
                case "reinos":
                    cmp = a.reinos.join(",").localeCompare(b.reinos.join(","), "es");
                    break;
                case "duracion": {
                    const da = a.reinados.reduce((s, r) => s + (typeof r._duracionCalc === 'number' ? r._duracionCalc : 0), 0);
                    const db = b.reinados.reduce((s, r) => s + (typeof r._duracionCalc === 'number' ? r._duracionCalc : 0), 0);
                    cmp = da - db;
                    break;
                }
                case "edad":
                    cmp = (a.age ?? 0) - (b.age ?? 0);
                    break;
                default:
                    cmp = 0;
            }
            return filters.sortDir === "desc" ? -cmp : cmp;
        });

        return out;
    }, [allPeople, filters]);

    // Auto-seleccionar el personaje inicial (cronológicamente más antiguo)
    // Primero: si se acaba de cargar un nuevo dataset explícitamente, resetear filtros e ir al primero
    useEffect(() => {
        if (!datasetLoadedAt || people.length === 0) return;
        setFilters(DEFAULT_FILTERS);
        // Because filters are modified, people will recalculate and might change, so we defer selection
        setTimeout(() => {
            const firstId = String(allPeople[0]?.personId);
            if (firstId) setSelectedPersonId(firstId);
        }, 0);
    }, [datasetLoadedAt]);

    // Segundo: al cargar nuevos datos o si la selección actual no es válida por filtros
    useEffect(() => {
        if (!idbLoaded || people.length === 0) {
            return;
        }

        const personExists = selectedPersonId && people.some(p => String(p.personId) === String(selectedPersonId));

        // Si no hay selección, o la persona actual ya no existe en el listado, seleccionamos la primera.
        if (!selectedPersonId || !personExists) {
            setSelectedPersonId(String(people[0].personId));
        }
    }, [people, selectedPersonId, rows, idbLoaded]);

    // --- Listas para selectores ---
    const reinos = useMemo(
        () => Array.from(new Set(allPeople.flatMap((p) => p.reinos))).sort((a, b) => a.localeCompare(b, "es")),
        [allPeople]
    );
    const dinastias = useMemo(
        () => Array.from(new Set(allPeople.map((p) => p.dinastia).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es")),
        [allPeople]
    );
    const siglos = useMemo(() => {
        const cs = new Set<number>();
        for (const r of rows) {
            const y = asYearOrNull(r?.["Inicio del reinado (año)"]);
            if (y !== null) {
                const c = centuryFromYear(y);
                if (c !== null) cs.add(c);
            }
        }
        return Array.from(cs).sort((a, b) => a - b).map((c) => String(c));
    }, [rows]);

    // --- Selección ---
    const selectedPerson = useMemo(
        () => allPeople.find((p) => String(p.personId) === selectedPersonId) ?? null,
        [allPeople, selectedPersonId]
    );

    // --- Estadísticas ---
    const globalStats = useMemo(
        () => calculateStatsHelper(rows, allPeople),
        [rows, allPeople]
    );

    const filteredRows = useMemo(() => {
        const ids = new Set(people.map((p) => String(p.personId)));
        return rows.filter((r) => ids.has(String(getPersonId(r))));
    }, [rows, people]);

    const filteredStats = useMemo(
        () => calculateStatsHelper(filteredRows, people),
        [filteredRows, people]
    );

    // --- Siglos seleccionados ---
    const selectedCenturies = useMemo(() => {
        if (!selectedPerson) return [];
        const cs = new Set<number>();
        for (const r of selectedPerson.reinados) {
            const y = asYearOrNull(r?.["Inicio del reinado (año)"]);
            if (y !== null) {
                const c = centuryFromYear(y);
                if (c !== null) cs.add(c);
            }
        }
        return Array.from(cs).sort((a, b) => a - b);
    }, [selectedPerson]);

    const value: AppContextData = {
        rows,
        filters,
        setFilters,
        allPeople,
        byPerson,
        people,
        reinos,
        dinastias,
        siglos,
        selectedPersonId,
        setSelectedPersonId,
        selectedPerson,
        globalStats,
        filteredStats,
        selectedCenturies,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
