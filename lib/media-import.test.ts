import { describe, expect, it } from "vitest";
import {
    applyMediaImportRepairs,
    createMediaImportPersonCandidates,
    diagnoseMediaImportReferences,
    prepareImportedMediaAssets,
    type RuntimeIdFactory,
} from "./media-import";
import type { MediaAsset, RawRow } from "./types";
import type { ZipEntryOutput } from "./zip";

function packageAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
    return {
        id: "media-documental",
        personId: "1",
        kind: "uploaded-file",
        src: "",
        packagePath: "media/retrato.jpg",
        storageKey: "reyes_dataset_rows",
        mimeType: "image/jpeg",
        rightsStatus: "unknown",
        isPrimary: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

const rows: RawRow[] = [{ PersonID: "1" }];
const entries: ZipEntryOutput[] = [
    { path: "datos.json", data: new Uint8Array([1]) },
    { path: "media/retrato.jpg", data: new Uint8Array([2, 3]) },
];

function sequentialIds(prefix = "local"): RuntimeIdFactory {
    let index = 0;
    return (purpose) => `${prefix}-${purpose}-${++index}`;
}

describe("preparación segura de medios importados", () => {
    it("ignora storageKey entrante y crea una clave local nueva", () => {
        const result = prepareImportedMediaAssets({
            packageMediaAssets: [packageAsset()],
            entries,
            rows,
            createRuntimeId: sequentialIds(),
        });

        expect(result.mediaAssets[0]).toMatchObject({
            id: "media-documental",
            storageKey: "reyes_media_blob_local-media-storage-1",
        });
        expect(result.blobEntries[0][0]).toBe(result.mediaAssets[0].storageKey);
        expect(result.blobEntries[0][1]).toBeInstanceOf(Blob);
    });

    it("genera claves distintas en dos importaciones del mismo paquete", () => {
        const first = prepareImportedMediaAssets({
            packageMediaAssets: [packageAsset()],
            entries,
            rows,
            createRuntimeId: sequentialIds("primera"),
        });
        const second = prepareImportedMediaAssets({
            packageMediaAssets: [packageAsset()],
            entries,
            rows,
            createRuntimeId: sequentialIds("segunda"),
        });

        expect(first.mediaAssets[0].storageKey).not.toBe(second.mediaAssets[0].storageKey);
    });

    it("rechaza un archivo multimedia ausente antes de producir escrituras", () => {
        expect(() => prepareImportedMediaAssets({
            packageMediaAssets: [packageAsset()],
            entries: [{ path: "datos.json", data: new Uint8Array([1]) }],
            rows,
            createRuntimeId: sequentialIds(),
        })).toThrow("falta el archivo multimedia");
    });

    it("rechaza identificadores y rutas multimedia duplicados", () => {
        expect(() => prepareImportedMediaAssets({
            packageMediaAssets: [packageAsset(), packageAsset()],
            entries,
            rows,
            createRuntimeId: sequentialIds(),
        })).toThrow("identificador de medio");

        expect(() => prepareImportedMediaAssets({
            packageMediaAssets: [
                packageAsset({ id: "uno" }),
                packageAsset({ id: "dos" }),
            ],
            entries,
            rows,
            createRuntimeId: sequentialIds(),
        })).toThrow("ruta multimedia");
    });

    it("rechaza medios de personajes inexistentes", () => {
        expect(() => prepareImportedMediaAssets({
            packageMediaAssets: [packageAsset({ personId: "ausente" })],
            entries,
            rows,
            createRuntimeId: sequentialIds(),
        })).toThrow("PersonID inexistente");
    });

    it("rechaza rutas ZIP duplicadas incluso si no corresponden a medios", () => {
        expect(() => prepareImportedMediaAssets({
            packageMediaAssets: [],
            entries: [
                { path: "datos.json", data: new Uint8Array([1]) },
                { path: "datos.json", data: new Uint8Array([2]) },
            ],
            rows,
            createRuntimeId: sequentialIds(),
        })).toThrow("ruta ZIP duplicada");
    });

    it("descarta storageKey también en los medios externos", () => {
        const result = prepareImportedMediaAssets({
            packageMediaAssets: [packageAsset({
                kind: "external-url",
                src: "https://img.test/retrato.jpg",
                packagePath: undefined,
            })],
            entries,
            rows,
            createRuntimeId: sequentialIds(),
        });

        expect(result.mediaAssets[0].storageKey).toBeUndefined();
        expect(result.blobEntries).toEqual([]);
    });
});

describe("revisión de referencias multimedia importadas", () => {
    const reviewRows: RawRow[] = [
        {
            PersonID: "1",
            "Nombre principal": "Alfonso X el Sabio",
            Nombre: "Alfonso X",
            Reino: "Corona de Castilla",
            "Inicio del reinado (año)": 1252,
            "Final del reinado (año)": 1284,
        },
        {
            PersonID: 1,
            Nombre: "Alfonso X",
            Reino: "Reino de León",
            "Inicio del reinado (año)": 1252,
        },
        {
            PersonID: "2",
            Nombre: "Sancho IV",
            Reino: "Corona de Castilla",
            "Final del reinado (año)": 1295,
        },
    ];

    const reviewAssets: MediaAsset[] = [
        packageAsset({ id: "válido", personId: "1" }),
        packageAsset({
            id: "externo-huérfano",
            personId: "69",
            kind: "external-url",
            src: "https://imagenes.test/gonzalo.jpg",
            sourceUrl: "https://fuente.test/gonzalo",
            title: "Gonzalo Téllez",
            packagePath: undefined,
        }),
        packageAsset({
            id: "archivo-huérfano",
            personId: "70",
            fileName: "retrato.png",
            packagePath: "media/retrato.png",
        }),
    ];

    it("crea candidatos con nombre y contextos de las filas del archivo", () => {
        expect(createMediaImportPersonCandidates(reviewRows)).toEqual([
            {
                personId: "1",
                name: "Alfonso X el Sabio",
                contexts: [
                    "Corona de Castilla · 1252–1284",
                    "Reino de León · 1252–…",
                ],
            },
            {
                personId: "2",
                name: "Sancho IV",
                contexts: ["Corona de Castilla · …–1295"],
            },
        ]);
    });

    it("recopila todas las referencias huérfanas con datos localizables", () => {
        const review = diagnoseMediaImportReferences(reviewAssets, reviewRows);

        expect(review).toMatchObject({
            kind: "orphan-media-person-references",
            summary: "2 medios hacen referencia a PersonID inexistentes.",
            issues: [
                {
                    code: "missing-media-person-reference",
                    mediaIndex: 1,
                    jsonPath: "mediaAssets[1].personId",
                    mediaId: "externo-huérfano",
                    personId: "69",
                    kind: "external-url",
                    title: "Gonzalo Téllez",
                    url: "https://imagenes.test/gonzalo.jpg",
                    sourceUrl: "https://fuente.test/gonzalo",
                },
                {
                    code: "missing-media-person-reference",
                    mediaIndex: 2,
                    jsonPath: "mediaAssets[2].personId",
                    mediaId: "archivo-huérfano",
                    personId: "70",
                    kind: "uploaded-file",
                    fileName: "retrato.png",
                    packagePath: "media/retrato.png",
                },
            ],
            candidates: createMediaImportPersonCandidates(reviewRows),
        });
        expect(review?.issues[0].issueId).toContain("externo-hu%C3%A9rfano:69");
        expect(review?.issues[1].issueId).toContain("archivo-hu%C3%A9rfano:70");
    });

    it("omite o reasigna cada incidencia sin mutar los metadatos originales", () => {
        const review = diagnoseMediaImportReferences(reviewAssets, reviewRows)!;
        const originalSnapshot = structuredClone(reviewAssets);
        const result = applyMediaImportRepairs(reviewAssets, reviewRows, [
            { issueId: review.issues[0].issueId, action: "omit" },
            { issueId: review.issues[1].issueId, action: "reassign", personId: " 2 " },
        ]);

        expect(result).toEqual({
            ok: true,
            mediaAssets: [
                reviewAssets[0],
                { ...reviewAssets[2], personId: "2" },
            ],
        });
        expect(reviewAssets).toEqual(originalSnapshot);
        if (result.ok) {
            expect(diagnoseMediaImportReferences(result.mediaAssets, reviewRows)).toBeNull();
        }
    });

    it("rechaza planes parciales, duplicados, desconocidos o con destino inexistente", () => {
        const review = diagnoseMediaImportReferences(reviewAssets, reviewRows)!;
        const firstIssueId = review.issues[0].issueId;
        const secondIssueId = review.issues[1].issueId;

        expect(applyMediaImportRepairs(reviewAssets, reviewRows, [])).toMatchObject({
            ok: false,
            error: "Falta resolver 2 incidencias multimedia.",
            review,
        });
        expect(applyMediaImportRepairs(reviewAssets, reviewRows, [
            { issueId: firstIssueId, action: "omit" },
            { issueId: firstIssueId, action: "omit" },
        ])).toMatchObject({ ok: false, error: expect.stringContaining("repite") });
        expect(applyMediaImportRepairs(reviewAssets, reviewRows, [
            { issueId: "incidencia-antigua", action: "omit" },
        ])).toMatchObject({ ok: false, error: expect.stringContaining("desconocida") });
        expect(applyMediaImportRepairs(reviewAssets, reviewRows, [
            { issueId: firstIssueId, action: "reassign", personId: "999" },
            { issueId: secondIssueId, action: "omit" },
        ])).toMatchObject({ ok: false, error: expect.stringContaining("«999»") });
    });

    it("rechaza un plan obsoleto cuando el archivo ya no contiene incidencias", () => {
        expect(applyMediaImportRepairs([reviewAssets[0]], reviewRows, [
            { issueId: "incidencia-antigua", action: "omit" },
        ])).toEqual({
            ok: false,
            error: "El plan de reparación ya no corresponde a ninguna incidencia del archivo.",
        });
    });
});
