import { deriveMediaAssetsFromRows } from "./media";
import {
    findOrphanMediaStorageKeys,
    normalizeMediaAssets,
    reconcileMediaAssetsWithRows,
    type MediaReconciliation,
} from "./media-lifecycle";
import { normalizeDatasetBaseName } from "./dataset-package";
import { prepareDatasetRows } from "./dataset-rows";
import type { MediaAsset, RawRow } from "./types";

export interface RestoreDatasetStateInput {
    sampleRows: readonly RawRow[];
    storedRows?: RawRow[];
    storedMediaAssets?: MediaAsset[];
}

export interface RestoredDatasetState extends MediaReconciliation {
    rows: RawRow[];
}

export interface DatasetSnapshot {
    rows: RawRow[];
    datasetName: string;
    mediaAssets: MediaAsset[];
}

export interface DatasetPersistenceDomains {
    rows: boolean;
    datasetName: boolean;
    mediaAssets: boolean;
}

export interface DatasetPersistenceEpochs {
    rows: number;
    datasetName: number;
    mediaAssets: number;
}

export const DATASET_ROWS_STORAGE_KEY = "reyes_dataset_rows";
export const DATASET_NAME_STORAGE_KEY = "reyes_dataset_name";
export const MEDIA_ASSETS_STORAGE_KEY = "reyes_media_assets";

export type DatasetStorageEntry = [IDBValidKey, unknown];
export type DatasetStorageValues = readonly [unknown, unknown, unknown];

export type PersistenceLockRunner = <T>(task: () => Promise<T>) => Promise<T>;

export interface PersistenceTaskQueue {
    enqueue<T>(task: () => Promise<T>): Promise<T>;
    idle(): Promise<void>;
}

export const DATASET_STORAGE_LOCK_NAME = "gobernantes-hispanos:dataset-storage";

export interface HydrateDatasetPersistenceOptions {
    sampleRows: readonly RawRow[];
    readEntries: () => Promise<DatasetStorageValues>;
    listKeys: () => Promise<readonly IDBValidKey[]>;
    writeEntries: (entries: DatasetStorageEntry[]) => Promise<void>;
    deleteKeys: (storageKeys: string[]) => Promise<void>;
}

export type DatasetHydrationResult =
    | {
        ok: true;
        snapshot: DatasetSnapshot;
        cleanupError: unknown | null;
    }
    | {
        ok: false;
        error: unknown;
    };

export interface CommitDatasetReplacementOptions {
    blobEntries?: DatasetStorageEntry[];
    storageKeysToDelete?: string[];
    writeEntries: (entries: DatasetStorageEntry[]) => Promise<void>;
    publish: (snapshot: DatasetSnapshot) => void;
    deleteKeys: (storageKeys: string[]) => Promise<void>;
}

/** Serializa tareas locales y permite envolverlas con una exclusión entre pestañas. */
export function createPersistenceTaskQueue(
    runWithLock: PersistenceLockRunner = async (task) => task()
): PersistenceTaskQueue {
    let tail: Promise<void> = Promise.resolve();

    return {
        enqueue<T>(task: () => Promise<T>): Promise<T> {
            const result = tail.then(() => runWithLock(task));
            tail = result.then(
                () => undefined,
                () => undefined
            );
            return result;
        },
        idle(): Promise<void> {
            return tail;
        },
    };
}

/** Usa Web Locks si existe y mantiene una alternativa funcional en navegadores antiguos. */
export const runWithDatasetStorageLock: PersistenceLockRunner = async (task) => {
    const lockManager = typeof navigator === "undefined" ? undefined : navigator.locks;
    if (!lockManager) return task();
    return lockManager.request(
        DATASET_STORAGE_LOCK_NAME,
        { mode: "exclusive" },
        task
    );
};

export function datasetSnapshotStorageEntries(snapshot: DatasetSnapshot): DatasetStorageEntry[] {
    return [
        [DATASET_ROWS_STORAGE_KEY, snapshot.rows],
        [DATASET_NAME_STORAGE_KEY, snapshot.datasetName],
        [MEDIA_ASSETS_STORAGE_KEY, snapshot.mediaAssets],
    ];
}

/** Descarta únicamente los dominios reactivos invalidados por un commit posterior. */
export function resolvePersistableDatasetDomains(
    changedDomains: DatasetPersistenceDomains,
    scheduledEpoch: DatasetPersistenceEpochs,
    currentEpoch: DatasetPersistenceEpochs
): DatasetPersistenceDomains {
    return {
        rows: changedDomains.rows && scheduledEpoch.rows === currentEpoch.rows,
        datasetName:
            changedDomains.datasetName &&
            scheduledEpoch.datasetName === currentEpoch.datasetName,
        mediaAssets:
            changedDomains.mediaAssets &&
            scheduledEpoch.mediaAssets === currentEpoch.mediaAssets,
    };
}

/** Aplica al último snapshot confirmado solo los dominios reactivos aún vigentes. */
export function mergeDatasetSnapshotDomains(
    latest: DatasetSnapshot,
    pending: DatasetSnapshot,
    domains: DatasetPersistenceDomains
): DatasetSnapshot {
    return {
        rows: domains.rows ? pending.rows : latest.rows,
        datasetName: domains.datasetName ? pending.datasetName : latest.datasetName,
        mediaAssets: domains.mediaAssets ? pending.mediaAssets : latest.mediaAssets,
    };
}

