// ---------------------------------------------------------------------------
// Hook useDataset — gestión centralizada de datos (extraído de App.tsx)
// ---------------------------------------------------------------------------

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { get, set } from "idb-keyval";
import type { RawRow, DatasetChecks } from "../lib/types";
import {
    parseCsv,
    safeJsonParse,
    normalizeRows,
    computeDerivedRow,
    getRowId,
    getPersonId,
    asYearOrNull,
    boolFromVerified,
    verifiedToText,
    downloadTextFile,
    generateCsv,
} from "../lib/data";

// Datos de ejemplo
const SAMPLE_ROWS: RawRow[] = [
    {
        ID: "51fernandov14791516castilla",
        PersonID: 51,
        "Nº Reinado": "",
        Nombre: "Fernando V",
        Apelativo: "",
        Reino: "Corona de Castilla",
        "Tipo de gobierno": "Corona",
        Dinastía: "Trastámara",
        "Inicio del reinado (año)": 1479,
        "Final del reinado (año)": 1516,
        "Inicio Reinado (Fecha)": "",
        "Fin Reinado (Fecha)": "",
        "Nacimiento (Fecha)": "1452",
        "Nacimiento (lugar)": "Sos",
        "Nacimiento (ciudad)": "",
        "Nacimiento (provincia)": "",
        "Nacimiento (País)": "",
        "Fallecimiento (Fecha)": "1516",
        "Fallecimiento (lugar)": "Madrigalejo",
        "Fallecimiento (ciudad)": "",
        "Fallecimiento (provincia)": "",
        "Fallecimiento (País)": "",
        Descripción: "Ejemplo interno. Sustitúyalo por su dataset.",
        "Imagen URL": "",
        "Ficha RAH URL": "",
        "Información verificada": "no",
    },
    {
        ID: "51fernandoii14791516aragon",
        PersonID: 51,
        "Nº Reinado": "",
        Nombre: "Fernando II",
        Apelativo: "",
        Reino: "Corona de Aragón",
        "Tipo de gobierno": "Corona",
        Dinastía: "Trastámara",
        "Inicio del reinado (año)": 1479,
        "Final del reinado (año)": 1516,
        "Información verificada": "no",
    },
];

