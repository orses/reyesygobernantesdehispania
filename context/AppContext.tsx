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
    DEFAULT_FILTERS,
    hasActiveDatasetFilters,
    normalizeStoredFilters,
} from "../lib/filters";
import {
    derivePeopleFromRows,
    filterAndSortPeople,
    filterRowsForPeople,
    getPersonFilterOptions,
    getSelectedCenturies,
} from "../lib/people";
import { isPendingDatasetReplacement } from "../lib/dataset-revision";
import { reportError } from "../lib/observability";

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
    tipos: string[];
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
    datasetReplacementRevision: number;
    children: React.ReactNode;
}

export function AppProvider({
    rows,
    idbLoaded,
    datasetReplacementRevision,
    children,
}: AppProviderProps) {
    const [filters, setFilters] = useState<FilterState>(() => {
        try {
            const stored = localStorage.getItem("reyes_filters");
            if (stored) {
                const parsed: unknown = JSON.parse(stored);
                return normalizeStoredFilters(parsed);
            }
        } catch (e) {
            reportError(e, {
                event: "persistence.filters.load_failed",
                recoverable: true,
            });
        }
        return { ...DEFAULT_FILTERS };
    });

    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const handledDatasetReplacementRevisionRef = useRef(0);

    // Guarda los filtros en el almacenamiento local cuando cambian.
    useEffect(() => {
        try {
            localStorage.setItem("reyes_filters", JSON.stringify(filters));
        } catch (e) {
            reportError(e, {
                event: "persistence.filters.save_failed",
                recoverable: true,
            });
        }
    }, [filters]);

    const { byPerson, allPeople } = useMemo(() => derivePeopleFromRows(rows), [rows]);

    // --- Filtrar y ordenar ---
    const people: Person[] = useMemo(() => filterAndSortPeople(allPeople, filters), [allPeople, filters]);

    const startupPersonId = useMemo(() => getPreferredStartupPersonId(allPeople), [allPeople]);

    // Auto-seleccionar el personaje inicial preferente.
    // Primero: si se acaba de cargar un nuevo dataset explícitamente, resetear filtros e ir al inicio.
    useEffect(() => {
        if (!isPendingDatasetReplacement(
            datasetReplacementRevision,
            handledDatasetReplacementRevisionRef.current
        )) return;
        handledDatasetReplacementRevisionRef.current = datasetReplacementRevision;
        setFilters({ ...DEFAULT_FILTERS });
        setSelectedPersonId(startupPersonId || null);
    }, [datasetReplacementRevision, startupPersonId]);

    // Segundo: al cargar nuevos datos o si la selección actual no es válida por filtros
    useEffect(() => {
        if (!idbLoaded) {
            return;
        }

        const nextSelectedPersonId = resolveSelectedPersonId(
            selectedPersonId,
            people.map((person) => person.personId)
        );

        // Si no hay selección, o la persona actual ya no existe en el dataset, seleccionamos la primera.
        if (nextSelectedPersonId !== selectedPersonId) {
            setSelectedPersonId(nextSelectedPersonId);
        }
    }, [people, selectedPersonId, idbLoaded]);

    // --- Listas para selectores ---
    const { reinos, tipos, dinastias, siglos } = useMemo(
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

    const hasDatasetFilters = useMemo(
        () => hasActiveDatasetFilters(filters),
        [filters]
    );

    const filteredRows = useMemo(
        () => hasDatasetFilters
            ? filterRowsForPeople(rows, people, filters)
            : rows,
        [rows, people, filters, hasDatasetFilters]
    );

    const filteredStats = useMemo(
        () => hasDatasetFilters
            ? calculateStatsHelper(filteredRows, people)
            : globalStats,
        [filteredRows, people, globalStats, hasDatasetFilters]
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
        tipos,
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
