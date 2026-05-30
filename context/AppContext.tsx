// ---------------------------------------------------------------------------
// AppContext — Estado global compartido vía React Context (R2)
// ---------------------------------------------------------------------------

import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from "react";
import type { RawRow, Person, Stats, FilterState } from "../lib/types";
import {
    getPreferredStartupPersonId,
    resolveSelectedPersonId,
} from "../lib/selection";
import { calculateStatsHelper } from "../lib/stats";
import {
    derivePeopleFromRows,
    filterAndSortPeople,
    filterRowsForPeople,
    getPersonFilterOptions,
    getSelectedCenturies,
} from "../lib/people";

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

    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const handledDatasetLoadedAtRef = useRef<number | null>(null);

    // Save filters and selectedPersonId to localStorage when they change
    useEffect(() => {
        try {
            localStorage.setItem("reyes_filters", JSON.stringify(filters));
        } catch (e) {
            console.error("Error saving filters to localStorage:", e);
        }
    }, [filters]);

    const { byPerson, allPeople } = useMemo(() => derivePeopleFromRows(rows), [rows]);

    // --- Filtrar y ordenar ---
    const people: Person[] = useMemo(() => filterAndSortPeople(allPeople, filters), [allPeople, filters]);

    const startupPersonId = useMemo(() => getPreferredStartupPersonId(allPeople), [allPeople]);

    // Auto-seleccionar el personaje inicial preferente.
    // Primero: si se acaba de cargar un nuevo dataset explícitamente, resetear filtros e ir al inicio.
    useEffect(() => {
        if (!datasetLoadedAt || !startupPersonId || handledDatasetLoadedAtRef.current === datasetLoadedAt) return;
        handledDatasetLoadedAtRef.current = datasetLoadedAt;
        setFilters(DEFAULT_FILTERS);
        setSelectedPersonId(startupPersonId);
    }, [datasetLoadedAt, startupPersonId]);

    // Segundo: al cargar nuevos datos o si la selección actual no es válida por filtros
    useEffect(() => {
        if (!idbLoaded) {
            return;
        }

        const nextSelectedPersonId = resolveSelectedPersonId(
            selectedPersonId,
            allPeople.map((person) => person.personId)
        );

        // Si no hay selección, o la persona actual ya no existe en el dataset, seleccionamos la primera.
        if (nextSelectedPersonId !== selectedPersonId) {
            setSelectedPersonId(nextSelectedPersonId);
        }
    }, [allPeople, selectedPersonId, idbLoaded]);

    // --- Listas para selectores ---
    const { reinos, dinastias, siglos } = useMemo(
        () => getPersonFilterOptions(allPeople, rows),
        [allPeople, rows]
    );

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

    const filteredRows = useMemo(() => filterRowsForPeople(rows, people), [rows, people]);

    const filteredStats = useMemo(
        () => calculateStatsHelper(filteredRows, people),
        [filteredRows, people]
    );

    // --- Siglos seleccionados ---
    const selectedCenturies = useMemo(() => getSelectedCenturies(selectedPerson), [selectedPerson]);

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
