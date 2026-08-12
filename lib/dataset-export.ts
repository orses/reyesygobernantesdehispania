// ---------------------------------------------------------------------------
// Caso de uso puro para preparar la exportación ZIP completa del dataset.
// ---------------------------------------------------------------------------

import { uint8ArrayToArrayBuffer } from "./blob";
import {
    createDatasetPayload,
    createUploadedMediaPackage,
    getTimestampedExportFileName,
    toPortableMediaAsset,
} from "./dataset-package";
import {
    isManagedMediaStorageKey,
    reconcileMediaAssetsWithRows,
} from "./media-lifecycle";
import type { ImagePrintResolutionProfile } from "./print-resolution";
import type { MediaAsset, RawRow } from "./types";
import { createStoredZip } from "./zip";

export type MediaBlobBatchReader = (
    storageKeys: readonly string[]
) => Promise<readonly unknown[]>;

export interface PrepareDatasetZipExportInput {
    rows: readonly RawRow[];
    mediaAssets: readonly MediaAsset[];
    datasetName: string;
    exportedAt?: Date;
    printProfile?: ImagePrintResolutionProfile;
    readMediaBlobs: MediaBlobBatchReader;
}

export interface PreparedDatasetZipExport {
    data: Uint8Array;
    fileName: string;
    missingUploadedFiles: number;
    orphanedMediaAssets: number;
    skippedPrintVariants: number;
}

function uniqueManagedStorageKeys(mediaAssets: readonly MediaAsset[]): string[] {
    return Array.from(new Set(
        mediaAssets
            .filter((asset) => asset.kind === "uploaded-file")
            .map((asset) => asset.storageKey)
            .filter(isManagedMediaStorageKey)
    ));
}

/**
 * Lee los blobs en un único lote y construye un ZIP autocontenido. El JSON
 * interno se serializa de forma compacta porque el paquete usa el método STORE.
 */
export async function prepareDatasetZipExport({
    rows,
    mediaAssets,
    datasetName,
    exportedAt = new Date(),
    printProfile = "original",
    readMediaBlobs,
}: PrepareDatasetZipExportInput): Promise<PreparedDatasetZipExport> {
    const reconciliation = reconcileMediaAssetsWithRows(rows, mediaAssets);
    const exportableMediaAssets = reconciliation.mediaAssets;
    const orphanedMediaAssets = mediaAssets.length - exportableMediaAssets.length;
    const storageKeys = uniqueManagedStorageKeys(exportableMediaAssets);
    const storedValues = storageKeys.length > 0
        ? await readMediaBlobs(storageKeys)
        : [];
    if (storedValues.length !== storageKeys.length) {
        throw new Error("La lectura por lotes no devolvió un resultado por cada clave multimedia.");
    }
    const blobByStorageKey = new Map(
        storageKeys.map((storageKey, index) => [storageKey, storedValues[index]])
    );

    const portableMediaAssets: MediaAsset[] = [];
    const mediaEntries: { path: string; data: Uint8Array }[] = [];
    let missingUploadedFiles = 0;
    let skippedPrintVariants = 0;

    for (const asset of exportableMediaAssets) {
        if (asset.kind !== "uploaded-file") {
            portableMediaAssets.push(toPortableMediaAsset(asset));
            continue;
        }

        const storedValue = isManagedMediaStorageKey(asset.storageKey)
            ? blobByStorageKey.get(asset.storageKey)
            : undefined;
        if (!(storedValue instanceof Blob)) {
            missingUploadedFiles++;
            portableMediaAssets.push(toPortableMediaAsset(asset));
            continue;
        }

        const data = new Uint8Array(await storedValue.arrayBuffer());
        const packaged = createUploadedMediaPackage(asset, data, printProfile);
        mediaEntries.push(...packaged.entries);
        portableMediaAssets.push(packaged.portableAsset);
        if (packaged.skippedPrintVariant) skippedPrintVariants++;
    }

    const payload = createDatasetPayload(
        [...rows],
        portableMediaAssets,
        exportedAt.toISOString(),
        datasetName
    );
    const data = createStoredZip([
        { path: "datos.json", data: JSON.stringify(payload) },
        ...mediaEntries,
    ]);

    return {
        data,
        fileName: getTimestampedExportFileName(datasetName, "zip", exportedAt),
        missingUploadedFiles,
        orphanedMediaAssets,
        skippedPrintVariants,
    };
}

/** Genera el diagnóstico visible sin mezclarlo con la preparación del paquete. */
export function datasetZipExportWarning(
    result: Pick<
        PreparedDatasetZipExport,
        "missingUploadedFiles" | "orphanedMediaAssets" | "skippedPrintVariants"
    >
): string | null {
    return [
        result.orphanedMediaAssets
            ? `Exportación ZIP: medios huérfanos omitidos: ${result.orphanedMediaAssets} (URL externas o imágenes subidas cuyo PersonID no existe).`
            : "",
        result.missingUploadedFiles
            ? `Exportación ZIP: ${result.missingUploadedFiles} archivo(s) subido(s) no se encontraron en IndexedDB.`
            : "",
        result.skippedPrintVariants
            ? `Exportación ZIP: ${result.skippedPrintVariants} imagen(es) no admiten metadatos automáticos de impresión.`
            : "",
    ].filter(Boolean).join(" ") || null;
}

/** Convierte el resultado binario al tipo que Blob acepta de forma portátil. */
export function datasetZipExportBlob(result: PreparedDatasetZipExport): Blob {
    return new Blob(
        [uint8ArrayToArrayBuffer(result.data)],
        { type: "application/zip" }
    );
}
