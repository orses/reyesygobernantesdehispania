import { describe, expect, it } from "vitest";
import {
    MEDIA_BLOB_KEY_PREFIX,
    createReplacementMediaStorageKey,
    createUploadedMediaStoragePlan,
    findOrphanMediaStorageKeys,
    isManagedMediaStorageKey,
    normalizeMediaAssets,
    reconcileMediaAssetsWithRows,
} from "./media-lifecycle";
import { removeRowById } from "./dataset-rows";
import type { MediaAsset, RawRow } from "./types";

function uploaded(
    id: string,
    personId: string,
    storageKey = `${MEDIA_BLOB_KEY_PREFIX}${id}`,
    isPrimary = false
): MediaAsset {
    return {
        id,
        personId,
        kind: "uploaded-file",
        src: "",
        storageKey,
        rightsStatus: "unknown",
        isPrimary,
        createdAt: "2026-01-01T00:00:00.000Z",
    };
}

function external(id: string, personId: string): MediaAsset {
    return {
        id,
        personId,
        kind: "external-url",
        src: `https://img.test/${id}.jpg`,
        rightsStatus: "unknown",
        isPrimary: false,
        createdAt: "2026-01-01T00:00:00.000Z",
    };
}

describe("ciclo de vida de medios", () => {
    it("conserva la galería si queda otro gobierno del personaje", () => {
        const rows: RawRow[] = [
            { PersonID: "1", _rowId: "gobierno-1" },
            { PersonID: "1", _rowId: "gobierno-2" },
        ];
        const assets = [uploaded("a", "1", undefined, true)];
        const remainingRows = removeRowById(rows, "gobierno-1");

        const result = reconcileMediaAssetsWithRows(remainingRows, assets);

        expect(remainingRows).toEqual([{ PersonID: "1", _rowId: "gobierno-2" }]);
        expect(result.mediaAssets).toEqual(assets);
        expect(result.storageKeysToDelete).toEqual([]);
    });

    it("elimina metadatos y blob al desaparecer la última fila", () => {
        const rows: RawRow[] = [{ PersonID: "1", _rowId: "último-gobierno" }];
        const assets = [uploaded("a", "1")];
        const remainingRows = removeRowById(rows, "último-gobierno");
        const result = reconcileMediaAssetsWithRows(remainingRows, assets);

        expect(remainingRows).toEqual([]);
        expect(result.mediaAssets).toEqual([]);
        expect(result.storageKeysToDelete).toEqual([`${MEDIA_BLOB_KEY_PREFIX}a`]);
    });

    it("no genera borrados para imágenes externas ni claves ajenas", () => {
        const result = reconcileMediaAssetsWithRows([], [
            external("externa", "1"),
            uploaded("manipulada", "1", "reyes_dataset_rows"),
        ]);

        expect(result.storageKeysToDelete).toEqual([]);
        expect(isManagedMediaStorageKey("reyes_dataset_rows")).toBe(false);
    });

    it("no borra una clave compartida por un medio que continúa activo", () => {
        const sharedKey = `${MEDIA_BLOB_KEY_PREFIX}compartida`;
        const previous = [
            uploaded("a", "1", sharedKey),
            uploaded("b", "2", sharedKey),
        ];

        const result = reconcileMediaAssetsWithRows(
            [{ PersonID: "2" }],
            previous,
            [previous[1]]
        );

        expect(result.storageKeysToDelete).toEqual([]);
    });

    it("deduplica las claves que deben borrarse", () => {
        const key = `${MEDIA_BLOB_KEY_PREFIX}repetida`;
        const result = reconcileMediaAssetsWithRows([], [
            uploaded("a", "1", key),
            uploaded("b", "1", key),
        ]);

        expect(result.storageKeysToDelete).toEqual([key]);
    });

    it("descarta medios de personajes inexistentes y reasigna la principal", () => {
        const result = reconcileMediaAssetsWithRows(
            [{ PersonID: "1" }],
            [uploaded("anterior", "1", undefined, true), uploaded("siguiente", "1")],
            [uploaded("siguiente", "1"), external("huérfana", "2")]
        );

        expect(result.mediaAssets).toHaveLength(1);
        expect(result.mediaAssets[0]).toMatchObject({ id: "siguiente", isPrimary: true });
        expect(result.storageKeysToDelete).toEqual([`${MEDIA_BLOB_KEY_PREFIX}anterior`]);
    });

    it("impide que la reutilización de PersonID recupere medios borrados", () => {
        const removed = reconcileMediaAssetsWithRows([], [uploaded("antigua", "7")]);
        const recreated = reconcileMediaAssetsWithRows(
            [{ PersonID: "7" }],
            removed.mediaAssets
        );

        expect(recreated.mediaAssets).toEqual([]);
    });

    it("no muta las filas ni los medios de entrada", () => {
        const rows: RawRow[] = [{ PersonID: "1" }];
        const assets = [uploaded("a", "1")];
        const rowsSnapshot = structuredClone(rows);
        const assetsSnapshot = structuredClone(assets);

        reconcileMediaAssetsWithRows(rows, assets);

        expect(rows).toEqual(rowsSnapshot);
        expect(assets).toEqual(assetsSnapshot);
    });
});

