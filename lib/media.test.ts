// ---------------------------------------------------------------------------
// Tests unitarios: lib/media.ts
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
    createExternalMediaAsset,
    deriveMediaAssetsFromRows,
    ensurePrimaryMediaAssets,
    getMediaAssetCopyValue,
    getMediaAssetRouteLabel,
    getPrimaryMediaAsset,
    splitGalleryUrls,
} from "./media";
import type { MediaAsset, RawRow } from "./types";

describe("splitGalleryUrls", () => {
    it("separa galerías por saltos de línea, barras y comas ante URL", () => {
        const urls = splitGalleryUrls(
            "https://a.test/uno.jpg\nhttps://a.test/dos.jpg | www.test/tres.png, https://b.test/cuatro.webp"
        );

        expect(urls).toEqual([
            "https://a.test/uno.jpg",
            "https://a.test/dos.jpg",
            "https://www.test/tres.png",
            "https://b.test/cuatro.webp",
        ]);
    });
});

describe("createExternalMediaAsset", () => {
    it("normaliza URL y crea una imagen externa con derechos desconocidos por defecto", () => {
        const asset = createExternalMediaAsset({
            personId: 101,
            url: "www.example.test/pelayo.jpg",
            isPrimary: true,
            now: "2026-01-01T00:00:00.000Z",
        });

        expect(asset).toMatchObject({
            personId: "101",
            kind: "external-url",
            src: "https://www.example.test/pelayo.jpg",
            rightsStatus: "unknown",
            isPrimary: true,
        });
    });

    it("devuelve null si falta PersonID o URL", () => {
        expect(createExternalMediaAsset({ personId: "", url: "https://x.test/a.jpg" })).toBeNull();
        expect(createExternalMediaAsset({ personId: "1", url: "" })).toBeNull();
    });

    it("conserva licencia y atribución en imágenes externas", () => {
        const asset = createExternalMediaAsset({
            personId: 101,
            url: "https://img.test/alfonso.jpg",
            author: "Manuel Castellano",
            sourceName: "Wikimedia Commons",
            sourceUrl: "https://commons.wikimedia.org/wiki/File:Alfonso.jpg",
            license: "CC BY-SA 4.0",
            rightsStatus: "licensed",
            now: "2026-01-01T00:00:00.000Z",
        });

        expect(asset).toMatchObject({
            author: "Manuel Castellano",
            sourceName: "Wikimedia Commons",
            sourceUrl: "https://commons.wikimedia.org/wiki/File:Alfonso.jpg",
            license: "CC BY-SA 4.0",
            rightsStatus: "licensed",
        });
    });
});

describe("deriveMediaAssetsFromRows", () => {
    it("crea imágenes heredadas desde Imagen URL y Galería sin duplicados", () => {
        const rows: RawRow[] = [
            {
                PersonID: 101,
                "Imagen URL": "https://img.test/pelayo.jpg",
                Galería: "https://img.test/pelayo.jpg\nhttps://img.test/pelayo-2.jpg",
                "Ficha RAH URL": "https://rah.test/pelayo",
            },
            {
                PersonID: 101,
                "Imagen URL": "https://img.test/pelayo-2.jpg",
            },
        ];

        const assets = deriveMediaAssetsFromRows(rows);

        expect(assets).toHaveLength(2);
        expect(assets[0].isPrimary).toBe(true);
        expect(assets[1].isPrimary).toBe(false);
        expect(assets.map((asset) => asset.src)).toEqual([
            "https://img.test/pelayo.jpg",
            "https://img.test/pelayo-2.jpg",
        ]);
    });
});

describe("ensurePrimaryMediaAssets", () => {
    it("garantiza una única imagen principal por personaje", () => {
        const assets: MediaAsset[] = [
            {
                id: "a",
                personId: "1",
                kind: "external-url",
                src: "https://x.test/a.jpg",
                rightsStatus: "unknown",
                isPrimary: false,
                createdAt: "2026-01-01T00:00:00.000Z",
            },
            {
                id: "b",
                personId: "1",
                kind: "external-url",
                src: "https://x.test/b.jpg",
                rightsStatus: "unknown",
                isPrimary: true,
                createdAt: "2026-01-01T00:00:00.000Z",
            },
            {
                id: "c",
                personId: "1",
                kind: "external-url",
                src: "https://x.test/c.jpg",
                rightsStatus: "unknown",
                isPrimary: true,
                createdAt: "2026-01-01T00:00:00.000Z",
            },
        ];

        const normalized = ensurePrimaryMediaAssets(assets);

        expect(normalized.filter((asset) => asset.isPrimary)).toHaveLength(1);
        expect(getPrimaryMediaAsset(normalized, "1")?.id).toBe("b");
    });
});

describe("rutas copiables de imágenes", () => {
    it("usa la URL real de la imagen externa, no la ficha de origen", () => {
        const asset: MediaAsset = {
            id: "a",
            personId: "1",
            kind: "external-url",
            src: "www.img.test/felipe.jpg",
            sourceUrl: "https://rah.test/felipe",
            rightsStatus: "unknown",
            isPrimary: true,
            createdAt: "2026-01-01T00:00:00.000Z",
        };

        expect(getMediaAssetRouteLabel(asset)).toBe("https://www.img.test/felipe.jpg");
        expect(getMediaAssetCopyValue(asset)).toBe("https://www.img.test/felipe.jpg");
    });

    it("usa la ruta del paquete o el nombre de archivo en imágenes subidas", () => {
        const asset: MediaAsset = {
            id: "b",
            personId: "1",
            kind: "uploaded-file",
            src: "",
            packagePath: "media/1/felipe.jpg",
            fileName: "felipe.jpg",
            storageKey: "asset-b",
            rightsStatus: "copyrighted",
            isPrimary: false,
            createdAt: "2026-01-01T00:00:00.000Z",
        };

        expect(getMediaAssetRouteLabel(asset)).toBe("media/1/felipe.jpg");
        expect(getMediaAssetCopyValue(asset)).toBe("media/1/felipe.jpg");
    });
});
