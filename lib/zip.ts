// ---------------------------------------------------------------------------
// Utilidades ZIP sin compresión para paquetes de datos exportados por la app.
// ---------------------------------------------------------------------------

import { uint8ArrayToArrayBuffer } from "./blob";

export interface ZipEntryInput {
    path: string;
    data: Uint8Array | string;
}

export interface ZipEntryOutput {
    path: string;
    data: Uint8Array;
}

export interface ZipLimits {
    maxArchiveBytes: number;
    maxEntries: number;
    maxEntryUncompressedBytes: number;
    maxTotalUncompressedBytes: number;
}

export type ZipLimitOverrides = Partial<ZipLimits>;

export interface ZipFileLike {
    readonly size: number;
    arrayBuffer(): Promise<ArrayBuffer>;
}

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const STORE_METHOD = 0;
const DEFLATE_METHOD = 8;
const UTF8_FLAG = 0x0800;

// Los lectores conservan en memoria el archivo y sus entradas. Estos topes
// limitan conjuntamente la memoria, el tiempo de CPU y las bombas ZIP.
export const MAX_ZIP_ARCHIVE_BYTES = 256 * 1024 * 1024;
export const MAX_ZIP_ENTRIES = 4_096;
export const MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;
export const MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;

// Se conserva el nombre anterior para no romper consumidores existentes.
export const MAX_DECOMPRESSED_BYTES = MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES;

export const DEFAULT_ZIP_LIMITS: Readonly<ZipLimits> = Object.freeze({
    maxArchiveBytes: MAX_ZIP_ARCHIVE_BYTES,
    maxEntries: MAX_ZIP_ENTRIES,
    maxEntryUncompressedBytes: MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES,
    maxTotalUncompressedBytes: MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES,
});

const MAX_ZIP32_ENTRIES = 0xffff;
const DOS_DATE_1980_01_01 = (1 << 5) | 1;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
    if (crcTable) return crcTable;

    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    crcTable = table;
    return table;
}

export function crc32(data: Uint8Array): number {
    const table = getCrcTable();
    let crc = 0xffffffff;

    for (const byte of data) {
        crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
}

function readUint16(data: Uint8Array, offset: number): number {
    if (offset + 2 > data.length) throw new Error("ZIP inválido: lectura fuera de rango.");
    return data[offset] | (data[offset + 1] << 8);
}

function readUint32(data: Uint8Array, offset: number): number {
    if (offset + 4 > data.length) throw new Error("ZIP inválido: lectura fuera de rango.");
    return (
        data[offset] |
        (data[offset + 1] << 8) |
        (data[offset + 2] << 16) |
        (data[offset + 3] << 24)
    ) >>> 0;
}

function writeUint16(target: Uint8Array, offset: number, value: number): void {
    target[offset] = value & 0xff;
    target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target: Uint8Array, offset: number, value: number): void {
    target[offset] = value & 0xff;
    target[offset + 1] = (value >>> 8) & 0xff;
    target[offset + 2] = (value >>> 16) & 0xff;
    target[offset + 3] = (value >>> 24) & 0xff;
}

function normalizeEntryData(data: Uint8Array | string): Uint8Array {
    return typeof data === "string" ? encoder.encode(data) : data;
}

function assertUint32(value: number, fieldName: string): void {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
        throw new Error(`ZIP inválido: ${fieldName} supera el tamaño admitido.`);
    }
}

function resolveZipLimits(overrides: ZipLimitOverrides = {}): ZipLimits {
    const limits: ZipLimits = { ...DEFAULT_ZIP_LIMITS, ...overrides };

    for (const [name, value] of Object.entries(limits)) {
        if (!Number.isSafeInteger(value) || value < 0) {
            throw new Error(`Límite ZIP no válido: ${name}.`);
        }
    }

    return limits;
}

function assertArchiveSize(size: number, limits: ZipLimits): void {
    if (!Number.isSafeInteger(size) || size < 0) {
        throw new Error("ZIP inválido: el tamaño del archivo no es válido.");
    }
    if (size > limits.maxArchiveBytes) {
        throw new Error("ZIP no admitido: el archivo supera el tamaño permitido.");
    }
}

function assertEntryCount(count: number, limits: ZipLimits): void {
    if (count > Math.min(limits.maxEntries, MAX_ZIP32_ENTRIES)) {
        throw new Error("ZIP no admitido: el número de entradas supera el límite permitido.");
    }
}

function assertEntryUncompressedSize(size: number, limits: ZipLimits): void {
    if (size > limits.maxEntryUncompressedBytes) {
        throw new Error("ZIP no admitido: una entrada descomprimida supera el tamaño permitido.");
    }
}