describe("normalización y saneamiento de almacenamiento multimedia", () => {
    it("descarta storageKey de una importación JSON aunque parezca gestionada", () => {
        const [asset] = normalizeMediaAssets(
            [uploaded("a", "1", `${MEDIA_BLOB_KEY_PREFIX}existente`)],
            { retainManagedStorageKeys: false }
        );

        expect(asset.storageKey).toBeUndefined();
    });

    it("solo conserva claves gestionadas al restaurar IndexedDB", () => {
        const result = normalizeMediaAssets([
            uploaded("válida", "1"),
            uploaded("inválida", "1", "reyes_dataset_rows"),
        ], { retainManagedStorageKeys: true });

        expect(result[0].storageKey).toBe(`${MEDIA_BLOB_KEY_PREFIX}válida`);
        expect(result[1].storageKey).toBeUndefined();
    });

    it("localiza únicamente blobs gestionados que no tienen metadatos activos", () => {
        const active = [uploaded("activa", "1")];

        expect(findOrphanMediaStorageKeys([
            "reyes_dataset_rows",
            `${MEDIA_BLOB_KEY_PREFIX}activa`,
            `${MEDIA_BLOB_KEY_PREFIX}huérfana`,
            `${MEDIA_BLOB_KEY_PREFIX}huérfana`,
        ], active)).toEqual([`${MEDIA_BLOB_KEY_PREFIX}huérfana`]);
    });
});

describe("plan de vistas previas multimedia", () => {
    it("permanece estable cuando solo cambian metadatos u orden visual", () => {
        const first = uploaded("a", "1");
        const second = uploaded("b", "1");
        const original = createUploadedMediaStoragePlan([first, second]);
        const metadataChanged = createUploadedMediaStoragePlan([
            { ...second, title: "Título nuevo", rightsStatus: "licensed" },
            { ...first, author: "Autor nuevo" },
        ]);

        expect(metadataChanged.signature).toBe(original.signature);
        expect(metadataChanged.references).toEqual(original.references);
    });

    it("cambia cuando se sustituye un identificador o una clave binaria", () => {
        const original = createUploadedMediaStoragePlan([uploaded("a", "1")]);
        const replaced = createUploadedMediaStoragePlan([
            uploaded("a", "1", `${MEDIA_BLOB_KEY_PREFIX}nueva`),
        ]);

        expect(replaced.signature).not.toBe(original.signature);
    });

    it("ignora medios externos y claves que no pertenecen al almacén gestionado", () => {
        const plan = createUploadedMediaStoragePlan([
            external("externa", "1"),
            uploaded("ajena", "1", "otra_clave"),
        ]);

        expect(plan).toEqual({ references: [], storageKeys: [], signature: "[]" });
    });

    it("deduplica lecturas aunque dos activos compartan la misma clave", () => {
        const sharedKey = `${MEDIA_BLOB_KEY_PREFIX}compartida`;
        const plan = createUploadedMediaStoragePlan([
            uploaded("a", "1", sharedKey),
            uploaded("b", "2", sharedKey),
        ]);

        expect(plan.references).toHaveLength(2);
        expect(plan.storageKeys).toEqual([sharedKey]);
    });
});

describe("reemplazo transaccional de blobs", () => {
    it("reserva una clave distinta aunque el generador repita primero la actual", () => {
        const generatedIds = ["actual", "nueva"];

        const storageKey = createReplacementMediaStorageKey(
            `${MEDIA_BLOB_KEY_PREFIX}actual`,
            () => generatedIds.shift() ?? "otra"
        );

        expect(storageKey).toBe(`${MEDIA_BLOB_KEY_PREFIX}nueva`);
    });

    it("falla de forma explícita si no puede obtener una clave nueva", () => {
        expect(() => createReplacementMediaStorageKey(
            `${MEDIA_BLOB_KEY_PREFIX}repetida`,
            () => "repetida"
        )).toThrow(/reservar una clave nueva/);
    });
});
