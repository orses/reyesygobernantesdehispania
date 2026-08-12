// ---------------------------------------------------------------------------
// Pruebas unitarias: lib/media.ts
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
    applyMediaAssetsToRows,
    createPrimaryMediaAssetIndex,
    createExternalMediaAsset,
    deriveMediaAssetsFromRows,
    ensurePrimaryMediaAssets,
    getMediaAssetCopyValue,
    getPersonMediaAssets,
    getMediaAssetRouteLabel,
    getPrimaryMediaAsset,
    getPrimaryMediaAssetFromIndex,
    movePersonMediaAsset,
    splitGalleryUrls,
    UPLOADED_MEDIA_CSV_COLUMN,
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

describe("applyMediaAssetsToRows", () => {
    const baseAsset = (over: Partial<MediaAsset>): MediaAsset => ({
        id: "x",
        personId: "101",
        kind: "external-url",
        src: "",
        rightsStatus: "unknown",
        isPrimary: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        ...over,
    });

    it("vuelca la principal en «Imagen URL» y el resto de externas en «Galería»", () => {
        const rows: RawRow[] = [{ PersonID: 101, Nombre: "Pelayo" }];
        const assets: MediaAsset[] = [
            baseAsset({ id: "a", src: "https://img.test/a.jpg", isPrimary: false }),
            baseAsset({ id: "b", src: "https://img.test/b.jpg", isPrimary: true }),
        ];

        const [row] = applyMediaAssetsToRows(rows, assets);

        expect(row["Imagen URL"]).toBe("https://img.test/b.jpg");
        expect(row.Galería).toBe("https://img.test/a.jpg");
        // Ida y vuelta: derivar de nuevo recupera las dos URL.
        expect(deriveMediaAssetsFromRows([row]).map((a) => a.src)).toEqual([
            "https://img.test/b.jpg",
            "https://img.test/a.jpg",
        ]);
    });

    it("lista las imágenes subidas por su ruta estable, no por el nombre editable", () => {
        const rows: RawRow[] = [{ PersonID: 38, Nombre: "Test" }];
        const assets: MediaAsset[] = [
            baseAsset({ id: "u1", personId: "38", kind: "uploaded-file", fileName: "retrato.jpg", title: "Nombre editable" }),
            baseAsset({ id: "u2", personId: "38", kind: "uploaded-file", fileName: "grabado.png" }),
        ];

        const [row] = applyMediaAssetsToRows(rows, assets);

        // La referencia usa la ruta del paquete (id + nombre de archivo original),
        // independiente del «title» editable.
        expect(row[UPLOADED_MEDIA_CSV_COLUMN]).toBe("media/u1-retrato.jpg | media/u2-grabado.png");
    });

    it("no toca filas de personas sin imágenes ni muta la entrada", () => {
        const rows: RawRow[] = [{ PersonID: 999, Nombre: "Solo" }];
        const result = applyMediaAssetsToRows(rows, [baseAsset({ src: "https://img.test/a.jpg" })]);
        expect(result[0]).toEqual({ PersonID: 999, Nombre: "Solo" });
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

describe("índice de medios principales", () => {
    const asset = (
        id: string,
        personId: string,
        isPrimary = false
    ): MediaAsset => ({
        id,
        personId,
        kind: "external-url",
        src: `https://img.test/${id}.jpg`,
        rightsStatus: "unknown",
        isPrimary,
        createdAt: "2026-01-01T00:00:00.000Z",
    });

    it("devuelve null cuando la persona no tiene medios o el identificador está vacío", () => {
        const index = createPrimaryMediaAssetIndex([asset("a", "1")]);

        expect(getPrimaryMediaAssetFromIndex(index, "2")).toBeNull();
        expect(getPrimaryMediaAssetFromIndex(index, null)).toBeNull();
        expect(getPrimaryMediaAssetFromIndex(index, "   ")).toBeNull();
    });

    it("usa el primer medio como alternativa cuando no existe uno principal", () => {
        const assets = [asset("primero", "1"), asset("segundo", "1")];
        const index = createPrimaryMediaAssetIndex(assets);

        expect(getPrimaryMediaAssetFromIndex(index, "1")).toBe(assets[0]);
    });

    it("elige la primera imagen principal aunque aparezca después de medios secundarios", () => {
        const assets = [
            asset("alternativa", "1"),
            asset("principal", "1", true),
            asset("posterior", "1"),
        ];
        const index = createPrimaryMediaAssetIndex(assets);

        expect(getPrimaryMediaAssetFromIndex(index, 1)).toBe(assets[1]);
    });

    it("conserva la primera principal ante duplicados incoherentes", () => {
        const assets = [
            asset("alternativa", "1"),
            asset("principal-primera", "1", true),
            asset("principal-duplicada", "1", true),
        ];
        const index = createPrimaryMediaAssetIndex(assets);

        expect(getPrimaryMediaAssetFromIndex(index, "1")).toBe(assets[1]);
    });

    it("indexa varios personajes en una pasada y equivale a la búsqueda individual", () => {
        const assets = [
            asset("uno-alternativa", "1"),
            asset("dos-principal", "2", true),
            asset("uno-principal", "1", true),
            asset("dos-secundaria", "2"),
            asset("tres-alternativa", "3"),
        ];
        const index = createPrimaryMediaAssetIndex(assets);

        expect(index.size).toBe(3);
        for (const personId of ["1", 2, "3", "ausente", null] as const) {
            expect(getPrimaryMediaAssetFromIndex(index, personId)).toBe(
                getPrimaryMediaAsset(assets, personId)
            );
        }
    });
});

describe("movePersonMediaAsset", () => {
    const asset = (id: string, personId: string): MediaAsset => ({
        id,
        personId,
        kind: "external-url",
        src: `https://img.test/${id}.jpg`,
        rightsStatus: "unknown",
        isPrimary: false,
        createdAt: "2026-01-01T00:00:00.000Z",
    });

    it("reordena solo las imágenes del personaje indicado", () => {
        const assets: MediaAsset[] = [
            asset("a1", "1"),
            asset("b1", "2"),
            asset("a2", "1"),
            asset("a3", "1"),
        ];

        const moved = movePersonMediaAsset(assets, "1", "a3", "up");

        expect(moved.map((item) => item.id)).toEqual(["a1", "b1", "a3", "a2"]);
        expect(getPersonMediaAssets(moved, "1").map((item) => item.id)).toEqual(["a1", "a3", "a2"]);
        expect(getPersonMediaAssets(moved, "2").map((item) => item.id)).toEqual(["b1"]);
    });

    it("mantiene la misma referencia si el movimiento no es posible", () => {
        const assets: MediaAsset[] = [asset("a1", "1"), asset("a2", "1")];

        expect(movePersonMediaAsset(assets, "1", "a1", "up")).toBe(assets);
        expect(movePersonMediaAsset(assets, "1", "desconocida", "down")).toBe(assets);
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
