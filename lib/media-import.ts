import { uint8ArrayToArrayBuffer } from "./blob";
import {
    asYearOrNull,
    firstNonEmpty,
    getPersonId,
    personPrincipalName,
} from "./data";
import {
    createMediaStorageKey,
    isManagedMediaStorageKey,
} from "./media-lifecycle";
import type { MediaAsset, RawRow } from "./types";
import { validateZipPath, type ZipEntryOutput } from "./zip";

export type RuntimeIdFactory = (purpose: "media-id" | "media-storage") => string;

export interface PrepareImportedMediaAssetsInput {
    packageMediaAssets: readonly unknown[];
    entries: readonly ZipEntryOutput[];
    rows: readonly RawRow[];
    createRuntimeId: RuntimeIdFactory;
    reservedStorageKeys?: Iterable<unknown>;
}

export interface PreparedMediaImport {
    mediaAssets: MediaAsset[];
    blobEntries: [string, Blob][];
}

export interface MediaImportPersonCandidate {
    personId: string;
    name: string;
    contexts: string[];
}

export interface OrphanMediaImportIssue {
    issueId: string;
    code: "missing-media-person-reference";
    /** Índice de base cero dentro de `mediaAssets`. */
    mediaIndex: number;
    jsonPath: string;
    mediaId: string;
    personId: string;
    kind: MediaAsset["kind"];
    title?: string;
    fileName?: string;
    url?: string;
    sourceUrl?: string;
    packagePath?: string;
}

export interface MediaImportReview {
    kind: "orphan-media-person-references";
    summary: string;
    issues: OrphanMediaImportIssue[];
    candidates: MediaImportPersonCandidate[];
}

export type MediaImportRepair =
    | { issueId: string; action: "omit" }
    | { issueId: string; action: "reassign"; personId: string };

export type MediaImportRepairResult =
    | { ok: true; mediaAssets: MediaAsset[] }
    | { ok: false; error: string; review?: MediaImportReview };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalTrimmedText(value: unknown): string | undefined {
    const text = String(value ?? "").trim();
    return text || undefined;
}

function rowChronologyContext(row: RawRow): string {
    const kingdom = firstNonEmpty(row.Reino, row.reino, "(sin reino)");
    const startYear = asYearOrNull(
        row["Inicio del reinado (año)"] ??
        row.inicioAnio ??
        row["Inicio Reinado (Fecha)"] ??
        row["Inicio reinado (fecha)"]
    );
    const endYear = asYearOrNull(
        row["Final del reinado (año)"] ??
        row.finAnio ??
        row["Fin Reinado (Fecha)"] ??
        row["Fin reinado (fecha)"]
    );
    const chronology = startYear !== null && endYear !== null
        ? `${startYear}–${endYear}`
        : startYear !== null
            ? `${startYear}–…`
            : endYear !== null
                ? `…–${endYear}`
                : "";

    return chronology ? `${kingdom} · ${chronology}` : kingdom;
}

/**
 * Crea candidatos de reasignación exclusivamente a partir de las filas que se
 * están importando. Un candidato agrupa todos los gobiernos de la persona.
 */
export function createMediaImportPersonCandidates(
    rows: readonly RawRow[]
): MediaImportPersonCandidate[] {
    const rowsByPersonId = new Map<string, RawRow[]>();
    for (const row of rows) {
        const personId = getPersonId(row);
        if (!personId) continue;
        const personRows = rowsByPersonId.get(personId) ?? [];
        personRows.push(row);
        rowsByPersonId.set(personId, personRows);
    }

    return Array.from(rowsByPersonId, ([personId, personRows]) => ({
        personId,
        name: personPrincipalName(personRows),
        contexts: Array.from(new Set(personRows.map(rowChronologyContext))),
    }));
}

function mediaImportReviewSummary(issueCount: number): string {
    return issueCount === 1
        ? "Un medio hace referencia a un PersonID inexistente."
        : `${issueCount} medios hacen referencia a PersonID inexistentes.`;
}

function mediaIssueId(mediaIndex: number, mediaId: string, personId: string): string {
    return [
        "missing-media-person-reference",
        mediaIndex,
        encodeURIComponent(mediaId),
        encodeURIComponent(personId),
    ].join(":");
}

