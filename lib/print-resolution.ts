// ---------------------------------------------------------------------------
// Metadatos de resolución para exportación documental de imágenes.
// ---------------------------------------------------------------------------

export type ImagePrintResolutionProfile = "original" | "300dpi" | "600dpi";

export const PRINT_RESOLUTION_PROFILE_OPTIONS: {
    value: ImagePrintResolutionProfile;
    label: string;
}[] = [
    { value: "original", label: "original" },
    { value: "300dpi", label: "300 ppp" },
    { value: "600dpi", label: "600 ppp" },
];

export interface PrintResolutionResult {
    ok: boolean;
    data: Uint8Array;
    changed: boolean;
    dpi: number;
    mimeType: string;
    warning?: string;
}

const PNG_SIGNATURE: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JFIF_IDENTIFIER: readonly number[] = [0x4a, 0x46, 0x49, 0x46, 0x00];
const INCHES_PER_METER = 39.37007874015748;

let crcTable: Uint32Array | null = null;

export function dpiForPrintResolutionProfile(profile: ImagePrintResolutionProfile): number | null {
    if (profile === "300dpi") return 300;
    if (profile === "600dpi") return 600;
    return null;
}

export function printResolutionProfileLabel(profile: ImagePrintResolutionProfile): string {
    return PRINT_RESOLUTION_PROFILE_OPTIONS.find((option) => option.value === profile)?.label ?? "original";
}

function normalizeMimeType(value: unknown): string {
    const mimeType = String(value ?? "").toLowerCase().split(";")[0].trim();
    if (mimeType === "image/jpg") return "image/jpeg";
    return mimeType;
}

function readUint16BE(data: Uint8Array, offset: number): number {
    return (data[offset] << 8) | data[offset + 1];
}

function writeUint16BE(target: Uint8Array, offset: number, value: number): void {
    target[offset] = (value >>> 8) & 0xff;
    target[offset + 1] = value & 0xff;
}

function readUint32BE(data: Uint8Array, offset: number): number {
    return (
        (data[offset] * 0x1000000) +
        ((data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3])
    ) >>> 0;
}

function writeUint32BE(target: Uint8Array, offset: number, value: number): void {
    target[offset] = (value >>> 24) & 0xff;
    target[offset + 1] = (value >>> 16) & 0xff;
    target[offset + 2] = (value >>> 8) & 0xff;
    target[offset + 3] = value & 0xff;
}

function asciiBytes(value: string): Uint8Array {
    const output = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index++) {
        output[index] = value.charCodeAt(index) & 0xff;
    }
    return output;
}

function hasBytes(data: Uint8Array, offset: number, expected: readonly number[]): boolean {
    if (offset + expected.length > data.length) return false;
    return expected.every((byte, index) => data[offset + index] === byte);
}

function getCrcTable(): Uint32Array {
    if (crcTable) return crcTable;

    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let value = n;
        for (let bit = 0; bit < 8; bit++) {
            value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
        }
        table[n] = value >>> 0;
    }
    crcTable = table;
    return table;
}