function addUncompressedSize(total: number, size: number, limits: ZipLimits): number {
    const nextTotal = total + size;
    if (nextTotal > limits.maxTotalUncompressedBytes) {
        throw new Error("ZIP no admitido: el contenido descomprimido total supera el tamaño permitido.");
    }
    return nextTotal;
}

function normalizeZipPath(path: string): string {
    return String(path ?? "").trim().replaceAll("\\", "/").normalize("NFC");
}

export function validateZipPath(path: string): string {
    const normalized = normalizeZipPath(path);
    const parts = normalized.split("/");

    if (
        !normalized ||
        normalized.startsWith("/") ||
        normalized.endsWith("/") ||
        /^[a-z]:\//i.test(normalized) ||
        normalized.includes("//") ||
        parts.some((part) => !part || part === "." || part === "..")
    ) {
        throw new Error(`Ruta ZIP no válida: ${path}`);
    }

    return normalized;
}

export function createStoredZip(
    entries: ZipEntryInput[],
    limitOverrides: ZipLimitOverrides = {},
): Uint8Array {
    const limits = resolveZipLimits(limitOverrides);
    assertEntryCount(entries.length, limits);

    const seenPaths = new Set<string>();
    let totalUncompressedSize = 0;
    const prepared = entries.map((entry) => {
        const path = validateZipPath(entry.path);
        if (seenPaths.has(path)) throw new Error(`Ruta ZIP duplicada: ${path}`);
        seenPaths.add(path);

        const name = encoder.encode(path);
        const data = normalizeEntryData(entry.data);

        assertUint32(name.length, "nombre de archivo");
        assertUint32(data.length, "archivo");
        assertEntryUncompressedSize(data.length, limits);
        totalUncompressedSize = addUncompressedSize(totalUncompressedSize, data.length, limits);
        const crc = crc32(data);

        return { path, name, data, crc };
    });

    const localSize = prepared.reduce((total, entry) => total + 30 + entry.name.length + entry.data.length, 0);
    const centralSize = prepared.reduce((total, entry) => total + 46 + entry.name.length, 0);
    const totalSize = localSize + centralSize + 22;

    assertUint32(localSize, "bloque local");
    assertUint32(centralSize, "directorio central");
    assertUint32(totalSize, "paquete");
    assertArchiveSize(totalSize, limits);

    const zip = new Uint8Array(totalSize);
    const centralRecords: { entry: (typeof prepared)[number]; localOffset: number }[] = [];
    let offset = 0;

    for (const entry of prepared) {
        const localOffset = offset;
        centralRecords.push({ entry, localOffset });

        writeUint32(zip, offset, LOCAL_FILE_HEADER_SIGNATURE);
        offset += 4;
        writeUint16(zip, offset, 20);
        offset += 2;
        writeUint16(zip, offset, UTF8_FLAG);
        offset += 2;
        writeUint16(zip, offset, STORE_METHOD);
        offset += 2;
        writeUint16(zip, offset, 0);
        offset += 2;
        writeUint16(zip, offset, DOS_DATE_1980_01_01);
        offset += 2;
        writeUint32(zip, offset, entry.crc);
        offset += 4;
        writeUint32(zip, offset, entry.data.length);
        offset += 4;
        writeUint32(zip, offset, entry.data.length);
        offset += 4;
        writeUint16(zip, offset, entry.name.length);
        offset += 2;
        writeUint16(zip, offset, 0);
        offset += 2;
        zip.set(entry.name, offset);
        offset += entry.name.length;
        zip.set(entry.data, offset);
        offset += entry.data.length;
    }

    const centralOffset = offset;

    for (const { entry, localOffset } of centralRecords) {
        writeUint32(zip, offset, CENTRAL_DIRECTORY_SIGNATURE);
        offset += 4;
        writeUint16(zip, offset, 20);
        offset += 2;
        writeUint16(zip, offset, 20);
        offset += 2;
        writeUint16(zip, offset, UTF8_FLAG);
        offset += 2;
        writeUint16(zip, offset, STORE_METHOD);
        offset += 2;
        writeUint16(zip, offset, 0);
        offset += 2;
        writeUint16(zip, offset, DOS_DATE_1980_01_01);
        offset += 2;
        writeUint32(zip, offset, entry.crc);
        offset += 4;
        writeUint32(zip, offset, entry.data.length);
        offset += 4;
        writeUint32(zip, offset, entry.data.length);
        offset += 4;
        writeUint16(zip, offset, entry.name.length);
        offset += 2;
        writeUint16(zip, offset, 0);
        offset += 2;
        writeUint16(zip, offset, 0);
        offset += 2;
        writeUint16(zip, offset, 0);
        offset += 2;
        writeUint16(zip, offset, 0);
        offset += 2;
        writeUint32(zip, offset, 0);
        offset += 4;
        writeUint32(zip, offset, localOffset);
        offset += 4;
        zip.set(entry.name, offset);
        offset += entry.name.length;
    }

    writeUint32(zip, offset, END_OF_CENTRAL_DIRECTORY_SIGNATURE);
    offset += 4;
    writeUint16(zip, offset, 0);
    offset += 2;
    writeUint16(zip, offset, 0);
    offset += 2;
    writeUint16(zip, offset, prepared.length);
    offset += 2;
    writeUint16(zip, offset, prepared.length);
    offset += 2;
    writeUint32(zip, offset, centralSize);
    offset += 4;
    writeUint32(zip, offset, centralOffset);
    offset += 4;
    writeUint16(zip, offset, 0);

    return zip;
}