/** Recopila todas las referencias multimedia huérfanas sin modificar datos. */
export function diagnoseMediaImportReferences(
    packageMediaAssets: readonly MediaAsset[],
    rows: readonly RawRow[]
): MediaImportReview | null {
    const candidates = createMediaImportPersonCandidates(rows);
    const personIds = new Set(candidates.map((candidate) => candidate.personId));
    const issues: OrphanMediaImportIssue[] = [];

    packageMediaAssets.forEach((asset, mediaIndex) => {
        const personId = String(asset.personId ?? "").trim();
        if (personId && personIds.has(personId)) return;

        const mediaId = String(asset.id ?? "").trim();
        const title = optionalTrimmedText(asset.title);
        const fileName = optionalTrimmedText(asset.fileName);
        const url = asset.kind === "external-url"
            ? optionalTrimmedText(asset.src)
            : undefined;
        const sourceUrl = optionalTrimmedText(asset.sourceUrl);
        const packagePath = asset.kind === "uploaded-file"
            ? optionalTrimmedText(asset.packagePath)
            : undefined;
        issues.push({
            issueId: mediaIssueId(mediaIndex, mediaId, personId),
            code: "missing-media-person-reference",
            mediaIndex,
            jsonPath: `mediaAssets[${mediaIndex}].personId`,
            mediaId,
            personId,
            kind: asset.kind,
            ...(title ? { title } : {}),
            ...(fileName ? { fileName } : {}),
            ...(url ? { url } : {}),
            ...(sourceUrl ? { sourceUrl } : {}),
            ...(packagePath ? { packagePath } : {}),
        });
    });

    if (issues.length === 0) return null;
    return {
        kind: "orphan-media-person-references",
        summary: mediaImportReviewSummary(issues.length),
        issues,
        candidates,
    };
}

/**
 * Aplica un plan completo sobre una copia y comprueba de nuevo las referencias.
 * Los identificadores de incidencia vinculan el plan al manifiesto revisado.
 */
export function applyMediaImportRepairs(
    packageMediaAssets: readonly MediaAsset[],
    rows: readonly RawRow[],
    repairs: readonly MediaImportRepair[]
): MediaImportRepairResult {
    const review = diagnoseMediaImportReferences(packageMediaAssets, rows);
    if (!review) {
        return repairs.length === 0
            ? { ok: true, mediaAssets: packageMediaAssets.map((asset) => ({ ...asset })) }
            : {
                ok: false,
                error: "El plan de reparación ya no corresponde a ninguna incidencia del archivo.",
            };
    }

    const issueById = new Map(review.issues.map((issue) => [issue.issueId, issue]));
    const repairByIssueId = new Map<string, MediaImportRepair>();
    for (const repair of repairs) {
        if (!issueById.has(repair.issueId)) {
            return {
                ok: false,
                error: `El plan de reparación contiene una incidencia desconocida: «${repair.issueId}».`,
                review,
            };
        }
        if (repairByIssueId.has(repair.issueId)) {
            return {
                ok: false,
                error: `El plan de reparación repite la incidencia «${repair.issueId}».`,
                review,
            };
        }
        repairByIssueId.set(repair.issueId, repair);
    }

    const unresolved = review.issues.filter((issue) => !repairByIssueId.has(issue.issueId));
    if (unresolved.length > 0) {
        return {
            ok: false,
            error: unresolved.length === 1
                ? "Falta resolver una incidencia multimedia."
                : `Falta resolver ${unresolved.length} incidencias multimedia.`,
            review,
        };
    }

    const candidateIds = new Set(review.candidates.map((candidate) => candidate.personId));
    const issueByMediaIndex = new Map(
        review.issues.map((issue) => [issue.mediaIndex, issue])
    );
    const repairedMediaAssets: MediaAsset[] = [];
    for (let mediaIndex = 0; mediaIndex < packageMediaAssets.length; mediaIndex++) {
        const asset = packageMediaAssets[mediaIndex];
        const issue = issueByMediaIndex.get(mediaIndex);
        if (!issue) {
            repairedMediaAssets.push({ ...asset });
            continue;
        }

        const repair = repairByIssueId.get(issue.issueId)!;
        if (repair.action === "omit") continue;
        const personId = String(repair.personId ?? "").trim();
        if (!personId || !candidateIds.has(personId)) {
            return {
                ok: false,
                error: `La reasignación de «${issue.mediaId}» apunta a un PersonID inexistente: «${personId}».`,
                review,
            };
        }
        repairedMediaAssets.push({ ...asset, personId });
    }

    const remainingReview = diagnoseMediaImportReferences(repairedMediaAssets, rows);
    if (remainingReview) {
        return {
            ok: false,
            error: "El plan aplicado todavía contiene referencias multimedia sin resolver.",
            review: remainingReview,
        };
    }

    return { ok: true, mediaAssets: repairedMediaAssets };
}

