import { describe, expect, it, vi } from "vitest";
import {
    DATASET_STORAGE_LOCK_NAME,
    DATASET_NAME_STORAGE_KEY,
    DATASET_ROWS_STORAGE_KEY,
    MEDIA_ASSETS_STORAGE_KEY,
    commitDatasetReplacement,
    createPersistenceTaskQueue,
    getChangedDatasetStorageEntries,
    hydrateDatasetPersistence,
    mergeDatasetSnapshotDomains,
    resolvePersistableDatasetDomains,
    restoreDatasetState,
    runWithDatasetStorageLock,
    selectDatasetDomainForPublication,
} from "./dataset-persistence";
import type { MediaAsset, RawRow } from "./types";

const sampleRows: RawRow[] = [{
    ID: "muestra",
    PersonID: "1",
    Nombre: "Muestra",
    "Imagen URL": "https://img.test/muestra.jpg",
}];

function uploaded(storageKey: string): MediaAsset {
    return {
        id: "media-1",
        personId: "1",
        kind: "uploaded-file",
        src: "",
        storageKey,
        rightsStatus: "unknown",
        isPrimary: true,
        createdAt: "2026-01-01T00:00:00.000Z",
    };
}

describe("restauración del estado persistido", () => {
    it("usa la muestra solo cuando aún no existe un estado de filas", () => {
        const result = restoreDatasetState({ sampleRows });

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]._rowId).toBe("muestra");
    });

    it("respeta un conjunto de filas vacío y no resucita la muestra", () => {
        const result = restoreDatasetState({ sampleRows, storedRows: [] });

        expect(result.rows).toEqual([]);
        expect(result.mediaAssets).toEqual([]);
    });

    it("respeta una galería vacía y no vuelve a derivarla desde las columnas", () => {
        const result = restoreDatasetState({
            sampleRows,
            storedRows: sampleRows,
            storedMediaAssets: [],
        });

        expect(result.mediaAssets).toEqual([]);
    });

    it("deriva la galería únicamente si nunca se ha persistido", () => {
        const result = restoreDatasetState({ sampleRows, storedRows: sampleRows });

        expect(result.mediaAssets).toHaveLength(1);
        expect(result.mediaAssets[0].src).toBe("https://img.test/muestra.jpg");
    });

    it("descarta una clave de almacenamiento ajena durante la restauración", () => {
        const result = restoreDatasetState({
            sampleRows,
            storedRows: sampleRows,
            storedMediaAssets: [uploaded("reyes_dataset_rows")],
        });

        expect(result.mediaAssets[0].storageKey).toBeUndefined();
    });
});

describe("sustitución transaccional del conjunto", () => {
    const snapshot = {
        rows: [{ PersonID: "1", _rowId: "fila-1" }],
        datasetName: "prueba",
        mediaAssets: [] as MediaAsset[],
    };

    it("persiste, publica y limpia en ese orden", async () => {
        const calls: string[] = [];

        const result = await commitDatasetReplacement(snapshot, {
            blobEntries: [["reyes_media_blob_nueva", new Blob(["imagen"]) ]],
            storageKeysToDelete: ["reyes_media_blob_anterior"],
            writeEntries: async (entries) => {
                calls.push(`escribir:${entries.length}`);
            },
            publish: () => {
                calls.push("publicar");
            },
            deleteKeys: async (storageKeys) => {
                calls.push(`limpiar:${storageKeys.length}`);
            },
        });

        expect(calls).toEqual(["escribir:4", "publicar", "limpiar:1"]);
        expect(result).toEqual({ cleanupError: null });
    });

    it("no publica ni limpia cuando falla la escritura atómica", async () => {
        const calls: string[] = [];

        await expect(commitDatasetReplacement(snapshot, {
            writeEntries: async () => {
                calls.push("escribir");
                throw new Error("fallo de escritura");
            },
            publish: () => {
                calls.push("publicar");
            },
            deleteKeys: async () => {
                calls.push("limpiar");
            },
        })).rejects.toThrow("fallo de escritura");
        expect(calls).toEqual(["escribir"]);
    });

    it("mantiene publicado el estado si solo falla la limpieza recuperable", async () => {
        const calls: string[] = [];
        const cleanupFailure = new Error("fallo de limpieza");

        const result = await commitDatasetReplacement(snapshot, {
            storageKeysToDelete: ["reyes_media_blob_anterior"],
            writeEntries: async () => {
                calls.push("escribir");
            },
            publish: () => {
                calls.push("publicar");
            },
            deleteKeys: async () => {
                calls.push("limpiar");
                throw cleanupFailure;
            },
        });

        expect(calls).toEqual(["escribir", "publicar", "limpiar"]);
        expect(result.cleanupError).toBe(cleanupFailure);
    });
});

