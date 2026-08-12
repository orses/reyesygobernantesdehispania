// ---------------------------------------------------------------------------
// useDataset: gestión centralizada de datos extraída de App.tsx.
// ---------------------------------------------------------------------------

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { delMany, getMany, keys, setMany } from "idb-keyval";
import type { RawRow, DatasetChecks, MediaAsset, MediaInputOptions } from "../lib/types";
import {
    normalizeUrl,
    computeDerivedRow,
    getPersonId,
    asYearOrNull,
    downloadTextFile,
    downloadBlobFile,
    generateCsv,
} from "../lib/data";
import {
    getTimestampedExportFileName,
    normalizeDatasetBaseName,
    resolveImportedDatasetName,
} from "../lib/dataset-package";
import {
    applyMediaAssetsToRows,
    createExternalMediaAsset,
    deriveMediaAssetsFromRows,
    ensurePrimaryMediaAssets,
    movePersonMediaAsset,
    normalizeRightsStatus,
} from "../lib/media";
import {
    applyPersonEditorDocumentToRows,
    createPersonEditorDocument,
} from "../lib/person-editor-document";
import type { ImagePrintResolutionProfile } from "../lib/print-resolution";
import { parseZipFile } from "../lib/zip";
import { getReignYearMismatches, reignYearMismatchMessage } from "../lib/reign-chronology";
import { checkDatasetRows } from "../lib/dataset-checks";
import {
    applyRowDraftToRows,
    prepareDatasetRows,
    removeRowById,
} from "../lib/dataset-rows";
import {
    DATASET_NAME_STORAGE_KEY,
    DATASET_ROWS_STORAGE_KEY,
    MEDIA_ASSETS_STORAGE_KEY,
    commitDatasetReplacement,
    createPersistenceTaskQueue,
    getChangedDatasetStorageEntries,
    hydrateDatasetPersistence,
    mergeDatasetSnapshotDomains,
    resolvePersistableDatasetDomains,
    restoreDatasetSnapshotFromStorage,
    runWithDatasetStorageLock,
    selectDatasetDomainForPublication,
    type DatasetPersistenceEpochs,
    type DatasetSnapshot,
    type DatasetStorageEntry,
    type PersistenceTaskQueue,
} from "../lib/dataset-persistence";
import {
    createMediaStorageKey,
    createReplacementMediaStorageKey,
    createUploadedMediaStoragePlan,
    normalizeMediaAssets,
    reconcileMediaAssetsWithRows,
} from "../lib/media-lifecycle";
import {
    assertDatasetTextFileSize,
    prepareDatasetTextImport,
    prepareDatasetZipImport,
    type MediaImportRepair,
    type MediaImportReview,
} from "../lib/dataset-file-import";
import { nextDatasetReplacementRevision } from "../lib/dataset-revision";
import {
    datasetZipExportBlob,
    datasetZipExportWarning,
    prepareDatasetZipExport,
} from "../lib/dataset-export";
import { reportError } from "../lib/observability";

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