export function useDataset() {
    const fileRef = useRef<HTMLInputElement>(null);

    // --- Estado de datos ---
    const [rawText, setRawText] = useState("");
    const [detectedDelimiter, setDetectedDelimiter] = useState<string | null>(null);
    const [detectedQuotes, setDetectedQuotes] = useState<boolean | null>(null);
    const [rows, setRows] = useState<RawRow[]>(() =>
        SAMPLE_ROWS.map((r, i) => ({
            ...computeDerivedRow(r),
            _rowId: getRowId(r, i),
        }))
    );
    const [error, setError] = useState<string | null>(null);
    const [datasetName, setDatasetName] = useState("datos.json");
    const [idbLoaded, setIdbLoaded] = useState(false);

    // --- Persistencia con IndexedDB ---
    useEffect(() => {
        async function loadFromIdb() {
            try {
                const storedRows = await get<RawRow[]>("reyes_dataset_rows");
                const storedName = await get<string>("reyes_dataset_name");
                if (storedRows && storedRows.length > 0) {
                    setRows(storedRows);
                }
                if (storedName) {
                    setDatasetName(storedName);
                }
            } catch (err) {
                console.error("Error loading from IndexedDB:", err);
            } finally {
                setIdbLoaded(true);
            }
        }
        loadFromIdb();
    }, []);

    useEffect(() => {
        if (!idbLoaded) return;
        set("reyes_dataset_rows", rows).catch(err => console.error("Error saving to IndexedDB:", err));
        set("reyes_dataset_name", datasetName).catch(err => console.error("Error saving name to IndexedDB:", err));
    }, [rows, datasetName, idbLoaded]);

    // --- Comprobaciones ---
    const datasetChecks: DatasetChecks = useMemo(() => {
        const issues: string[] = [];
        const ids = rows.map((r) => String(r._rowId));
        const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
        if (dup.length) issues.push(`ids duplicados: ${dup.length}`);

        let inv = 0;
        for (const r of rows) {
            const a = asYearOrNull(r?.["Inicio del reinado (año)"]);
            const b = asYearOrNull(r?.["Final del reinado (año)"]);
            if (a !== null && b !== null && a > b) inv++;
        }
        if (inv) issues.push(`gobiernos con inicio (año) mayor que fin (año): ${inv}`);

        const noPid = rows.filter((r) => !getPersonId(r)).length;
        if (noPid) issues.push(`filas sin PersonID: ${noPid}`);

        const badName = rows.filter(
            (r) =>
                /^(https?:\/\/|www\.)/i.test(String(r?.Nombre || "")) ||
                /^(https?:\/\/|www\.)/i.test(String(r?.Apelativo || ""))
        ).length;
        if (badName)
            issues.push(`filas con «Nombre»/«Apelativo» que parecen URL: ${badName}`);

        return { ok: issues.length === 0, issues };
    }, [rows]);

    // --- Carga de datos ---
    const setDatasetFromRows = useCallback(
        (objs: RawRow[], nameHint: string | null) => {
            const next = objs.map((r, i) => ({
                ...computeDerivedRow(r),
                _rowId: getRowId(r, i),
            }));
            setRows(next);
            setError(null);
            if (nameHint) setDatasetName(nameHint);
        },
        []
    );

    const handleFile = useCallback(
        (file: File) => {
            const nameHint = file?.name ? file.name : null;
            const reader = new FileReader();
            reader.onload = () => {
                const text = String(reader.result ?? "");
                setRawText(text);

                if (file.name.toLowerCase().endsWith(".csv")) {
                    const parsed = parseCsv(text);
                    if (!parsed.ok) {
                        setError(parsed.error || "Unknown error");
                        return;
                    }
                    setDetectedDelimiter(parsed.delimiter || null);
                    setDetectedQuotes(parsed.usesQuotes || false);
                    setDatasetFromRows(parsed.value as RawRow[], nameHint);
                    return;
                }

                const parsed = safeJsonParse(text);
                if (!parsed.ok) {
                    setError(`JSON inválido: ${parsed.error}`);
                    return;
                }
                const norm = normalizeRows(parsed.value);
                if (!norm.ok) {
                    setError(norm.error || "Unknown error");
                    return;
                }
                setDatasetFromRows(norm.value!, nameHint);
            };
            reader.readAsText(file, "utf-8");
        },
        [setDatasetFromRows]
    );

    // --- Edición ---
    const commitPersonDraft = useCallback(
        (
            pid: string,
            draft: RawRow
        ): string | null => {
            if (!pid) return "Validación: falta PersonID.";
            const vText = String(draft["Información verificada"] ?? "").trim();
            const vBool = boolFromVerified(vText);

            setRows((prev) =>
                prev
                    .map((r) => {
                        if (String(getPersonId(r)) !== pid) return r;
                        const next = {
                            ...r,
                            ...draft,
                            "Información verificada": verifiedToText(vBool),
                        };
                        return computeDerivedRow(next);
                    })
                    .map((r) => ({ ...r }))
            );
            return null;
        },
        []
    );

    const commitRowDraft = useCallback(
        (rowId: string, draft: RawRow): string | null => {
            if (!rowId) return "Validación: falta _rowId.";
            const a = asYearOrNull(draft?.["Inicio del reinado (año)"]);
            const b = asYearOrNull(draft?.["Final del reinado (año)"]);
            if (a !== null && b !== null && a > b) return "Validación: inicio > fin.";

            const next = computeDerivedRow({ ...draft, _rowId: rowId });
            setRows((prev) =>
                prev.map((r) => (String(r._rowId) === rowId ? next : r))
            );
            return null;
        },
        []
    );

    const addRowForPerson = useCallback(
        (personId: string | number, baseRow: RawRow) => {
            const newRow: RawRow = {
                ID: "",
                PersonID: personId,
                "Nº Reinado": "",
                Nombre: String(baseRow?.Nombre ?? ""),
                Apelativo: String(baseRow?.Apelativo ?? ""),
                Reino: "",
                "Tipo de gobierno": String(baseRow?.["Tipo de gobierno"] ?? ""),
                Dinastía: String(baseRow?.Dinastía ?? ""),
                "Inicio del reinado (año)": "",
                "Final del reinado (año)": "",
                "Información verificada": String(
                    baseRow?.["Información verificada"] ?? "no"
                ),
            };
            const idx = rows.length;
            const withId = {
                ...computeDerivedRow(newRow),
                _rowId: getRowId(newRow, idx),
            };
            setRows((prev) => [withId, ...prev]);
        },
        [rows.length]
    );

    const removeRow = useCallback((rowId: string) => {
        setRows((prev) => prev.filter((r) => String(r._rowId) !== rowId));
    }, []);

    const removePerson = useCallback((personId: string) => {
        setRows((prev) =>
            prev.filter((r) => String(getPersonId(r)) !== personId)
        );
    }, []);

    // --- Exportación ---
    const exportCsv = useCallback(() => {
        const text = generateCsv(rows);
        const base = datasetName?.toLowerCase().endsWith(".csv")
            ? datasetName
            : `${datasetName.replace(/\.json$/i, "")}.csv`;
        downloadTextFile(base, text, "text/csv;charset=utf-8");
    }, [rows, datasetName]);

    return {
        fileRef,
        rows,
        rawText,
        detectedDelimiter,
        detectedQuotes,
        error,
        setError,
        datasetName,
        setDatasetName,
        datasetChecks,
        handleFile,
        commitPersonDraft,
        commitRowDraft,
        addRowForPerson,
        removeRow,
        removePerson,
        exportCsv,
    };
}