describe("persistencia diferencial", () => {
    const rows: RawRow[] = [{ PersonID: "1" }];
    const mediaAssets = [uploaded("reyes_media_blob_uno")];
    const snapshot = { rows, datasetName: "Gobernantes", mediaAssets };

    it("escribe el snapshot completo cuando aún no existe una referencia confirmada", () => {
        expect(getChangedDatasetStorageEntries(null, snapshot).map(([key]) => key)).toEqual([
            DATASET_ROWS_STORAGE_KEY,
            DATASET_NAME_STORAGE_KEY,
            MEDIA_ASSETS_STORAGE_KEY,
        ]);
    });

    it("no escribe nada si se vuelve a publicar el mismo snapshot", () => {
        expect(getChangedDatasetStorageEntries(snapshot, snapshot)).toEqual([]);
    });

    it("escribe solo el nombre cuando no cambian filas ni medios", () => {
        const entries = getChangedDatasetStorageEntries(snapshot, {
            ...snapshot,
            datasetName: "Reyes",
        });

        expect(entries).toEqual([[DATASET_NAME_STORAGE_KEY, "Reyes"]]);
    });

    it("distingue cambios independientes y coordinados de filas y medios", () => {
        const nextRows = [...rows, { PersonID: "2" }];
        const nextMediaAssets = [...mediaAssets, uploaded("reyes_media_blob_dos")];

        expect(getChangedDatasetStorageEntries(snapshot, {
            ...snapshot,
            rows: nextRows,
        }).map(([key]) => key)).toEqual([DATASET_ROWS_STORAGE_KEY]);
        expect(getChangedDatasetStorageEntries(snapshot, {
            ...snapshot,
            mediaAssets: nextMediaAssets,
        }).map(([key]) => key)).toEqual([MEDIA_ASSETS_STORAGE_KEY]);
        expect(getChangedDatasetStorageEntries(snapshot, {
            ...snapshot,
            rows: nextRows,
            mediaAssets: nextMediaAssets,
        }).map(([key]) => key)).toEqual([
            DATASET_ROWS_STORAGE_KEY,
            MEDIA_ASSETS_STORAGE_KEY,
        ]);
    });
});