function createRuntimeId(prefix: string): string {
    const randomId = globalThis.crypto?.randomUUID?.();
    if (randomId) return `${prefix}-${randomId}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

const DATASET_SAVE_FAILURE_MESSAGE = "Persistencia: no se pudieron guardar los cambios.";

export type DatasetHydrationStatus = "pending" | "ready" | "failed";

export interface PendingDatasetImportReview {
    file: File;
    review: MediaImportReview;
    resolutionError?: string;
}

type MediaAssetMutationResult =
    | {
        ok: true;
        mediaAssets: MediaAsset[];
        blobEntries?: DatasetStorageEntry[];
    }
    | { ok: false; error: string };

async function readDatasetSnapshotFromIdb(): Promise<DatasetSnapshot> {
    const values = await getMany<unknown>([
        DATASET_ROWS_STORAGE_KEY,
        DATASET_NAME_STORAGE_KEY,
        MEDIA_ASSETS_STORAGE_KEY,
    ]);
    const restored = restoreDatasetSnapshotFromStorage(SAMPLE_ROWS, [
        values[0],
        values[1],
        values[2],
    ]);
    return {
        rows: restored.rows,
        datasetName: restored.datasetName,
        mediaAssets: restored.mediaAssets,
    };
}

export function useDataset() {
    const fileRef = useRef<HTMLInputElement>(null);

    // --- Estado de datos ---
    const [rawText, setRawText] = useState("");
    const [detectedDelimiter, setDetectedDelimiter] = useState<string | null>(null);
    const [detectedQuotes, setDetectedQuotes] = useState<boolean | null>(null);
    const [rows, setRows] = useState<RawRow[]>(() => prepareDatasetRows(SAMPLE_ROWS));
    const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>(() =>
        deriveMediaAssetsFromRows(SAMPLE_ROWS)
    );
    const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [pendingDatasetImportReview, setPendingDatasetImportReview] =
        useState<PendingDatasetImportReview | null>(null);
    const [isApplyingDatasetImportReview, setIsApplyingDatasetImportReview] = useState(false);
    const [datasetName, setDatasetName] = useState("datos");
    const [hydrationStatus, setHydrationStatus] = useState<DatasetHydrationStatus>("pending");
    const [datasetReplacementRevision, setDatasetReplacementRevision] = useState(0);
    const persistedDatasetSnapshotRef = useRef<DatasetSnapshot | null>(null);
    const persistenceEpochRef = useRef<DatasetPersistenceEpochs>({
        rows: 0,
        datasetName: 0,
        mediaAssets: 0,
    });
    const persistenceQueueRef = useRef<PersistenceTaskQueue | null>(null);
    if (!persistenceQueueRef.current) {
        persistenceQueueRef.current = createPersistenceTaskQueue(runWithDatasetStorageLock);
    }
    const persistenceQueue = persistenceQueueRef.current;
    const idbLoaded = hydrationStatus === "ready";
    const uploadedMediaStoragePlan = useMemo(
        () => createUploadedMediaStoragePlan(mediaAssets),
        [mediaAssets]
    );
    const uploadedMediaStoragePlanRef = useRef(uploadedMediaStoragePlan);
    uploadedMediaStoragePlanRef.current = uploadedMediaStoragePlan;

    // --- Persistencia con IndexedDB ---
    useEffect(() => {
        let active = true;

        void persistenceQueue.enqueue(() => hydrateDatasetPersistence({
            sampleRows: SAMPLE_ROWS,
            readEntries: async () => {
                const values = await getMany<unknown>([
                    DATASET_ROWS_STORAGE_KEY,
                    DATASET_NAME_STORAGE_KEY,
                    MEDIA_ASSETS_STORAGE_KEY,
                ]);
                return [values[0], values[1], values[2]];
            },
            listKeys: () => keys(),
            writeEntries: (entries) => setMany(entries),
            deleteKeys: (storageKeys) => delMany(storageKeys),
        })).then((result) => {
            if (!active) return;
            if (!result.ok) {
                reportError(result.error, {
                    event: "persistence.dataset.load_failed",
                    recoverable: false,
                    metadata: { storageKeyCount: 3 },
                });
                setError("Persistencia: no se pudo restaurar el almacenamiento local de forma segura.");
                setHydrationStatus("failed");
                return;
            }

            if (result.cleanupError) {
                reportError(result.cleanupError, {
                    event: "media.blob.cleanup_failed",
                    recoverable: true,
                });
            }
            persistedDatasetSnapshotRef.current = result.snapshot;
            persistenceEpochRef.current = {
                rows: persistenceEpochRef.current.rows + 1,
                datasetName: persistenceEpochRef.current.datasetName + 1,
                mediaAssets: persistenceEpochRef.current.mediaAssets + 1,
            };
            setRows(result.snapshot.rows);
            setMediaAssets(result.snapshot.mediaAssets);
            setDatasetName(result.snapshot.datasetName);
            setHydrationStatus("ready");
        }).catch((err) => {
            if (!active) return;
            reportError(err, {
                event: "persistence.dataset.load_failed",
                recoverable: false,
                metadata: { storageKeyCount: 3 },
            });
            setError("Persistencia: no se pudo bloquear el almacenamiento local de forma segura.");
            setHydrationStatus("failed");
        });

        return () => {
            active = false;
        };
    }, [persistenceQueue]);

    useEffect(() => {
        if (hydrationStatus !== "ready") return;
        const snapshot = { rows, datasetName, mediaAssets };
        const previousSnapshot = persistedDatasetSnapshotRef.current;
        const rowsChanged = !previousSnapshot || previousSnapshot.rows !== snapshot.rows;
        const nameChanged = !previousSnapshot || previousSnapshot.datasetName !== snapshot.datasetName;
        const mediaChanged = !previousSnapshot || previousSnapshot.mediaAssets !== snapshot.mediaAssets;
        if (!rowsChanged && !nameChanged && !mediaChanged) return;
        const scheduledEpoch = { ...persistenceEpochRef.current };

        void persistenceQueue.enqueue(async () => {
            const persistableDomains = resolvePersistableDatasetDomains(
                {
                    rows: rowsChanged,
                    datasetName: nameChanged,
                    mediaAssets: mediaChanged,
                },
                scheduledEpoch,
                persistenceEpochRef.current
            );
            if (!Object.values(persistableDomains).some(Boolean)) return;

            const latest = await readDatasetSnapshotFromIdb();
            const merged = mergeDatasetSnapshotDomains(
                latest,
                snapshot,
                persistableDomains
            );
            const entries = getChangedDatasetStorageEntries(latest, merged);
            if (entries.length > 0) await setMany(entries);
            persistedDatasetSnapshotRef.current = merged;

            setRows((current) => current === snapshot.rows ? merged.rows : current);
            setDatasetName((current) => current === snapshot.datasetName ? merged.datasetName : current);
            setMediaAssets((current) => current === snapshot.mediaAssets ? merged.mediaAssets : current);
        }).catch((err) => {
            reportError(err, {
                event: "persistence.dataset.save_failed",
                recoverable: true,
                metadata: {
                    changedDomainCount: Number(rowsChanged) + Number(nameChanged) + Number(mediaChanged),
                    mediaAssetCount: snapshot.mediaAssets.length,
                    rowCount: snapshot.rows.length,
                },
            });
        });
    }, [rows, datasetName, mediaAssets, hydrationStatus, persistenceQueue]);

    useEffect(() => {
        let active = true;
        const objectUrls: string[] = [];

        async function loadUploadedPreviews() {
            const previews: Record<string, string> = {};
            const plan = uploadedMediaStoragePlanRef.current;

            try {
                const storedValues = plan.storageKeys.length > 0
                    ? await getMany<unknown>(plan.storageKeys)
                    : [];
                const blobByStorageKey = new Map(
                    plan.storageKeys.map((storageKey, index) => [
                        storageKey,
                        storedValues[index],
                    ])
                );

                for (const reference of plan.references) {
                    const blob = blobByStorageKey.get(reference.storageKey);
                    if (!(blob instanceof Blob)) continue;
                    const objectUrl = URL.createObjectURL(blob);
                    objectUrls.push(objectUrl);
                    previews[reference.assetId] = objectUrl;
                }
            } catch (err) {
                reportError(err, {
                    event: "media.preview.load_failed",
                    recoverable: true,
                    metadata: {
                        referenceCount: plan.references.length,
                        storageKeyCount: plan.storageKeys.length,
                    },
                });
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
    }, [uploadedMediaStoragePlan.signature]);

    // --- Comprobaciones ---
    const datasetChecks: DatasetChecks = useMemo(() => checkDatasetRows(rows), [rows]);

    // --- Carga de datos ---
    const setDatasetFromRows = useCallback(
        async (
            objs: RawRow[],
            nameHint: string | null,
            nextMediaAssets?: MediaAsset[],
            options: {
                retainManagedStorageKeys?: boolean;
                blobEntries?: DatasetStorageEntry[];
            } = {}
        ): Promise<void> => {
            await persistenceQueue.enqueue(async () => {
                const current = await readDatasetSnapshotFromIdb();
                const next = prepareDatasetRows(objs);
                const candidateMediaAssets = nextMediaAssets === undefined
                    ? deriveMediaAssetsFromRows(next)
                    : normalizeMediaAssets(nextMediaAssets, {
                        retainManagedStorageKeys: Boolean(options.retainManagedStorageKeys),
                    });
                const reconciliation = reconcileMediaAssetsWithRows(
                    next,
                    current.mediaAssets,
                    candidateMediaAssets
                );
                const snapshot = {
                    rows: next,
                    datasetName: nameHint
                        ? normalizeDatasetBaseName(nameHint)
                        : current.datasetName,
                    mediaAssets: reconciliation.mediaAssets,
                };
                const result = await commitDatasetReplacement(snapshot, {
                    blobEntries: options.blobEntries,
                    storageKeysToDelete: reconciliation.storageKeysToDelete,
                    writeEntries: (entries) => setMany(entries),
                    publish: (confirmedSnapshot) => {
                        persistenceEpochRef.current = {
                            rows: persistenceEpochRef.current.rows + 1,
                            datasetName: persistenceEpochRef.current.datasetName + 1,
                            mediaAssets: persistenceEpochRef.current.mediaAssets + 1,
                        };
                        persistedDatasetSnapshotRef.current = confirmedSnapshot;
                        setRows(confirmedSnapshot.rows);
                        setMediaAssets(confirmedSnapshot.mediaAssets);
                        setDatasetName(confirmedSnapshot.datasetName);
                        setError(null);
                        setDatasetReplacementRevision(nextDatasetReplacementRevision);
                    },
                    deleteKeys: (storageKeys) => delMany(storageKeys),
                });
                if (result.cleanupError) {
                    reportError(result.cleanupError, {
                        event: "media.blob.cleanup_failed",
                        recoverable: true,
                        metadata: {
                            storageKeyCount: reconciliation.storageKeysToDelete.length,
                        },
                    });
                }
            });
        },
        [persistenceQueue]
    );

    const importDatasetPackage = useCallback(
        async (
            file: File,
            repairs?: readonly MediaImportRepair[]
        ): Promise<boolean> => {
            if (repairs === undefined) {
                setPendingDatasetImportReview(null);
                setRawText("");
                setDetectedDelimiter(null);
                setDetectedQuotes(null);
                setError(null);
            }
            try {
                const entries = await parseZipFile(file);
                const prepared = prepareDatasetZipImport({
                    entries,
                    createRuntimeId: (purpose) => createRuntimeId(`media-imported-${purpose}`),
                    reservedStorageKeys: mediaAssets.map((asset) => asset.storageKey),
                    repairs,
                });
                if (!prepared.ok) {
                    if (prepared.review) {
                        setPendingDatasetImportReview({
                            file,
                            review: prepared.review,
                            ...(repairs === undefined
                                ? {}
                                : { resolutionError: prepared.error }),
                        });
                        setError(null);
                    } else {
                        setPendingDatasetImportReview(null);
                        setError(prepared.error);
                    }
                    return false;
                }

                setRawText(prepared.value.rawText);
                setDetectedDelimiter(prepared.value.detectedDelimiter);
                setDetectedQuotes(prepared.value.detectedQuotes);
                await setDatasetFromRows(
                    prepared.value.rows,
                    resolveImportedDatasetName({
                        currentDatasetName: datasetName,
                        fileName: file?.name,
                        payloadDatasetName: prepared.value.payloadDatasetName,
                    }),
                    prepared.value.mediaAssets,
                    {
                        retainManagedStorageKeys: true,
                        blobEntries: prepared.value.blobEntries,
                    }
                );
                setPendingDatasetImportReview(null);
                return true;
            } catch (err) {
                reportError(err, {
                    event: "import.zip.failed",
                    recoverable: true,
                    metadata: { fileSizeBytes: file.size },
                });
                setPendingDatasetImportReview(null);
                setError(`ZIP inválido: ${errorMessage(err)}`);
                return false;
            }
        },
        [datasetName, mediaAssets, setDatasetFromRows]
    );

    const applyDatasetImportRepairs = useCallback(
        async (repairs: readonly MediaImportRepair[]): Promise<boolean> => {
            if (!pendingDatasetImportReview || isApplyingDatasetImportReview) return false;

            setIsApplyingDatasetImportReview(true);
            try {
                return await importDatasetPackage(pendingDatasetImportReview.file, repairs);
            } finally {
                setIsApplyingDatasetImportReview(false);
            }
        }, [
            importDatasetPackage,
            isApplyingDatasetImportReview,
            pendingDatasetImportReview,
        ]
    );

    const cancelDatasetImportReview = useCallback(() => {
        if (isApplyingDatasetImportReview) return;
        setPendingDatasetImportReview(null);
    }, [isApplyingDatasetImportReview]);

    const handleFile = useCallback(
        (file: File) => {
            const nameHint = file?.name ? file.name : null;
            if (file.name.toLowerCase().endsWith(".zip")) {
                void importDatasetPackage(file);
                return;
            }

            try {
                assertDatasetTextFileSize(file.size);
            } catch (err) {
                setRawText("");
                setError(errorMessage(err));
                return;
            }

            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const text = String(reader.result ?? "");
                    setRawText(text);
                    const format = file.name.toLowerCase().endsWith(".csv")
                        ? "csv"
                        : "json";
                    const prepared = prepareDatasetTextImport(text, format);
                    if (!prepared.ok) {
                        setError(prepared.error);
                        return;
                    }

                    setDetectedDelimiter(prepared.value.detectedDelimiter);
                    setDetectedQuotes(prepared.value.detectedQuotes);
                    await setDatasetFromRows(
                        prepared.value.rows,
                        resolveImportedDatasetName({
                            currentDatasetName: datasetName,
                            fileName: nameHint,
                            payloadDatasetName: prepared.value.payloadDatasetName,
                        }),
                        prepared.value.mediaAssets
                    );
                } catch (err) {
                    reportError(err, {
                        event: "import.text.failed",
                        recoverable: true,
                        metadata: {
                            fileSizeBytes: file.size,
                            format: file.name.toLowerCase().endsWith(".csv") ? "csv" : "json",
                        },
                    });
                    setError(`Importación: ${errorMessage(err)}`);
                }
            };
            reader.onerror = () => {
                reportError(reader.error ?? new Error("No se pudo leer el archivo."), {
                    event: "import.file.read_failed",
                    recoverable: true,
                    metadata: { fileSizeBytes: file.size },
                });
                setError("Importación: no se pudo leer el archivo.");
            };
            reader.readAsText(file, "utf-8");
        },
        [datasetName, importDatasetPackage, setDatasetFromRows]
    );

    const commitMediaAssetSnapshot = useCallback(
        async (
            mutate: (currentMediaAssets: MediaAsset[]) => MediaAssetMutationResult
        ): Promise<boolean> => {
            let attemptedBlobEntryCount = 0;
            let attemptedMediaAssetCount = 0;
            try {
                return await persistenceQueue.enqueue(async () => {
                    const confirmedBeforeCommit = persistedDatasetSnapshotRef.current;
                    const current = await readDatasetSnapshotFromIdb();
                    const mutation = mutate(current.mediaAssets);
                    if (!mutation.ok) {
                        setError(mutation.error);
                        return false;
                    }
                    attemptedBlobEntryCount = mutation.blobEntries?.length ?? 0;
                    attemptedMediaAssetCount = mutation.mediaAssets.length;
                    const reconciliation = reconcileMediaAssetsWithRows(
                        current.rows,
                        current.mediaAssets,
                        mutation.mediaAssets
                    );
                    const result = await commitDatasetReplacement(
                        {
                            ...current,
                            mediaAssets: reconciliation.mediaAssets,
                        },
                        {
                            blobEntries: mutation.blobEntries,
                            storageKeysToDelete: reconciliation.storageKeysToDelete,
                            writeEntries: (entries) => setMany(entries),
                            publish: (snapshot) => {
                                persistenceEpochRef.current.mediaAssets += 1;
                                persistedDatasetSnapshotRef.current = snapshot;
                                setRows((currentRows) => selectDatasetDomainForPublication(
                                    currentRows,
                                    confirmedBeforeCommit?.rows,
                                    snapshot.rows
                                ));
                                setDatasetName((currentName) =>
                                    selectDatasetDomainForPublication(
                                        currentName,
                                        confirmedBeforeCommit?.datasetName,
                                        snapshot.datasetName
                                    )
                                );
                                setMediaAssets((currentMediaAssets) =>
                                    selectDatasetDomainForPublication(
                                        currentMediaAssets,
                                        confirmedBeforeCommit?.mediaAssets,
                                        snapshot.mediaAssets,
                                        true
                                    )
                                );
                                setError(null);
                            },
                            deleteKeys: (storageKeys) => delMany(storageKeys),
                        }
                    );
                    if (result.cleanupError) {
                        reportError(result.cleanupError, {
                            event: "media.blob.cleanup_failed",
                            recoverable: true,
                            metadata: {
                                storageKeyCount: reconciliation.storageKeysToDelete.length,
                            },
                        });
                    }
                    return true;
                });
            } catch (err) {
                reportError(err, {
                    event: "media.snapshot.save_failed",
                    recoverable: true,
                    metadata: {
                        blobEntryCount: attemptedBlobEntryCount,
                        mediaAssetCount: attemptedMediaAssetCount,
                    },
                });
                setError(`Imagen: no se pudieron guardar los cambios. ${errorMessage(err)}`);
                return false;
            }
        },
        [persistenceQueue]
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
            const storageKey = createMediaStorageKey(id);

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

            const committed = await commitMediaAssetSnapshot((currentMediaAssets) => {
                const hasPersonAssets = currentMediaAssets.some(
                    (item) => item.personId === normalizedPersonId
                );
                return {
                    ok: true,
                    mediaAssets: ensurePrimaryMediaAssets([
                        ...currentMediaAssets,
                        { ...asset, isPrimary: !hasPersonAssets },
                    ]),
                    blobEntries: [[storageKey, file]],
                };
            });
            return committed ? id : null;
        },
        [commitMediaAssetSnapshot]
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

            return commitMediaAssetSnapshot((currentMediaAssets) => {
                const currentTarget = currentMediaAssets.find((asset) => asset.id === assetId);
                if (!currentTarget) {
                    return {
                        ok: false,
                        error: "Validación: no se ha encontrado la imagen que se quiere reemplazar.",
                    };
                }

                // Una clave nueva mantiene intacto el blob anterior hasta confirmar
                // atómicamente metadatos y contenido; la limpieza se ejecuta después.
                const storageKey = createReplacementMediaStorageKey(
                    currentTarget.storageKey,
                    () => createRuntimeId(`media-${currentTarget.personId}`)
                );
                const nextMediaAssets = ensurePrimaryMediaAssets(
                    currentMediaAssets.map((asset) => {
                        if (asset.id !== assetId) return asset;

                        const {
                            packagePath: _packagePath,
                            printPackagePath: _printPackagePath,
                            printDpi: _printDpi,
                            ...assetWithoutPackagePaths
                        } = asset;
                        const shouldUseFileNameAsTitle =
                            !asset.title?.trim() ||
                            Boolean(asset.fileName && asset.title === asset.fileName);

                        return {
                            ...assetWithoutPackagePaths,
                            kind: "uploaded-file" as const,
                            src: "",
                            storageKey,
                            title: shouldUseFileNameAsTitle ? file.name : asset.title,
                            fileName: file.name,
                            mimeType: file.type,
                            size: file.size,
                            updatedAt: new Date().toISOString(),
                        };
                    })
                );
                return {
                    ok: true,
                    mediaAssets: nextMediaAssets,
                    blobEntries: [[storageKey, file]],
                };
            });
        },
        [commitMediaAssetSnapshot, mediaAssets]
    );

    const replaceMediaAssetUrl = useCallback(
        async (assetId: string, url: string): Promise<boolean> => {
            const target = mediaAssets.find((asset) => asset.id === assetId);
            if (!target) {
                setError("Validación: no se ha encontrado la imagen que se quiere reemplazar.");
                return false;
            }

            const src = normalizeUrl(url);
            if (!src) {
                setError("Validación: falta URL de reemplazo.");
                return false;
            }

            return commitMediaAssetSnapshot((currentMediaAssets) => {
                const currentTarget = currentMediaAssets.find((asset) => asset.id === assetId);
                if (!currentTarget) {
                    return {
                        ok: false,
                        error: "Validación: no se ha encontrado la imagen que se quiere reemplazar.",
                    };
                }

                const duplicate = currentMediaAssets.some(
                    (asset) =>
                        asset.id !== assetId &&
                        asset.personId === currentTarget.personId &&
                        asset.kind === "external-url" &&
                        normalizeUrl(asset.src) === src
                );
                if (duplicate) {
                    return {
                        ok: false,
                        error: "Validación: esa URL ya está asociada a este personaje.",
                    };
                }

                const nextMediaAssets = ensurePrimaryMediaAssets(
                    currentMediaAssets.map((asset) => {
                        if (asset.id !== assetId) return asset;

                        const {
                            storageKey: _storageKey,
                            fileName: _fileName,
                            mimeType: _mimeType,
                            size: _size,
                            packagePath: _packagePath,
                            printPackagePath: _printPackagePath,
                            printDpi: _printDpi,
                            ...assetWithoutFileData
                        } = asset;
                        const shouldClearFileNameTitle =
                            Boolean(asset.fileName) && asset.title === asset.fileName;

                        return {
                            ...assetWithoutFileData,
                            kind: "external-url" as const,
                            src,
                            title: shouldClearFileNameTitle ? undefined : asset.title,
                            updatedAt: new Date().toISOString(),
                        };
                    })
                );
                return { ok: true, mediaAssets: nextMediaAssets };
            });
        },
        [commitMediaAssetSnapshot, mediaAssets]
    );

    const moveMediaAsset = useCallback(
        (personId: string | number, assetId: string, direction: "up" | "down") => {
            setMediaAssets((prev) =>
                movePersonMediaAsset(prev, personId, assetId, direction)
            );
        },
        []
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
            await commitMediaAssetSnapshot((currentMediaAssets) => ({
                ok: true,
                mediaAssets: ensurePrimaryMediaAssets(
                    currentMediaAssets.filter((asset) => asset.id !== assetId)
                ),
            }));
        },
        [commitMediaAssetSnapshot]
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

    const commitRowsWithMediaLifecycle = useCallback(
        async (mutate: (currentRows: RawRow[]) => RawRow[]): Promise<boolean> => {
            let attemptedRowCount = 0;
            try {
                return await persistenceQueue.enqueue(async () => {
                    const current = await readDatasetSnapshotFromIdb();
                    const nextRows = mutate(current.rows);
                    if (nextRows === current.rows) return true;
                    attemptedRowCount = nextRows.length;
                    const reconciliation = reconcileMediaAssetsWithRows(
                        nextRows,
                        current.mediaAssets
                    );
                    const confirmedBeforeCommit = persistedDatasetSnapshotRef.current;
                    const result = await commitDatasetReplacement(
                        {
                            ...current,
                            rows: nextRows,
                            mediaAssets: reconciliation.mediaAssets,
                        },
                        {
                            storageKeysToDelete: reconciliation.storageKeysToDelete,
                            writeEntries: (entries) => setMany(entries),
                            publish: (snapshot) => {
                                persistenceEpochRef.current.rows += 1;
                                persistenceEpochRef.current.mediaAssets += 1;
                                persistedDatasetSnapshotRef.current = snapshot;
                                setRows(snapshot.rows);
                                setDatasetName((currentName) =>
                                    selectDatasetDomainForPublication(
                                        currentName,
                                        confirmedBeforeCommit?.datasetName,
                                        snapshot.datasetName
                                    )
                                );
                                setMediaAssets((currentMediaAssets) => {
                                    const selectedMediaAssets = selectDatasetDomainForPublication(
                                        currentMediaAssets,
                                        confirmedBeforeCommit?.mediaAssets,
                                        snapshot.mediaAssets
                                    );
                                    if (selectedMediaAssets === snapshot.mediaAssets) {
                                        return selectedMediaAssets;
                                    }
                                    return reconcileMediaAssetsWithRows(
                                        snapshot.rows,
                                        selectedMediaAssets,
                                        selectedMediaAssets
                                    ).mediaAssets;
                                });
                                setError(null);
                            },
                            deleteKeys: (storageKeys) => delMany(storageKeys),
                        }
                    );
                    if (result.cleanupError) {
                        reportError(result.cleanupError, {
                            event: "media.person.cleanup_failed",
                            recoverable: true,
                            metadata: {
                                storageKeyCount: reconciliation.storageKeysToDelete.length,
                            },
                        });
                    }
                    return true;
                });
            } catch (err) {
                reportError(err, {
                    event: "persistence.dataset.save_failed",
                    recoverable: true,
                    metadata: { rowCount: attemptedRowCount },
                });
                setError(`Persistencia: no se pudieron guardar los cambios. ${errorMessage(err)}`);
                return false;
            }
        },
        [persistenceQueue]
    );

    // --- Edición ---
    const commitPersonDraft = useCallback(
        async (
            pid: string,
            draft: RawRow,
            governmentRows: RawRow[]
        ): Promise<string | null> => {
            if (!pid) return "Validación: falta PersonID.";
            const document = createPersonEditorDocument(draft, governmentRows);
            const application = applyPersonEditorDocumentToRows(rows, pid, document);
            if (!application.ok) return `Validación: ${application.error}`;

            let latestValidationError: string | null = null;
            const committed = await commitRowsWithMediaLifecycle((currentRows) => {
                const latestApplication = applyPersonEditorDocumentToRows(
                    currentRows,
                    pid,
                    document
                );
                if (!latestApplication.ok) {
                    latestValidationError = `Validación: ${latestApplication.error}`;
                    return currentRows;
                }
                return latestApplication.value;
            });

            if (latestValidationError) return latestValidationError;
            return committed ? null : DATASET_SAVE_FAILURE_MESSAGE;
        },
        [commitRowsWithMediaLifecycle, rows]
    );

    const commitRowDraft = useCallback(
        async (rowId: string, draft: RawRow): Promise<string | null> => {
            if (!rowId) return "Validación: falta _rowId.";
            const mismatch = getReignYearMismatches(draft)[0];
            if (mismatch) return `Validación: ${reignYearMismatchMessage(mismatch)}`;

            const a = asYearOrNull(draft?.["Inicio del reinado (año)"]);
            const b = asYearOrNull(draft?.["Final del reinado (año)"]);
            if (a !== null && b !== null && a > b) return "Validación: inicio > fin.";

            let rowMissing = false;
            const committed = await commitRowsWithMediaLifecycle((currentRows) => {
                const nextRows = applyRowDraftToRows(currentRows, rowId, draft);
                rowMissing = nextRows === currentRows;
                return nextRows;
            });
            if (rowMissing) {
                return "Validación: ya no existe la fila que se estaba editando.";
            }
            return committed ? null : DATASET_SAVE_FAILURE_MESSAGE;
        },
        [commitRowsWithMediaLifecycle]
    );

    const addRowForPerson = useCallback(
        (personId: string | number, baseRow: RawRow) => {
            const id = createRuntimeId("government");
            const newRow: RawRow = {
                ID: id,
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
            const withId = {
                ...computeDerivedRow(newRow),
                _rowId: id,
            };
            setRows((prev) => [withId, ...prev]);
        },
        []
    );

    const addPerson = useCallback((): { personId: string; row: RawRow } => {
        const numericIds = rows
            .map((r) => Number(getPersonId(r)))
            .filter((n) => Number.isFinite(n));
        const personId = String((numericIds.length ? Math.max(...numericIds) : 0) + 1);

        const id = createRuntimeId("government");
        const newRow: RawRow = {
            ID: id,
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
        const withId: RawRow = {
            ...computeDerivedRow(newRow),
            _rowId: id,
        };
        setRows((prev) => [withId, ...prev]);
        return { personId, row: withId };
    }, [rows]);

    const removeRow = useCallback((rowId: string) => {
        void commitRowsWithMediaLifecycle((currentRows) =>
            removeRowById(currentRows, rowId)
        );
    }, [commitRowsWithMediaLifecycle]);

    const removePerson = useCallback((personId: string) => {
        void commitRowsWithMediaLifecycle((currentRows) => {
            const nextRows = currentRows.filter(
                (row) => String(getPersonId(row)) !== personId
            );
            return nextRows.length === currentRows.length ? currentRows : nextRows;
        });
    }, [commitRowsWithMediaLifecycle]);

    // --- Exportación ---
    const exportDatasetPackage = useCallback(async (printProfile: ImagePrintResolutionProfile = "original") => {
        try {
            const result = await prepareDatasetZipExport({
                rows,
                mediaAssets,
                datasetName,
                printProfile,
                readMediaBlobs: (storageKeys) => getMany<unknown>([...storageKeys]),
            });

            downloadBlobFile(result.fileName, datasetZipExportBlob(result));
            setError(datasetZipExportWarning(result));
        } catch (err) {
            reportError(err, {
                event: "export.zip.failed",
                recoverable: true,
                metadata: {
                    mediaAssetCount: mediaAssets.length,
                    printProfile,
                    rowCount: rows.length,
                },
            });
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
        pendingDatasetImportReview,
        isApplyingDatasetImportReview,
        applyDatasetImportRepairs,
        cancelDatasetImportReview,
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
        replaceMediaAssetUrl,
        moveMediaAsset,
        updateMediaAsset,
        removeMediaAsset,
        setPrimaryMediaAsset,
        exportDatasetPackage,
        exportCsv,
        hydrationStatus,
        idbLoaded,
        datasetReplacementRevision,
    };
}
