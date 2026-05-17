import type { MediaAsset, MediaRightsStatus, RawRow } from "./types";
import { getPersonId, normalizeUrl } from "./data";

const RIGHTS_STATUSES: readonly MediaRightsStatus[] = [
    "public-domain",
    "licensed",
    "copyrighted",
    "unknown",
];

function hashText(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

function normalizePersonId(personId: unknown): string {
    return String(personId ?? "").trim();
}

export function normalizeRightsStatus(value: unknown): MediaRightsStatus {
    const normalized = String(value ?? "").trim() as MediaRightsStatus;
    return RIGHTS_STATUSES.includes(normalized) ? normalized : "unknown";
}

export function splitGalleryUrls(value: unknown): string[] {
    const raw = String(value ?? "").trim();
    if (!raw) return [];

    return raw
        .split(/\r?\n|\s\|\s|,\s*(?=https?:\/\/|\/\/|www\.)/i)
        .map((item) => normalizeUrl(item).trim())
        .filter(Boolean);
}

export function createExternalMediaAsset({
    personId,
    url,
    title,
    author,
    sourceName,
    sourceUrl,
    license,
    usageNotes,
    rightsStatus = "unknown",
    isPrimary = false,
    now = new Date().toISOString(),
}: {
    personId: string | number;
    url: unknown;
    title?: string;
    author?: string;
    sourceName?: string;
    sourceUrl?: string;
    license?: string;
    usageNotes?: string;
    rightsStatus?: MediaRightsStatus;
    isPrimary?: boolean;
    now?: string;
}): MediaAsset | null {
    const normalizedPersonId = normalizePersonId(personId);
    const src = normalizeUrl(url);

    if (!normalizedPersonId || !src) return null;

    return {
        id: `media-${normalizedPersonId}-${hashText(src)}`,
        personId: normalizedPersonId,
        kind: "external-url",
        src,
        title,
        author,
        sourceName,
        sourceUrl,
        license,
        usageNotes,
        rightsStatus,
        isPrimary,
        createdAt: now,
    };
}

export function getPersonMediaAssets(
    assets: MediaAsset[],
    personId: string | number | null | undefined
): MediaAsset[] {
    const normalizedPersonId = normalizePersonId(personId);
    if (!normalizedPersonId) return [];
    return assets.filter((asset) => asset.personId === normalizedPersonId);
}

export function getPrimaryMediaAsset(
    assets: MediaAsset[],
    personId: string | number | null | undefined
): MediaAsset | null {
    const personAssets = getPersonMediaAssets(assets, personId);
    return personAssets.find((asset) => asset.isPrimary) ?? personAssets[0] ?? null;
}

export function getMediaAssetRouteLabel(asset: MediaAsset): string {
    if (asset.kind === "uploaded-file") {
        return asset.packagePath || asset.fileName || asset.title || "Archivo subido";
    }

    return normalizeUrl(asset.src) || "URL externa";
}

export function getMediaAssetCopyValue(asset: MediaAsset): string {
    if (asset.kind === "uploaded-file") {
        return asset.packagePath || asset.fileName || asset.storageKey || asset.id;
    }

    return normalizeUrl(asset.src);
}

export function ensurePrimaryMediaAssets(assets: MediaAsset[]): MediaAsset[] {
    const firstPrimaryByPerson = new Map<string, string>();
    const firstAssetByPerson = new Map<string, string>();

    for (const asset of assets) {
        if (!firstAssetByPerson.has(asset.personId)) {
            firstAssetByPerson.set(asset.personId, asset.id);
        }
        if (asset.isPrimary && !firstPrimaryByPerson.has(asset.personId)) {
            firstPrimaryByPerson.set(asset.personId, asset.id);
        }
    }

    return assets.map((asset) => {
        const primaryId =
            firstPrimaryByPerson.get(asset.personId) ??
            firstAssetByPerson.get(asset.personId);

        return asset.isPrimary === (asset.id === primaryId)
            ? asset
            : { ...asset, isPrimary: asset.id === primaryId };
    });
}

export function deriveMediaAssetsFromRows(rows: RawRow[]): MediaAsset[] {
    const assets: MediaAsset[] = [];
    const seen = new Set<string>();
    const personHasPrimary = new Set<string>();
    const now = new Date(0).toISOString();

    for (const row of rows) {
        const personId = getPersonId(row);
        if (!personId) continue;

        const urls = [
            normalizeUrl(row["Imagen URL"]),
            ...splitGalleryUrls(row.Galería ?? row.Galeria ?? row["Galería"] ?? row["Galeria"]),
        ].filter(Boolean);

        for (const url of urls) {
            const key = `${personId}::${url}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const asset = createExternalMediaAsset({
                personId,
                url,
                sourceUrl: normalizeUrl(row["Ficha RAH URL"]),
                rightsStatus: normalizeRightsStatus(row["Estado derechos imagen"]),
                isPrimary: !personHasPrimary.has(String(personId)),
                now,
            });

            if (!asset) continue;
            personHasPrimary.add(asset.personId);
            assets.push(asset);
        }
    }

    return ensurePrimaryMediaAssets(assets);
}
