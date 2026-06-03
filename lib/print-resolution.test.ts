// ---------------------------------------------------------------------------
// Tests unitarios: metadatos de impresión de imágenes.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
    dpiForPrintResolutionProfile,
    setPrintResolutionDpi,
} from "./print-resolution";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function writeUint32BE(target: Uint8Array, offset: number, value: number): void {
    target[offset] = (value >>> 24) & 0xff;
    target[offset + 1] = (value >>> 16) & 0xff;
    target[offset + 2] = (value >>> 8) & 0xff;
    target[offset + 3] = value & 0xff;
}

function readUint16BE(data: Uint8Array, offset: number): number {
    return (data[offset] << 8) | data[offset + 1];
}

function readUint32BE(data: Uint8Array, offset: number): number {
    return (
        (data[offset] * 0x1000000) +
        ((data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3])
    ) >>> 0;
}

function chunk(type: string, payload: number[] = []): Uint8Array {
    const output = new Uint8Array(12 + payload.length);
    writeUint32BE(output, 0, payload.length);
    for (let index = 0; index < 4; index++) {
        output[4 + index] = type.charCodeAt(index);
    }
    output.set(payload, 8);
    return output;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
    const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;
    for (const part of parts) {
        output.set(part, offset);
        offset += part.length;
    }
    return output;
}

function minimalPng(extraChunks: Uint8Array[] = []): Uint8Array {
    const ihdrPayload = [
        0, 0, 0, 1,
        0, 0, 0, 1,
        8,
        2,
        0,
        0,
        0,
    ];

    return concatBytes(
        new Uint8Array(PNG_SIGNATURE),
        chunk("IHDR", ihdrPayload),
        ...extraChunks,
        chunk("IDAT", [1, 2, 3, 4]),
        chunk("IEND")
    );
}

function findPngChunk(data: Uint8Array, type: string): { offset: number; length: number } | null {
    let offset = PNG_SIGNATURE.length;
    while (offset + 12 <= data.length) {
        const length = readUint32BE(data, offset);
        const chunkType = String.fromCharCode(...data.slice(offset + 4, offset + 8));
        if (chunkType === type) return { offset, length };
        offset += 12 + length;
    }
    return null;
}

function existingJfif(dpi: number): Uint8Array {
    return new Uint8Array([
        0xff, 0xe0,
        0x00, 0x10,
        0x4a, 0x46, 0x49, 0x46, 0x00,
        0x01, 0x02,
        0x01,
        (dpi >>> 8) & 0xff, dpi & 0xff,
        (dpi >>> 8) & 0xff, dpi & 0xff,
        0x00, 0x00,
    ]);
}

describe("perfiles de resolución documental", () => {
    it("convierte perfiles en DPI sin tocar el perfil original", () => {
        expect(dpiForPrintResolutionProfile("original")).toBeNull();
        expect(dpiForPrintResolutionProfile("300dpi")).toBe(300);
        expect(dpiForPrintResolutionProfile("600dpi")).toBe(600);
    });
});

describe("setPrintResolutionDpi para PNG", () => {
    it("inserta pHYs a 300 ppp sin modificar el contenido IDAT", () => {
        const input = minimalPng();
        const result = setPrintResolutionDpi(input, "image/png", 300);
        const phys = findPngChunk(result.data, "pHYs");
        const idat = findPngChunk(result.data, "IDAT");

        expect(result).toMatchObject({ ok: true, changed: true, dpi: 300 });
        expect(phys).not.toBeNull();
        expect(phys && readUint32BE(result.data, phys.offset + 8)).toBe(11811);
        expect(phys && readUint32BE(result.data, phys.offset + 12)).toBe(11811);
        expect(phys && result.data[phys.offset + 16]).toBe(1);
        expect(idat && Array.from(result.data.slice(idat.offset + 8, idat.offset + 12))).toEqual([1, 2, 3, 4]);
    });

    it("reemplaza pHYs existente a 600 ppp sin cambiar dimensiones de píxel", () => {
        const oldPhysPayload = [
            0, 0, 0x0e, 0xc4,
            0, 0, 0x0e, 0xc4,
            1,
        ];
        const input = minimalPng([chunk("pHYs", oldPhysPayload)]);
        const result = setPrintResolutionDpi(input, "image/png", 600);
        const phys = findPngChunk(result.data, "pHYs");

        expect(result).toMatchObject({ ok: true, changed: true, dpi: 600 });
        expect(phys && readUint32BE(result.data, phys.offset + 8)).toBe(23622);
        expect(phys && readUint32BE(result.data, phys.offset + 12)).toBe(23622);
        expect(result.data.length).toBe(input.length);
    });
});

describe("setPrintResolutionDpi para JPEG", () => {
    it("actualiza JFIF existente a 300 ppp sin tocar los datos de imagen", () => {
        const scanData = [0xff, 0xda, 0xaa, 0xbb, 0xcc, 0xff, 0xd9];
        const input = concatBytes(
            new Uint8Array([0xff, 0xd8]),
            existingJfif(72),
            new Uint8Array(scanData)
        );
        const result = setPrintResolutionDpi(input, "image/jpeg", 300);

        expect(result).toMatchObject({ ok: true, changed: true, dpi: 300 });
        expect(result.data[13]).toBe(1);
        expect(readUint16BE(result.data, 14)).toBe(300);
        expect(readUint16BE(result.data, 16)).toBe(300);
        expect(Array.from(result.data.slice(-scanData.length))).toEqual(scanData);
    });

    it("inserta JFIF si el JPEG no declara densidad", () => {
        const input = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x02, 0xff, 0xd9]);
        const result = setPrintResolutionDpi(input, "image/jpeg", 600);

        expect(result).toMatchObject({ ok: true, changed: true, dpi: 600 });
        expect(Array.from(result.data.slice(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xe0]);
        expect(readUint16BE(result.data, 14)).toBe(600);
        expect(readUint16BE(result.data, 16)).toBe(600);
        expect(Array.from(result.data.slice(-6))).toEqual([0xff, 0xe1, 0x00, 0x02, 0xff, 0xd9]);
    });
});

describe("formatos no compatibles", () => {
    it("conserva bytes y avisa cuando el formato no se puede etiquetar", () => {
        const input = new Uint8Array([1, 2, 3]);
        const result = setPrintResolutionDpi(input, "image/webp", 300);

        expect(result).toMatchObject({
            ok: false,
            changed: false,
            data: input,
        });
        expect(result.warning).toContain("Formato no compatible");
    });
});
