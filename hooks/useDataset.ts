// ---------------------------------------------------------------------------
// Hook useDataset — gestión centralizada de datos (extraído de App.tsx)
// ---------------------------------------------------------------------------

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { del, get, set } from "idb-keyval";
import type { RawRow, DatasetChecks, MediaAsset, MediaInputOptions } from "../lib/types";
import {
    parseCsv,
    safeJsonParse,
    normalizeRows,
    computeDerivedRow,
    getRowId,
    getPersonId,
    asYearOrNull,
    downloadTextFile,
    downloadBlobFile,
    generateCsv,
} from "../lib/data";
import {
    createDatasetPayload,
    createUploadedMediaPackage,
    getTimestampedExportFileName,
    normalizeDatasetBaseName,
    readDatasetNameFromPayload,
    resolveImportedDatasetName,
    toPortableMediaAsset,
} from "../lib/dataset-package";
import {
    applyMediaAssetsToRows,
    createExternalMediaAsset,
    deriveMediaAssetsFromRows,
    ensurePrimaryMediaAssets,
    normalizeRightsStatus,
} from "../lib/media";
import { applyPersonDraftToRows } from "../lib/person-draft";
import type { ImagePrintResolutionProfile } from "../lib/print-resolution";
import { createStoredZip, parseZip } from "../lib/zip";

// Datos de ejemplo
const SAMPLE_ROWS: RawRow[] = [
    {
        ID: "101pelayo718737asturias",
        PersonID: 101,
        "Nº Reinado": "",
        Nombre: "Pelayo",
        Apelativo: "",
        Reino: "Reino de Asturias",
        "Tipo de gobierno": "Reino",
        Dinastía: "Astur-Leonesa",
        "Inicio del reinado (año)": 718,
        "Final del reinado (año)": 737,
        "Inicio Reinado (Fecha)": "",
        "Fin Reinado (Fecha)": "",
        "Nacimiento (Fecha)": "p. t. s. VII",
        "Nacimiento (lugar)": "",
        "Nacimiento (ciudad)": "",
        "Nacimiento (provincia)": "",
        "Nacimiento (País)": "",
        "Fallecimiento (Fecha)": "737",
        "Fallecimiento (lugar)": "Cangas de Onís",
        "Fallecimiento (ciudad)": "",
        "Fallecimiento (provincia)": "",
        "Fallecimiento (País)": "",
        Descripción: "Ejemplo interno. Sustitúyalo por su dataset.",
        "Imagen URL": "",
        "Ficha RAH URL": "",
        "Información verificada": "no",
    },
];

function normalizeStoredMediaAssets(assets: MediaAsset[]): MediaAsset[] {
    return ensurePrimaryMediaAssets(
        assets
            .map((asset): MediaAsset => {
                const kind: MediaAsset["kind"] =
                    asset.kind === "uploaded-file" ? "uploaded-file" : "external-url";

                return {
                    ...asset,
                    id: String(asset.id ?? ""),
                    personId: String(asset.personId ?? "").trim(),
                    kind,
                    src: String(asset.src ?? ""),
                    rightsStatus: normalizeRightsStatus(asset.rightsStatus),
                    isPrimary: Boolean(asset.isPrimary),
                    createdAt: String(asset.createdAt ?? new Date(0).toISOString()),
                };
            })
            .filter((asset) => asset.id && asset.personId && (asset.src || asset.storageKey))
    );
}

