import { getPersonId, normalizeUrl } from "./data";
import { ensurePrimaryMediaAssets, normalizeRightsStatus } from "./media";
import type { MediaAsset, RawRow } from "./types";

export const MEDIA_BLOB_KEY_PREFIX = "reyes_media_blob_";

export interface NormalizeMediaAssetsOptions {
    retainManagedStorageKeys: boolean;
}

export interface MediaReconciliation {
    mediaAssets: MediaAsset[];
    storageKeysToDelete: string[];
}

export interface UploadedMediaStorageReference {
    assetId: string;
    storageKey: string;
}

export interface UploadedMediaStoragePlan {
    references: UploadedMediaStorageReference[];
    storageKeys: string[];
    signature: string;
}

export function isManagedMediaStorageKey(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.startsWith(MEDIA_BLOB_KEY_PREFIX) &&
        value.length > MEDIA_BLOB_KEY_PREFIX.length
    );
}

export function createMediaStorageKey(id: string): string {
    return `${MEDIA_BLOB_KEY_PREFIX}${id}`;
}

/** Reserva para un reemplazo una clave distinta de la que continúa activa. */
export function createReplacementMediaStorageKey(
    currentStorageKey: unknown,
    createId: () => string
): string {
    for (let attempt = 0; attempt < 100; attempt++) {
        const candidate = createMediaStorageKey(createId());
        if (candidate !== currentStorageKey) return candidate;
    }
    throw new Error("No se pudo reservar una clave nueva para reemplazar el medio.");
}

/**
 * Genera el plan mínimo para cargar vistas previas. La firma solo depende del
 * identificador y de la clave binaria, no de títulos, derechos ni orden visual.
 */
export function createUploadedMediaStoragePlan(
    assets: readonly MediaAsset[]
): UploadedMediaStoragePlan {
    const references = assets
        .filter(
            (asset) => asset.kind === "uploaded-file" &&
                isManagedMediaStorageKey(asset.storageKey)
        )
        .map((asset) => ({
            assetId: asset.id,
            storageKey: asset.storageKey as string,
        }))
        .sort((left, right) =>
            left.assetId.localeCompare(right.assetId) ||
            left.storageKey.localeCompare(right.storageKey)
        );

    return {
        references,
        storageKeys: Array.from(new Set(references.map((item) => item.storageKey))),
        signature: JSON.stringify(references),
    };
}

/**
 * Sanea metadatos persistidos o importados. Las claves de blobs solo se retienen
 * cuando proceden explícitamente del almacén local o de una restauración preparada.
 */
export function normalizeMediaAssets(
    assets: readonly MediaAsset[],
    options: NormalizeMediaAssetsOptions
): MediaAsset[] {
    const normalized = assets
        .map((asset): MediaAsset => {
            const kind: MediaAsset["kind"] =
                asset.kind === "uploaded-file" ? "uploaded-file" : "external-url";
            const storageKey =
                kind === "uploaded-file" &&
                options.retainManagedStorageKeys &&
                isManagedMediaStorageKey(asset.storageKey)
                    ? asset.storageKey
                    : undefined;
            const { storageKey: _untrustedStorageKey, ...rest } = asset;

            return {
                ...rest,
                id: String(asset.id ?? "").trim(),
                personId: String(asset.personId ?? "").trim(),
                kind,
                src: kind === "external-url" ? normalizeUrl(asset.src) : "",
                ...(storageKey ? { storageKey } : {}),
                rightsStatus: normalizeRightsStatus(asset.rightsStatus),
                isPrimary: Boolean(asset.isPrimary),
                createdAt: String(asset.createdAt ?? new Date(0).toISOString()),
            };
        })
        .filter((asset) => asset.id && asset.personId && (
            asset.kind === "uploaded-file" || Boolean(asset.src)
        ));

    return ensurePrimaryMediaAssets(normalized);
}

export function getObsoleteMediaStorageKeys(
    previousAssets: readonly MediaAsset[],
    nextAssets: readonly MediaAsset[]
): string[] {
    const activeKeys = new Set(
        nextAssets
            .map((asset) => asset.storageKey)
            .filter(isManagedMediaStorageKey)
    );
    return Array.from(new Set(
        previousAssets
            .map((asset) => asset.storageKey)
            .filter(isManagedMediaStorageKey)
            .filter((storageKey) => !activeKeys.has(storageKey))
    ));
}

/** Elimina de la galería los medios cuyos personajes ya no existen. */
export function reconcileMediaAssetsWithRows(
    rows: readonly RawRow[],
    previousAssets: readonly MediaAsset[],
    candidateAssets: readonly MediaAsset[] = previousAssets
): MediaReconciliation {
    const personIds = new Set(
        rows.map(getPersonId).map((personId) => personId.trim()).filter(Boolean)
    );
    const retainedAssets = candidateAssets
        .filter((asset) => personIds.has(String(asset.personId ?? "").trim()))
        .map((asset) => ({
            ...asset,
            personId: String(asset.personId ?? "").trim(),
        }));
    const mediaAssets = ensurePrimaryMediaAssets(retainedAssets);

    return {
        mediaAssets,
        storageKeysToDelete: getObsoleteMediaStorageKeys(
            [...previousAssets, ...candidateAssets],
            mediaAssets
        ),
    };
}

/** Localiza blobs gestionados que ya no aparecen en los metadatos activos. */
export function findOrphanMediaStorageKeys(
    persistedKeys: readonly IDBValidKey[],
    activeAssets: readonly MediaAsset[]
): string[] {
    const activeKeys = new Set(
        activeAssets
            .map((asset) => asset.storageKey)
            .filter(isManagedMediaStorageKey)
    );
    return Array.from(new Set(
        persistedKeys
            .filter(isManagedMediaStorageKey)
            .filter((storageKey) => !activeKeys.has(storageKey))
    ));
}