describe("cola única de persistencia", () => {
    it("calcula cada mutación dentro de la sección crítica y en orden", async () => {
        const queue = createPersistenceTaskQueue();
        let releaseFirst: (() => void) | undefined;
        const firstGate = new Promise<void>((resolve) => {
            releaseFirst = resolve;
        });
        let confirmedValue = 0;

        const first = queue.enqueue(async () => {
            const current = confirmedValue;
            await firstGate;
            confirmedValue = current + 1;
        });
        const second = queue.enqueue(async () => {
            const current = confirmedValue;
            confirmedValue = current + 1;
        });

        await Promise.resolve();
        expect(confirmedValue).toBe(0);
        releaseFirst?.();
        await Promise.all([first, second]);

        expect(confirmedValue).toBe(2);
    });

    it("conserva dos commits explícitos rápidos calculados desde el último snapshot", async () => {
        const queue = createPersistenceTaskQueue();
        let confirmedRows: RawRow[] = [
            { _rowId: "fila-1", Nombre: "Uno" },
            { _rowId: "fila-2", Nombre: "Dos" },
        ];
        const commit = (mutate: (currentRows: RawRow[]) => RawRow[]) =>
            queue.enqueue(async () => {
                confirmedRows = mutate(confirmedRows);
            });

        const first = commit((currentRows) => currentRows.map((row) =>
            row._rowId === "fila-1" ? { ...row, Nombre: "Primero" } : row
        ));
        const second = commit((currentRows) => currentRows.map((row) =>
            row._rowId === "fila-2" ? { ...row, Nombre: "Segundo" } : row
        ));

        await Promise.all([first, second]);

        expect(confirmedRows.map((row) => row.Nombre)).toEqual(["Primero", "Segundo"]);
    });

    it("no queda envenenada cuando una operación falla", async () => {
        const queue = createPersistenceTaskQueue();
        const calls: string[] = [];

        await expect(queue.enqueue(async () => {
            calls.push("fallo");
            throw new Error("escritura fallida");
        })).rejects.toThrow("escritura fallida");
        await queue.enqueue(async () => {
            calls.push("recuperada");
        });

        expect(calls).toEqual(["fallo", "recuperada"]);
    });

    it("envuelve todas las tareas con el bloqueo proporcionado", async () => {
        const calls: string[] = [];
        const queue = createPersistenceTaskQueue(async (task) => {
            calls.push("bloqueo:inicio");
            const result = await task();
            calls.push("bloqueo:fin");
            return result;
        });

        await queue.enqueue(async () => {
            calls.push("tarea");
        });

        expect(calls).toEqual(["bloqueo:inicio", "tarea", "bloqueo:fin"]);
    });

    it("solicita un Web Lock exclusivo y compartido entre pestañas cuando está disponible", async () => {
        const request = vi.fn(async (
            _name: string,
            _options: LockOptions,
            callback: () => Promise<string>
        ) => callback());
        vi.stubGlobal("navigator", { locks: { request } });

        try {
            await expect(runWithDatasetStorageLock(async () => "confirmado"))
                .resolves.toBe("confirmado");
            expect(request).toHaveBeenCalledWith(
                DATASET_STORAGE_LOCK_NAME,
                { mode: "exclusive" },
                expect.any(Function)
            );
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

describe("coordinación por dominios", () => {
    const confirmedRows: RawRow[] = [{ _rowId: "fila-confirmada", Nombre: "Confirmada" }];
    const committedRows: RawRow[] = [{ _rowId: "fila-explícita", Nombre: "Explícita" }];
    const pendingRows: RawRow[] = [{ _rowId: "fila-antigua", Nombre: "Antigua" }];
    const mediaAssets = [uploaded("reyes_media_blob_uno")];
    const latest = {
        rows: committedRows,
        datasetName: "Nombre confirmado",
        mediaAssets,
    };

    it("impide que un efecto reactivo antiguo pise un commit explícito posterior", () => {
        const domains = resolvePersistableDatasetDomains(
            { rows: true, datasetName: false, mediaAssets: false },
            { rows: 4, datasetName: 2, mediaAssets: 3 },
            { rows: 5, datasetName: 2, mediaAssets: 3 }
        );
        const merged = mergeDatasetSnapshotDomains(
            latest,
            { ...latest, rows: pendingRows },
            domains
        );

        expect(domains.rows).toBe(false);
        expect(merged.rows).toBe(committedRows);
    });

    it("conserva un nombre local pendiente cuando un commit confirma filas y medios", () => {
        const domains = resolvePersistableDatasetDomains(
            { rows: true, datasetName: true, mediaAssets: true },
            { rows: 4, datasetName: 2, mediaAssets: 3 },
            { rows: 5, datasetName: 2, mediaAssets: 4 }
        );
        const merged = mergeDatasetSnapshotDomains(
            latest,
            {
                rows: pendingRows,
                datasetName: "Nombre pendiente",
                mediaAssets: [],
            },
            domains
        );

        expect(domains).toEqual({
            rows: false,
            datasetName: true,
            mediaAssets: false,
        });
        expect(merged).toEqual({
            rows: committedRows,
            datasetName: "Nombre pendiente",
            mediaAssets,
        });
    });

    it("adopta dominios externos intactos y conserva únicamente cambios locales pendientes", () => {
        const pendingName = "Nombre local pendiente";

        expect(selectDatasetDomainForPublication(
            confirmedRows,
            confirmedRows,
            committedRows
        )).toBe(committedRows);
        expect(selectDatasetDomainForPublication(
            pendingName,
            "Nombre confirmado",
            "Nombre externo"
        )).toBe(pendingName);
        expect(selectDatasetDomainForPublication(
            pendingRows,
            confirmedRows,
            committedRows,
            true
        )).toBe(committedRows);
    });
});

describe("hidratación protegida", () => {
    it("no escribe ni limpia cuando un valor persistido tiene un formato no válido", async () => {
        const writeEntries = vi.fn(async () => undefined);
        const deleteKeys = vi.fn(async () => undefined);

        const result = await hydrateDatasetPersistence({
            sampleRows,
            readEntries: async () => [sampleRows, "datos", { corrupt: true }],
            listKeys: async () => ["reyes_media_blob_existente"],
            writeEntries,
            deleteKeys,
        });

        expect(result.ok).toBe(false);
        expect(writeEntries).not.toHaveBeenCalled();
        expect(deleteKeys).not.toHaveBeenCalled();
    });

    it("persiste la normalización válida antes de limpiar blobs huérfanos", async () => {
        const calls: string[] = [];
        const writeEntries = vi.fn(async () => {
            calls.push("escribir");
        });
        const deleteKeys = vi.fn(async () => {
            calls.push("limpiar");
        });

        const result = await hydrateDatasetPersistence({
            sampleRows,
            readEntries: async () => [sampleRows, "Gobernantes", []],
            listKeys: async () => ["reyes_media_blob_huerfano"],
            writeEntries,
            deleteKeys,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.snapshot.rows[0]._rowId).toBe("muestra");
        expect(writeEntries).toHaveBeenCalledWith([
            [DATASET_ROWS_STORAGE_KEY, result.snapshot.rows],
            [DATASET_NAME_STORAGE_KEY, "Gobernantes"],
            [MEDIA_ASSETS_STORAGE_KEY, []],
        ]);
        expect(deleteKeys).toHaveBeenCalledWith(["reyes_media_blob_huerfano"]);
        expect(calls).toEqual(["escribir", "limpiar"]);
    });
});