function createRuntimeId(prefix: string): string {
    const randomId = globalThis.crypto?.randomUUID?.();
    if (randomId) return `${prefix}-${randomId}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readMediaAssetsFromPayload(value: unknown): MediaAsset[] | undefined {
    if (!value || typeof value !== "object") return undefined;
    const mediaAssetsValue = (value as { mediaAssets?: unknown }).mediaAssets;
    return Array.isArray(mediaAssetsValue) ? (mediaAssetsValue as MediaAsset[]) : undefined;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

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
    const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>(() =>
        deriveMediaAssetsFromRows(SAMPLE_ROWS)
    );
    const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [datasetName, setDatasetName] = useState("datos");
    const [idbLoaded, setIdbLoaded] = useState(false);
    const [datasetLoadedAt, setDatasetLoadedAt] = useState<number | null>(null);

    // --- Persistencia con IndexedDB ---
    useEffect(() => {
        async function loadFromIdb() {
            try {
                const storedRows = await get<RawRow[]>("reyes_dataset_rows");
                const storedName = await get<string>("reyes_dataset_name");
                const storedMediaAssets = await get<MediaAsset[]>("reyes_media_assets");
                if (storedRows && storedRows.length > 0) {
                    setRows(storedRows);
                }
                if (storedName) {
                    setDatasetName(normalizeDatasetBaseName(storedName));
                }
                if (storedMediaAssets && storedMediaAssets.length > 0) {
                    setMediaAssets(normalizeStoredMediaAssets(storedMediaAssets));
                } else if (storedRows && storedRows.length > 0) {
                    setMediaAssets(deriveMediaAssetsFromRows(storedRows));
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

    useEffect(() => {
        if (!idbLoaded) return;
        set("reyes_media_assets", mediaAssets).catch(err => console.error("Error saving media assets to IndexedDB:", err));
    }, [mediaAssets, idbLoaded]);

    useEffect(() => {
        let active = true;
        const objectUrls: string[] = [];

        async function loadUploadedPreviews() {
            const previews: Record<string, string> = {};

            for (const asset of mediaAssets) {
                if (asset.kind !== "uploaded-file" || !asset.storageKey) continue;
                try {
                    const blob = await get<Blob>(asset.storageKey);
                    if (!(blob instanceof Blob)) continue;
                    const objectUrl = URL.createObjectURL(blob);
                    objectUrls.push(objectUrl);
                    previews[asset.id] = objectUrl;
                } catch (err) {
                    console.error("Error loading media blob from IndexedDB:", err);
                }
            }

            if (active) {
                setMediaPreviewUrls(previews);
            } else {
                objectUrls.forEach((url) => URL.revokeObjectURL(url));
            }
        }

        loadUploadedPreviews();

        return () => {
            active = false;
            objectUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [mediaAssets]);

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
        (objs: RawRow[], nameHint: string | null, nextMediaAssets?: MediaAsset[]) => {
            const next = objs.map((r, i) => ({
                ...computeDerivedRow(r),
                _rowId: getRowId(r, i),
            }));
            setRows(next);
            setMediaAssets(
                nextMediaAssets
                    ? normalizeStoredMediaAssets(nextMediaAssets)
                    : deriveMediaAssetsFromRows(next)
            );
            setError(null);
            if (nameHint) setDatasetName(normalizeDatasetBaseName(nameHint));
            setDatasetLoadedAt(Date.now());
        },
        []
    );

    const importDatasetPackage = useCallback(
        async (file: File) => {
            try {
                const bytes = new Uint8Array(await file.arrayBuffer());
                const entries = await parseZip(bytes);
                const entryByPath = new Map(entries.map((entry) => [entry.path, entry]));
                const dataEntry = entryByPath.get("datos.json");

                if (!dataEntry) {
                    setError("ZIP inválido: falta datos.json.");
                    return;
                }

                const text = new TextDecoder().decode(dataEntry.data);
                setRawText(text);

                const parsed = safeJsonParse(text);
                if (!parsed.ok) {
                    setError(`JSON inválido dentro del ZIP: ${parsed.error}`);
                    return;
                }

                const norm = normalizeRows(parsed.value);
                if (!norm.ok) {
                    setError(norm.error || "Unknown error");
                    return;
                }

                const restoredMediaAssets: MediaAsset[] = [];
                const packageMediaAssets = readMediaAssetsFromPayload(parsed.value) ?? [];

                for (const asset of packageMediaAssets) {
                    if (asset.kind === "uploaded-file") {
                        const packagePath = String(asset.packagePath ?? "");
                        const mediaEntry = packagePath ? entryByPath.get(packagePath) : undefined;
                        if (!mediaEntry) continue;

                        const id = String(asset.id || createRuntimeId("media-imported"));
                        const storageKey = `reyes_media_blob_${id}`;
                        const blob = new Blob([mediaEntry.data], { type: asset.mimeType || "application/octet-stream" });
                        await set(storageKey, blob);

                        const { packagePath: _packagePath, storageKey: _storageKey, ...rest } = asset;
                        restoredMediaAssets.push({
                            ...rest,
                            id,
                            kind: "uploaded-file",
                            src: "",
                            storageKey,
                            size: asset.size ?? mediaEntry.data.byteLength,
                        });
                        continue;
                    }

                    const { packagePath: _packagePath, storageKey: _storageKey, ...rest } = asset;
                    restoredMediaAssets.push({
                        ...rest,
                        kind: "external-url",
                    });
                }

                const restoredStorageKeys = new Set(
                    restoredMediaAssets
                        .map((asset) => asset.storageKey)
                        .filter((storageKey): storageKey is string => Boolean(storageKey))
                );
                await Promise.all(
                    mediaAssets
                        .filter((asset) => asset.storageKey && !restoredStorageKeys.has(asset.storageKey))
                        .map((asset) => del(asset.storageKey!))
                );

                setDetectedDelimiter(null);
                setDetectedQuotes(null);
                setDatasetFromRows(
                    norm.value!,
                    resolveImportedDatasetName({
                        currentDatasetName: datasetName,
                        fileName: file?.name,
                        payloadDatasetName: readDatasetNameFromPayload(parsed.value),
                    }),
                    restoredMediaAssets
                );
            } catch (err) {
                setError(`ZIP inválido: ${errorMessage(err)}`);
            }
        },
        [datasetName, mediaAssets, setDatasetFromRows]
    );

    const handleFile = useCallback(
        (file: File) => {
            const nameHint = file?.name ? file.name : null;
            if (file.name.toLowerCase().endsWith(".zip")) {
                void importDatasetPackage(file);
                return;
            }

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
                    setDatasetFromRows(
                        parsed.value as RawRow[],
                        resolveImportedDatasetName({
                            currentDatasetName: datasetName,
                            fileName: nameHint,
                        })
                    );
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
                const mediaAssetsFromJson =
                    readMediaAssetsFromPayload(parsed.value);
                setDatasetFromRows(
                    norm.value!,
                    resolveImportedDatasetName({
                        currentDatasetName: datasetName,
                        fileName: nameHint,
                        payloadDatasetName: readDatasetNameFromPayload(parsed.value),
                    }),
                    mediaAssetsFromJson
                );
            };
            reader.readAsText(file, "utf-8");
        },
        [datasetName, importDatasetPackage, setDatasetFromRows]
    );

    const addMediaUrl = useCallback(
        (
            personId: string | number,
            url: string,
            options?: MediaInputOptions
        ): string | null => {
            const asset = createExternalMediaAsset({
                personId,
                url,
                title: options?.title,
                workDate: options?.workDate,
                author: options?.author,
                sourceName: options?.sourceName,
                sourceUrl: options?.sourceUrl,
                license: options?.license,
                usageNotes: options?.usageNotes,
                rightsStatus: normalizeRightsStatus(options?.rightsStatus),
                isPrimary: false,
                now: new Date().toISOString(),
            });

            if (!asset) {
                setError("Validación: falta PersonID o URL de imagen.");
                return null;
            }

            setMediaAssets((prev) => {
                const duplicate = prev.some(
                    (item) =>
                        item.personId === asset.personId &&
                        item.kind === "external-url" &&
                        item.src === asset.src
                );
                if (duplicate) return prev;

                const hasPersonAssets = prev.some((item) => item.personId === asset.personId);
                return ensurePrimaryMediaAssets([
                    ...prev,
                    { ...asset, isPrimary: !hasPersonAssets },
                ]);
            });
            setError(null);
            return asset.id;
        },
        [setError]
    );

    const addUploadedMedia = useCallback(
        async (
            personId: string | number,
            file: File,
            options?: MediaInputOptions
        ): Promise<string | null> => {
            const normalizedPersonId = String(personId ?? "").trim();
            if (!normalizedPersonId) {
                setError("Validación: falta PersonID para asociar la imagen.");
                return null;
            }
            if (!file.type.startsWith("image/")) {
                setError("Validación: el archivo subido debe ser una imagen.");
                return null;
            }

            const id = createRuntimeId(`media-${normalizedPersonId}`);
            const storageKey = `reyes_media_blob_${id}`;
            await set(storageKey, file);

            const asset: MediaAsset = {
                id,
                personId: normalizedPersonId,
                kind: "uploaded-file",
                src: "",
                storageKey,
                title: options?.title || file.name,
                workDate: options?.workDate,
                author: options?.author,
                sourceName: options?.sourceName,
                sourceUrl: options?.sourceUrl,
                license: options?.license,
                usageNotes: options?.usageNotes,
                rightsStatus: normalizeRightsStatus(options?.rightsStatus),
                fileName: file.name,
                mimeType: file.type,
                size: file.size,
                isPrimary: false,
                createdAt: new Date().toISOString(),
            };

            setMediaAssets((prev) => {
                const hasPersonAssets = prev.some((item) => item.personId === normalizedPersonId);
                return ensurePrimaryMediaAssets([
                    ...prev,
                    { ...asset, isPrimary: !hasPersonAssets },
                ]);
            });
            setError(null);
            return id;
        },
        [setError]
    );

    const replaceMediaAssetFile = useCallback(
        async (assetId: string, file: File): Promise<boolean> => {
            const target = mediaAssets.find((asset) => asset.id === assetId);
            if (!target) {
                setError("Validación: no se ha encontrado la imagen que se quiere reemplazar.");
                return false;
            }
            if (!file.type.startsWith("image/")) {
                setError("Validación: el archivo de reemplazo debe ser una imagen.");
                return false;
            }

            try {
                const storageKey = target.storageKey || `reyes_media_blob_${target.id}`;
                await set(storageKey, file);

                setMediaAssets((prev) =>
                    ensurePrimaryMediaAssets(
                        prev.map((asset) => {
                            if (asset.id !== assetId) return asset;

                            const {
                                packagePath: _packagePath,
                                printPackagePath: _printPackagePath,
                                printDpi: _printDpi,
                                ...assetWithoutPackagePaths
                            } = asset;
                            const shouldUseFileNameAsTitle =
                                !asset.title?.trim() || Boolean(asset.fileName && asset.title === asset.fileName);

                            return {
                                ...assetWithoutPackagePaths,
                                kind: "uploaded-file",
                                src: "",
                                storageKey,
                                title: shouldUseFileNameAsTitle ? file.name : asset.title,
                                fileName: file.name,
                                mimeType: file.type,
                                size: file.size,
                                updatedAt: new Date().toISOString(),
                            };
                        })
                    )
                );
                setError(null);
                return true;
            } catch (err) {
                setError(`Imagen: no se pudo reemplazar el archivo. ${errorMessage(err)}`);
                return false;
            }
        },
        [mediaAssets, setError]
    );

    const updateMediaAsset = useCallback(
        (assetId: string, patch: Partial<MediaAsset>) => {
            setMediaAssets((prev) =>
                ensurePrimaryMediaAssets(
                    prev.map((asset) =>
                        asset.id === assetId
                            ? {
                                ...asset,
                                ...patch,
                                id: asset.id,
                                personId: asset.personId,
                                kind: asset.kind,
                                rightsStatus: normalizeRightsStatus(patch.rightsStatus ?? asset.rightsStatus),
                                updatedAt: new Date().toISOString(),
                            }
                            : asset
                    )
                )
            );
        },
        []
    );

    const removeMediaAsset = useCallback(
        async (assetId: string) => {
            const target = mediaAssets.find((asset) => asset.id === assetId);
            if (target?.storageKey) {
                await del(target.storageKey);
            }
            setMediaAssets((prev) =>
                ensurePrimaryMediaAssets(prev.filter((asset) => asset.id !== assetId))
            );
        },
        [mediaAssets]
    );

    const setPrimaryMediaAsset = useCallback((personId: string | number, assetId: string) => {
        const normalizedPersonId = String(personId ?? "").trim();
        setMediaAssets((prev) =>
            prev.map((asset) =>
                asset.personId === normalizedPersonId
                    ? { ...asset, isPrimary: asset.id === assetId }
                    : asset
            )
        );
    }, []);

    // --- Edición ---
    const commitPersonDraft = useCallback(
        (
            pid: string,
            draft: RawRow
        ): string | null => {
            if (!pid) return "Validación: falta PersonID.";
            setRows((prev) => applyPersonDraftToRows(prev, pid, draft));
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

    const addPerson = useCallback((): string => {
        const numericIds = rows
            .map((r) => Number(getPersonId(r)))
            .filter((n) => Number.isFinite(n));
        const personId = String((numericIds.length ? Math.max(...numericIds) : 0) + 1);

        const newRow: RawRow = {
            ID: "",
            PersonID: personId,
            "Nº Reinado": "",
            Nombre: "",
            Apelativo: "",
            Reino: "",
            "Tipo de gobierno": "",
            Dinastía: "",
            "Inicio del reinado (año)": "",
            "Final del reinado (año)": "",
            "Información verificada": "no",
        };
        const withId = {
            ...computeDerivedRow(newRow),
            _rowId: createRuntimeId("row"),
        };
        setRows((prev) => [withId, ...prev]);
        setDatasetLoadedAt(Date.now());
        return personId;
    }, [rows]);

    const removeRow = useCallback((rowId: string) => {
        setRows((prev) => prev.filter((r) => String(r._rowId) !== rowId));
    }, []);

    const removePerson = useCallback((personId: string) => {
        setRows((prev) =>
            prev.filter((r) => String(getPersonId(r)) !== personId)
        );
    }, []);

    // --- Exportación ---
    const exportDatasetPackage = useCallback(async (printProfile: ImagePrintResolutionProfile = "original") => {
        try {
            const exportedDate = new Date();
            const exportedAt = exportedDate.toISOString();
            const portableMediaAssets: MediaAsset[] = [];
            const mediaEntries: { path: string; data: Uint8Array }[] = [];
            let missingUploadedFiles = 0;
            let skippedPrintVariants = 0;

            for (const asset of mediaAssets) {
                if (asset.kind === "uploaded-file") {
                    if (!asset.storageKey) {
                        missingUploadedFiles++;
                        portableMediaAssets.push(toPortableMediaAsset(asset));
                        continue;
                    }

                    const blob = await get<Blob>(asset.storageKey);
                    if (!(blob instanceof Blob)) {
                        missingUploadedFiles++;
                        portableMediaAssets.push(toPortableMediaAsset(asset));
                        continue;
                    }

                    const data = new Uint8Array(await blob.arrayBuffer());
                    const packaged = createUploadedMediaPackage(asset, data, printProfile);
                    mediaEntries.push(...packaged.entries);
                    portableMediaAssets.push(packaged.portableAsset);
                    if (packaged.skippedPrintVariant) skippedPrintVariants++;
                    continue;
                }

                portableMediaAssets.push(toPortableMediaAsset(asset));
            }

            const payload = createDatasetPayload(rows, portableMediaAssets, exportedAt, datasetName);
            const zip = createStoredZip([
                { path: "datos.json", data: JSON.stringify(payload, null, 2) },
                ...mediaEntries,
            ]);

            downloadBlobFile(
                getTimestampedExportFileName(datasetName, "zip", exportedDate),
                new Blob([zip], { type: "application/zip" })
            );

            setError(
                [
                    missingUploadedFiles
                        ? `Exportación ZIP: ${missingUploadedFiles} archivo(s) subido(s) no se encontraron en IndexedDB.`
                        : "",
                    skippedPrintVariants
                        ? `Exportación ZIP: ${skippedPrintVariants} imagen(es) no admiten metadatos automáticos de impresión.`
                        : "",
                ].filter(Boolean).join(" ") || null
            );
        } catch (err) {
            setError(`Exportación ZIP: ${errorMessage(err)}`);
        }
    }, [datasetName, mediaAssets, rows]);

    const exportCsv = useCallback(() => {
        const text = generateCsv(applyMediaAssetsToRows(rows, mediaAssets));
        const base = getTimestampedExportFileName(datasetName, "csv");
        downloadTextFile(base, text, "text/csv;charset=utf-8");
    }, [rows, mediaAssets, datasetName]);

    return {
        fileRef,
        rows,
        mediaAssets,
        mediaPreviewUrls,
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
        addPerson,
        addRowForPerson,
        removeRow,
        removePerson,
        addMediaUrl,
        addUploadedMedia,
        replaceMediaAssetFile,
        updateMediaAsset,
        removeMediaAsset,
        setPrimaryMediaAsset,
        exportDatasetPackage,
        exportCsv,
        idbLoaded,
        datasetLoadedAt,
    };
}