/**
 * Adopta un valor confirmado externamente si el valor local no se ha editado;
 * un cambio local pendiente solo se conserva en los dominios no forzados.
 */
export function selectDatasetDomainForPublication<T>(
    currentLocal: T,
    lastConfirmed: T | undefined,
    committed: T,
    forceCommitted = false
): T {
    if (forceCommitted || lastConfirmed === undefined || currentLocal === lastConfirmed) {
        return committed;
    }
    return currentLocal;
}

export function restoreDatasetSnapshotFromStorage(
    sampleRows: readonly RawRow[],
    [storedRowsValue, storedNameValue, storedMediaAssetsValue]: DatasetStorageValues
): RestoredDatasetState & { datasetName: string } {
    if (storedRowsValue !== undefined && !Array.isArray(storedRowsValue)) {
        throw new Error("Las filas persistidas no tienen un formato válido.");
    }
    if (storedMediaAssetsValue !== undefined && !Array.isArray(storedMediaAssetsValue)) {
        throw new Error("Los medios persistidos no tienen un formato válido.");
    }

    return {
        ...restoreDatasetState({
            sampleRows,
            storedRows: storedRowsValue as RawRow[] | undefined,
            storedMediaAssets: storedMediaAssetsValue as MediaAsset[] | undefined,
        }),
        datasetName:
            typeof storedNameValue === "string" && storedNameValue.trim()
                ? normalizeDatasetBaseName(storedNameValue)
                : "datos",
    };
}

/** Lee, repara y persiste una hidratación válida antes de efectuar la limpieza. */
export async function hydrateDatasetPersistence({
    sampleRows,
    readEntries,
    listKeys,
    writeEntries,
    deleteKeys,
}: HydrateDatasetPersistenceOptions): Promise<DatasetHydrationResult> {
    let restored: RestoredDatasetState & { datasetName: string };
    try {
        restored = restoreDatasetSnapshotFromStorage(sampleRows, await readEntries());
        const snapshot: DatasetSnapshot = {
            rows: restored.rows,
            datasetName: restored.datasetName,
            mediaAssets: restored.mediaAssets,
        };
        await writeEntries(datasetSnapshotStorageEntries(snapshot));

        let cleanupError: unknown | null = null;
        try {
            const orphanStorageKeys = findOrphanMediaStorageKeys(
                await listKeys(),
                snapshot.mediaAssets
            );
            const storageKeysToDelete = Array.from(new Set([
                ...restored.storageKeysToDelete,
                ...orphanStorageKeys,
            ]));
            if (storageKeysToDelete.length > 0) await deleteKeys(storageKeysToDelete);
        } catch (error) {
            cleanupError = error;
        }

        return { ok: true, snapshot, cleanupError };
    } catch (error) {
        return { ok: false, error };
    }
}

/**
 * Devuelve solo las entradas cuyo valor de estado cambió por identidad. React
 * conserva la referencia de los arrays no modificados, por lo que editar un
 * nombre o metadato no obliga a clonar y reescribir todo el dataset.
 */
export function getChangedDatasetStorageEntries(
    previous: DatasetSnapshot | null,
    next: DatasetSnapshot
): DatasetStorageEntry[] {
    const entries: DatasetStorageEntry[] = [];
    if (!previous || previous.rows !== next.rows) {
        entries.push([DATASET_ROWS_STORAGE_KEY, next.rows]);
    }
    if (!previous || previous.datasetName !== next.datasetName) {
        entries.push([DATASET_NAME_STORAGE_KEY, next.datasetName]);
    }
    if (!previous || previous.mediaAssets !== next.mediaAssets) {
        entries.push([MEDIA_ASSETS_STORAGE_KEY, next.mediaAssets]);
    }
    return entries;
}

/**
 * Restaura el snapshot local distinguiendo entre una clave ausente y un array
 * vacío persistido deliberadamente.
 */
export function restoreDatasetState({
    sampleRows,
    storedRows,
    storedMediaAssets,
}: RestoreDatasetStateInput): RestoredDatasetState {
    const rows = prepareDatasetRows(storedRows === undefined ? sampleRows : storedRows);
    const candidateAssets = storedMediaAssets === undefined
        ? deriveMediaAssetsFromRows(rows)
        : normalizeMediaAssets(storedMediaAssets, { retainManagedStorageKeys: true });
    const reconciliation = reconcileMediaAssetsWithRows(
        rows,
        candidateAssets,
        candidateAssets
    );

    return {
        rows,
        ...reconciliation,
    };
}

/**
 * Confirma una sustitución antes de publicarla y deja la limpieza destructiva
 * para el final. Un fallo de limpieza solo puede producir blobs huérfanos.
 */
export async function commitDatasetReplacement(
    snapshot: DatasetSnapshot,
    {
        blobEntries = [],
        storageKeysToDelete = [],
        writeEntries,
        publish,
        deleteKeys,
    }: CommitDatasetReplacementOptions
): Promise<{ cleanupError: unknown | null }> {
    await writeEntries([...datasetSnapshotStorageEntries(snapshot), ...blobEntries]);
    publish(snapshot);

    if (storageKeysToDelete.length === 0) {
        return { cleanupError: null };
    }

    try {
        await deleteKeys(storageKeysToDelete);
        return { cleanupError: null };
    } catch (cleanupError) {
        return { cleanupError };
    }
}