function indexZipEntries(entries: readonly ZipEntryOutput[]): Map<string, ZipEntryOutput> {
    const byPath = new Map<string, ZipEntryOutput>();
    for (const entry of entries) {
        const path = validateZipPath(entry.path);
        if (byPath.has(path)) {
            throw new Error(`ruta ZIP duplicada: «${path}».`);
        }
        byPath.set(path, { ...entry, path });
    }
    return byPath;
}

function createUniqueStorageKey(
    reservedStorageKeys: Set<string>,
    createRuntimeId: RuntimeIdFactory
): string {
    for (let attempt = 0; attempt < 100; attempt++) {
        const storageKey = createMediaStorageKey(createRuntimeId("media-storage"));
        if (reservedStorageKeys.has(storageKey)) continue;
        reservedStorageKeys.add(storageKey);
        return storageKey;
    }
    throw new Error("no se pudo reservar una clave local única para un medio.");
}

/** Valida y prepara todos los medios de un ZIP sin efectuar escrituras. */
export function prepareImportedMediaAssets({
    packageMediaAssets,
    entries,
    rows,
    createRuntimeId,
    reservedStorageKeys = [],
}: PrepareImportedMediaAssetsInput): PreparedMediaImport {
    const entryByPath = indexZipEntries(entries);
    const personIds = new Set(rows.map(getPersonId).filter(Boolean));
    const mediaIds = new Set<string>();
    const packagePaths = new Set<string>();
    const reservedKeys = new Set(
        Array.from(reservedStorageKeys).filter(isManagedMediaStorageKey)
    );
    const mediaAssets: MediaAsset[] = [];
    const blobEntries: [string, Blob][] = [];

    for (const value of packageMediaAssets) {
        if (!isRecord(value)) {
            throw new Error("un medio del paquete no es un objeto válido.");
        }

        const personId = String(value.personId ?? "").trim();
        if (!personId || !personIds.has(personId)) {
            throw new Error("un medio hace referencia a un PersonID inexistente.");
        }

        const id = String(value.id ?? "").trim() || createRuntimeId("media-id");
        if (mediaIds.has(id)) {
            throw new Error(`el identificador de medio «${id}» está duplicado.`);
        }
        mediaIds.add(id);

        if (value.kind === "uploaded-file") {
            const packagePath = validateZipPath(String(value.packagePath ?? ""));
            if (!packagePath.startsWith("media/")) {
                throw new Error("una imagen subida declara una ruta ajena a media/.");
            }
            if (packagePaths.has(packagePath)) {
                throw new Error(`la ruta multimedia «${packagePath}» está duplicada.`);
            }
            packagePaths.add(packagePath);

            const mediaEntry = entryByPath.get(packagePath);
            if (!mediaEntry) {
                throw new Error(`falta el archivo multimedia «${packagePath}».`);
            }

            const storageKey = createUniqueStorageKey(reservedKeys, createRuntimeId);
            const blob = new Blob(
                [uint8ArrayToArrayBuffer(mediaEntry.data)],
                { type: String(value.mimeType ?? "application/octet-stream") }
            );
            const {
                packagePath: _packagePath,
                storageKey: _storageKey,
                ...rest
            } = value;
            mediaAssets.push({
                ...rest,
                id,
                personId,
                kind: "uploaded-file",
                src: "",
                storageKey,
                size: typeof value.size === "number" ? value.size : mediaEntry.data.byteLength,
            } as MediaAsset);
            blobEntries.push([storageKey, blob]);
            continue;
        }

        if (value.kind !== "external-url") {
            throw new Error(`el medio «${id}» declara un tipo no admitido.`);
        }

        const { storageKey: _storageKey, ...rest } = value;
        mediaAssets.push({
            ...rest,
            id,
            personId,
            kind: "external-url",
        } as MediaAsset);
    }

    return { mediaAssets, blobEntries };
}