function crc32(data: Uint8Array): number {
    const table = getCrcTable();
    let crc = 0xffffffff;

    for (const byte of data) {
        crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type: string, payload: Uint8Array): Uint8Array {
    const typeBytes = asciiBytes(type);
    const chunk = new Uint8Array(12 + payload.length);
    writeUint32BE(chunk, 0, payload.length);
    chunk.set(typeBytes, 4);
    chunk.set(payload, 8);

    const crcInput = new Uint8Array(typeBytes.length + payload.length);
    crcInput.set(typeBytes, 0);
    crcInput.set(payload, typeBytes.length);
    writeUint32BE(chunk, 8 + payload.length, crc32(crcInput));

    return chunk;
}

function createPhysicalPixelPayload(dpi: number): Uint8Array {
    const pixelsPerMeter = Math.round(dpi * INCHES_PER_METER);
    const payload = new Uint8Array(9);
    writeUint32BE(payload, 0, pixelsPerMeter);
    writeUint32BE(payload, 4, pixelsPerMeter);
    payload[8] = 1;
    return payload;
}

function replaceRange(data: Uint8Array, start: number, end: number, replacement: Uint8Array): Uint8Array {
    const output = new Uint8Array(data.length - (end - start) + replacement.length);
    output.set(data.slice(0, start), 0);
    output.set(replacement, start);
    output.set(data.slice(end), start + replacement.length);
    return output;
}

function setPngPrintResolution(data: Uint8Array, dpi: number, mimeType: string): PrintResolutionResult {
    if (!hasBytes(data, 0, PNG_SIGNATURE)) {
        return { ok: false, data, changed: false, dpi, mimeType, warning: "PNG no reconocido." };
    }

    const payload = createPhysicalPixelPayload(dpi);
    const physicalPixelChunk = createPngChunk("pHYs", payload);
    let insertionOffset = -1;
    let offset = PNG_SIGNATURE.length;

    while (offset + 12 <= data.length) {
        const length = readUint32BE(data, offset);
        const typeStart = offset + 4;
        const payloadStart = offset + 8;
        const payloadEnd = payloadStart + length;
        const chunkEnd = payloadEnd + 4;
        if (chunkEnd > data.length) {
            return { ok: false, data, changed: false, dpi, mimeType, warning: "PNG con chunks fuera de rango." };
        }

        const type = String.fromCharCode(...data.slice(typeStart, typeStart + 4));
        if (type === "pHYs") {
            const currentPayload = data.slice(payloadStart, payloadEnd);
            const alreadyMatches =
                currentPayload.length === payload.length &&
                currentPayload.every((byte, index) => byte === payload[index]);

            return {
                ok: true,
                data: alreadyMatches ? data : replaceRange(data, offset, chunkEnd, physicalPixelChunk),
                changed: !alreadyMatches,
                dpi,
                mimeType,
            };
        }

        if (type === "IDAT" && insertionOffset < 0) {
            insertionOffset = offset;
            break;
        }
        if (type === "IEND") {
            insertionOffset = offset;
            break;
        }

        offset = chunkEnd;
    }

    if (insertionOffset < 0) {
        return { ok: false, data, changed: false, dpi, mimeType, warning: "PNG sin punto seguro para pHYs." };
    }

    return {
        ok: true,
        data: replaceRange(data, insertionOffset, insertionOffset, physicalPixelChunk),
        changed: true,
        dpi,
        mimeType,
    };
}

function createJfifSegment(dpi: number): Uint8Array {
    const segment = new Uint8Array(18);
    segment[0] = 0xff;
    segment[1] = 0xe0;
    writeUint16BE(segment, 2, 16);
    segment.set(JFIF_IDENTIFIER, 4);
    segment[9] = 1;
    segment[10] = 2;
    segment[11] = 1;
    writeUint16BE(segment, 12, dpi);
    writeUint16BE(segment, 14, dpi);
    segment[16] = 0;
    segment[17] = 0;
    return segment;
}

function setJpegJfifResolution(data: Uint8Array, dpi: number, mimeType: string): PrintResolutionResult {
    if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
        return { ok: false, data, changed: false, dpi, mimeType, warning: "JPEG no reconocido." };
    }

    let offset = 2;
    while (offset + 4 <= data.length) {
        if (data[offset] !== 0xff) break;

        let markerOffset = offset;
        while (markerOffset < data.length && data[markerOffset] === 0xff) markerOffset++;
        if (markerOffset >= data.length) break;

        const marker = data[markerOffset];
        offset = markerOffset + 1;

        if (marker === 0xda || marker === 0xd9) break;
        if (offset + 2 > data.length) break;

        const length = readUint16BE(data, offset);
        const payloadStart = offset + 2;
        const segmentEnd = offset + length;
        if (length < 2 || segmentEnd > data.length) {
            return { ok: false, data, changed: false, dpi, mimeType, warning: "JPEG con segmento fuera de rango." };
        }

        if (marker === 0xe0 && hasBytes(data, payloadStart, JFIF_IDENTIFIER)) {
            const densityOffset = payloadStart + 7;
            const alreadyMatches =
                data[densityOffset] === 1 &&
                readUint16BE(data, densityOffset + 1) === dpi &&
                readUint16BE(data, densityOffset + 3) === dpi;

            if (alreadyMatches) return { ok: true, data, changed: false, dpi, mimeType };

            const output = data.slice();
            output[densityOffset] = 1;
            writeUint16BE(output, densityOffset + 1, dpi);
            writeUint16BE(output, densityOffset + 3, dpi);
            return { ok: true, data: output, changed: true, dpi, mimeType };
        }

        offset = segmentEnd;
    }

    return {
        ok: true,
        data: replaceRange(data, 2, 2, createJfifSegment(dpi)),
        changed: true,
        dpi,
        mimeType,
    };
}

export function setPrintResolutionDpi(
    input: Uint8Array,
    mimeTypeValue: unknown,
    dpi: number
): PrintResolutionResult {
    const mimeType = normalizeMimeType(mimeTypeValue);
    const normalizedDpi = Math.round(dpi);

    if (!Number.isInteger(normalizedDpi) || normalizedDpi <= 0 || normalizedDpi > 65535) {
        return { ok: false, data: input, changed: false, dpi: normalizedDpi, mimeType, warning: "DPI fuera de rango." };
    }

    if (mimeType === "image/png") {
        return setPngPrintResolution(input, normalizedDpi, mimeType);
    }
    if (mimeType === "image/jpeg") {
        return setJpegJfifResolution(input, normalizedDpi, mimeType);
    }

    return {
        ok: false,
        data: input,
        changed: false,
        dpi: normalizedDpi,
        mimeType,
        warning: "Formato no compatible con metadatos de impresión automáticos.",
    };
}