function findEndOfCentralDirectory(data: Uint8Array): number {
    const minOffset = Math.max(0, data.length - 22 - 0xffff);
    for (let offset = data.length - 22; offset >= minOffset; offset--) {
        if (readUint32(data, offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
            return offset;
        }
    }
    throw new Error("ZIP inválido: no se encontró el directorio central.");
}

interface RawZipEntry {
    path: string;
    method: number;
    crc: number;
    compressedSize: number;
    uncompressedSize: number;
    compressed: Uint8Array;
}

// Recorre el directorio central y devuelve las entradas en crudo, sin
// descomprimir ni juzgar el método. Lo comparten el lector estricto (STORED) y
// el general (STORED + DEFLATE) para no duplicar el parseo de cabeceras.
function readCentralEntries(data: Uint8Array, limits: ZipLimits): RawZipEntry[] {
    assertArchiveSize(data.byteLength, limits);

    const eocdOffset = findEndOfCentralDirectory(data);
    const entryCount = readUint16(data, eocdOffset + 10);
    const centralSize = readUint32(data, eocdOffset + 12);
    const centralOffset = readUint32(data, eocdOffset + 16);

    if (centralOffset + centralSize > data.length) {
        throw new Error("ZIP inválido: directorio central fuera de rango.");
    }
    assertEntryCount(entryCount, limits);

    const entries: RawZipEntry[] = [];
    const seenPaths = new Set<string>();
    let totalDeclaredUncompressedSize = 0;
    let offset = centralOffset;

    for (let i = 0; i < entryCount; i++) {
        if (readUint32(data, offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
            throw new Error("ZIP inválido: cabecera central no reconocida.");
        }

        const method = readUint16(data, offset + 10);
        const crc = readUint32(data, offset + 16);
        const compressedSize = readUint32(data, offset + 20);
        const uncompressedSize = readUint32(data, offset + 24);
        const nameLength = readUint16(data, offset + 28);
        const extraLength = readUint16(data, offset + 30);
        const commentLength = readUint16(data, offset + 32);
        const localOffset = readUint32(data, offset + 42);
        const nameStart = offset + 46;
        const nameEnd = nameStart + nameLength;

        if (nameEnd > data.length) throw new Error("ZIP inválido: nombre de archivo fuera de rango.");
        const rawName = decoder.decode(data.subarray(nameStart, nameEnd));
        const normalizedName = normalizeZipPath(rawName);

        // Las herramientas externas (p. ej. el diálogo "Crear archivo" de
        // Windows 11) añaden entradas de directorio: nombre terminado en "/" y
        // sin datos. No aportan contenido, así que se omiten en lugar de
        // invalidar todo el paquete.
        if (normalizedName.endsWith("/")) {
            offset = nameEnd + extraLength + commentLength;
            continue;
        }

        const path = validateZipPath(normalizedName);
        if (seenPaths.has(path)) {
            throw new Error(`Ruta ZIP duplicada: ${path}`);
        }
        seenPaths.add(path);

        assertEntryUncompressedSize(uncompressedSize, limits);
        totalDeclaredUncompressedSize = addUncompressedSize(
            totalDeclaredUncompressedSize,
            uncompressedSize,
            limits,
        );

        if (readUint32(data, localOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
            throw new Error("ZIP inválido: cabecera local no reconocida.");
        }

        const localNameLength = readUint16(data, localOffset + 26);
        const localExtraLength = readUint16(data, localOffset + 28);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        const dataEnd = dataStart + compressedSize;
        if (dataEnd > data.length) throw new Error("ZIP inválido: datos de archivo fuera de rango.");

        entries.push({
            path,
            method,
            crc,
            compressedSize,
            uncompressedSize,
            compressed: data.subarray(dataStart, dataEnd),
        });

        offset = nameEnd + extraLength + commentLength;
    }

    return entries;
}

// Lector estricto: solo acepta entradas STORED. Síncrono y sin dependencias.
export function parseStoredZip(
    data: Uint8Array,
    limitOverrides: ZipLimitOverrides = {},
): ZipEntryOutput[] {
    const limits = resolveZipLimits(limitOverrides);

    return readCentralEntries(data, limits).map((entry) => {
        if (entry.method !== STORE_METHOD) {
            throw new Error("ZIP no admitido: solo se aceptan entradas sin compresión.");
        }
        if (entry.compressedSize !== entry.uncompressedSize) {
            throw new Error("ZIP no admitido: la entrada declara tamaños incompatibles.");
        }
        return { path: entry.path, data: entry.compressed };
    });
}

// Descomprime un bloque DEFLATE en crudo con la API nativa del navegador y
// aborta si la salida supera `maxBytes` (defensa anti-bomba durante el flujo).
export async function inflateRaw(
    data: Uint8Array,
    maxBytes: number = MAX_DECOMPRESSED_BYTES,
): Promise<Uint8Array> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
        throw new Error("Límite ZIP no válido: maxBytes.");
    }

    return inflateRawWithLimit(
        data,
        maxBytes,
        "ZIP no admitido: una entrada descomprimida supera el tamaño permitido.",
    );
}

async function inflateRawWithLimit(
    data: Uint8Array,
    maxBytes: number,
    limitErrorMessage: string,
): Promise<Uint8Array> {
    if (typeof DecompressionStream === "undefined") {
        throw new Error("ZIP comprimido: este entorno no admite la descompresión nativa.");
    }

    const stream = new Blob([uint8ArrayToArrayBuffer(data)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    for (;;) {
        const { done, value } = await reader.read();
        if (done || value === undefined) break;
        total += value.length;
        if (total > maxBytes) {
            await reader.cancel();
            throw new Error(limitErrorMessage);
        }
        chunks.push(value);
    }

    const out = new Uint8Array(total);
    let pos = 0;
    for (const chunk of chunks) {
        out.set(chunk, pos);
        pos += chunk.length;
    }
    return out;
}

// Lector general: acepta entradas STORED y DEFLATE (el método por defecto del
// Explorador de Windows, 7-Zip o WinRAR). Verifica integridad por CRC-32 y
// aplica el tope anti-bomba de descompresión.
export async function parseZip(
    data: Uint8Array,
    limitOverrides: ZipLimitOverrides = {},
): Promise<ZipEntryOutput[]> {
    const limits = resolveZipLimits(limitOverrides);
    const out: ZipEntryOutput[] = [];
    let totalActualUncompressedSize = 0;

    for (const entry of readCentralEntries(data, limits)) {
        let bytes: Uint8Array;

        if (entry.method === STORE_METHOD) {
            if (entry.compressedSize !== entry.uncompressedSize) {
                throw new Error("ZIP no admitido: la entrada declara tamaños incompatibles.");
            }
            bytes = entry.compressed;
        } else if (entry.method === DEFLATE_METHOD) {
            const remainingTotalBytes = limits.maxTotalUncompressedBytes - totalActualUncompressedSize;
            const maxInflatedBytes = Math.min(
                limits.maxEntryUncompressedBytes,
                remainingTotalBytes,
            );
            const limitErrorMessage = remainingTotalBytes < limits.maxEntryUncompressedBytes
                ? "ZIP no admitido: el contenido descomprimido total supera el tamaño permitido."
                : "ZIP no admitido: una entrada descomprimida supera el tamaño permitido.";
            bytes = await inflateRawWithLimit(entry.compressed, maxInflatedBytes, limitErrorMessage);
            if (bytes.length !== entry.uncompressedSize) {
                throw new Error("ZIP inválido: el tamaño descomprimido no coincide con la cabecera.");
            }
        } else {
            throw new Error("ZIP no admitido: método de compresión no soportado.");
        }

        assertEntryUncompressedSize(bytes.byteLength, limits);
        totalActualUncompressedSize = addUncompressedSize(
            totalActualUncompressedSize,
            bytes.byteLength,
            limits,
        );

        if (crc32(bytes) !== entry.crc) {
            throw new Error("ZIP inválido: comprobación CRC fallida (datos corruptos).");
        }

        out.push({ path: entry.path, data: bytes });
    }

    return out;
}

// Comprueba el tamaño declarado antes de materializar el archivo completo.
// `parseZip` repite la comprobación sobre el búfer real como defensa adicional.
export async function parseZipFile(
    file: ZipFileLike,
    limitOverrides: ZipLimitOverrides = {},
): Promise<ZipEntryOutput[]> {
    const limits = resolveZipLimits(limitOverrides);
    assertArchiveSize(file.size, limits);

    const buffer = await file.arrayBuffer();
    return parseZip(new Uint8Array(buffer), limits);
}
