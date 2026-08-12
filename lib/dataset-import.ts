// ---------------------------------------------------------------------------
// Frontera de validación y normalización para importaciones JSON y ZIP.
// ---------------------------------------------------------------------------

import { normalizeRows, normalizeUrl } from "./data";
import { DATASET_PACKAGE_VERSION } from "./dataset-package";
import { normalizeRightsStatus } from "./media";
import type { MediaAsset, RawRow } from "./types";

export interface NormalizedDatasetImport {
    rows: RawRow[];
    /** Ausente en formatos antiguos para permitir derivar imágenes desde las filas. */
    mediaAssets?: MediaAsset[];
}

export type DatasetImportResult =
    | { ok: true; value: NormalizedDatasetImport }
    | { ok: false; error: string };

export type DatasetPayloadValidationResult =
    | { ok: true }
    | { ok: false; error: string };

const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeIdentifier(value: unknown): string {
    if (typeof value !== "string" && typeof value !== "number") return "";
    return String(value).trim();
}

function optionalString(
    value: Record<string, unknown>,
    key: string,
    mediaIndex: number
): { ok: true; value?: string } | { ok: false; error: string } {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) return { ok: true };
    if (typeof candidate !== "string") {
        return {
            ok: false,
            error: `JSON no válido: el campo «${key}» del medio ${mediaIndex + 1} debe ser texto.`,
        };
    }
    return { ok: true, value: candidate };
}

function optionalFiniteNumber(
    value: Record<string, unknown>,
    key: string,
    mediaIndex: number
): { ok: true; value?: number } | { ok: false; error: string } {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) return { ok: true };
    if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate < 0) {
        return {
            ok: false,
            error: `JSON no válido: el campo «${key}» del medio ${mediaIndex + 1} debe ser un número no negativo.`,
        };
    }
    return { ok: true, value: candidate };
}

function normalizeMediaAsset(
    input: unknown,
    index: number
): { ok: true; value: MediaAsset } | { ok: false; error: string } {
    if (!isRecord(input)) {
        return {
            ok: false,
            error: `JSON no válido: el medio ${index + 1} debe ser un objeto.`,
        };
    }

    const id = normalizeIdentifier(input.id);
    const personId = normalizeIdentifier(input.personId);
    if (!id || !personId) {
        return {
            ok: false,
            error: `JSON no válido: el medio ${index + 1} debe declarar id y personId.`,
        };
    }
    if (input.kind !== "external-url" && input.kind !== "uploaded-file") {
        return {
            ok: false,
            error: `JSON no válido: el medio ${index + 1} declara un tipo no admitido.`,
        };
    }

    const stringFields = [
        "title",
        "workDate",
        "author",
        "sourceName",
        "sourceUrl",
        "license",
        "usageNotes",
        "fileName",
        "mimeType",
        "packagePath",
        "printPackagePath",
        "updatedAt",
    ] as const;
    const normalizedStrings: Partial<Record<(typeof stringFields)[number], string>> = {};
    for (const key of stringFields) {
        const result = optionalString(input, key, index);
        if (!result.ok) return result;
        if (result.value !== undefined) normalizedStrings[key] = result.value;
    }

    const size = optionalFiniteNumber(input, "size", index);
    if (!size.ok) return size;
    const printDpi = optionalFiniteNumber(input, "printDpi", index);
    if (!printDpi.ok) return printDpi;

    if (input.isPrimary !== undefined && typeof input.isPrimary !== "boolean") {
        return {
            ok: false,
            error: `JSON no válido: el campo «isPrimary» del medio ${index + 1} debe ser booleano.`,
        };
    }
    if (input.createdAt !== undefined && typeof input.createdAt !== "string") {
        return {
            ok: false,
            error: `JSON no válido: el campo «createdAt» del medio ${index + 1} debe ser texto.`,
        };
    }

    const src = input.kind === "external-url" ? normalizeUrl(input.src) : "";
    if (input.kind === "external-url" && !src) {
        return {
            ok: false,
            error: `JSON no válido: el medio ${index + 1} debe declarar una URL válida.`,
        };
    }

    return {
        ok: true,
        value: {
            id,
            personId,
            kind: input.kind,
            src,
            rightsStatus: normalizeRightsStatus(input.rightsStatus),
            isPrimary: input.isPrimary === true,
            createdAt: typeof input.createdAt === "string" ? input.createdAt : EPOCH_ISO,
            ...normalizedStrings,
            ...(size.value === undefined ? {} : { size: size.value }),
            ...(printDpi.value === undefined ? {} : { printDpi: printDpi.value }),
        },
    };
}

/**
 * Valida una importación completa y devuelve un modelo seguro para el resto de
 * la aplicación. Los arrays y objetos sin versión se admiten como formatos
 * históricos; un paquete versionado debe declarar exactamente la versión actual.
 */
export function normalizeDatasetImport(input: unknown): DatasetImportResult {
    if (isRecord(input) && hasOwn(input, "version") && input.version !== DATASET_PACKAGE_VERSION) {
        return {
            ok: false,
            error: `JSON no válido: versión de paquete incompatible; se esperaba ${DATASET_PACKAGE_VERSION}.`,
        };
    }

    const normalizedRows = normalizeRows(input);
    if (!normalizedRows.ok || !normalizedRows.value) {
        return {
            ok: false,
            error: normalizedRows.error ?? "JSON no válido: no se han podido normalizar las filas.",
        };
    }

    if (!isRecord(input) || !hasOwn(input, "mediaAssets")) {
        return { ok: true, value: { rows: normalizedRows.value } };
    }
    if (!Array.isArray(input.mediaAssets)) {
        return {
            ok: false,
            error: "JSON no válido: mediaAssets debe ser un array.",
        };
    }

    const mediaAssets: MediaAsset[] = [];
    const mediaIds = new Set<string>();
    for (let index = 0; index < input.mediaAssets.length; index++) {
        const result = normalizeMediaAsset(input.mediaAssets[index], index);
        if (!result.ok) return result;
        if (mediaIds.has(result.value.id)) {
            return {
                ok: false,
                error: `JSON no válido: el identificador del medio ${index + 1} está duplicado.`,
            };
        }
        mediaIds.add(result.value.id);
        mediaAssets.push(result.value);
    }

    return {
        ok: true,
        value: { rows: normalizedRows.value, mediaAssets },
    };
}

/** Comprueba el contrato sin exponer todavía el contenido normalizado. */
export function validateDatasetPayload(input: unknown): DatasetPayloadValidationResult {
    const result = normalizeDatasetImport(input);
    return result.ok ? { ok: true } : result;
}

/**
 * Un JSON independiente no transporta los blobs de los medios subidos. Se
 * conservan únicamente sus URL externas; `undefined` mantiene la alternativa
 * histórico que deriva imágenes desde las columnas de las filas.
 */
export function getStandaloneJsonMediaAssets(
    mediaAssets: readonly MediaAsset[] | undefined
): MediaAsset[] | undefined {
    if (mediaAssets === undefined) return undefined;
    return mediaAssets.filter((asset) => asset.kind === "external-url");
}
