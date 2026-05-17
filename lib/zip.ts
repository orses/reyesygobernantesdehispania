// ---------------------------------------------------------------------------
// Utilidades ZIP sin compresión para paquetes de datos exportados por la app.
// ---------------------------------------------------------------------------

export interface ZipEntryInput {
    path: string;
    data: Uint8Array | string;
}

export interface ZipEntryOutput {
    path: string;
    data: Uint8Array;
}

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const STORE_METHOD = 0;
const UTF8_FLAG = 0x0800;
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

function crc32(data: Uint8Array): number {
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

export function validateZipPath(path: string): string {
    const normalized = String(path ?? "").trim().replaceAll("\\", "/");
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

export function createStoredZip(entries: ZipEntryInput[]): Uint8Array {
    const seenPaths = new Set<string>();
    const prepared = entries.map((entry) => {
        const path = validateZipPath(entry.path);
        if (seenPaths.has(path)) throw new Error(`Ruta ZIP duplicada: ${path}`);
        seenPaths.add(path);

        const name = encoder.encode(path);
        const data = normalizeEntryData(entry.data);
        const crc = crc32(data);

        assertUint32(name.length, "nombre de archivo");
        assertUint32(data.length, "archivo");

        return { path, name, data, crc };
    });

    const localSize = prepared.reduce((total, entry) => total + 30 + entry.name.length + entry.data.length, 0);
    const centralSize = prepared.reduce((total, entry) => total + 46 + entry.name.length, 0);
    const totalSize = localSize + centralSize + 22;

    assertUint32(localSize, "bloque local");
    assertUint32(centralSize, "directorio central");
    assertUint32(totalSize, "paquete");

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

export function parseStoredZip(data: Uint8Array): ZipEntryOutput[] {
    const eocdOffset = findEndOfCentralDirectory(data);
    const entryCount = readUint16(data, eocdOffset + 10);
    const centralSize = readUint32(data, eocdOffset + 12);
    const centralOffset = readUint32(data, eocdOffset + 16);

    if (centralOffset + centralSize > data.length) {
        throw new Error("ZIP inválido: directorio central fuera de rango.");
    }

    const entries: ZipEntryOutput[] = [];
    let offset = centralOffset;

    for (let i = 0; i < entryCount; i++) {
        if (readUint32(data, offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
            throw new Error("ZIP inválido: cabecera central no reconocida.");
        }

        const method = readUint16(data, offset + 10);
        if (method !== STORE_METHOD) {
            throw new Error("ZIP no admitido: solo se aceptan entradas sin compresión.");
        }

        const compressedSize = readUint32(data, offset + 20);
        const uncompressedSize = readUint32(data, offset + 24);
        const nameLength = readUint16(data, offset + 28);
        const extraLength = readUint16(data, offset + 30);
        const commentLength = readUint16(data, offset + 32);
        const localOffset = readUint32(data, offset + 42);
        const nameStart = offset + 46;
        const nameEnd = nameStart + nameLength;

        if (nameEnd > data.length) throw new Error("ZIP inválido: nombre de archivo fuera de rango.");
        const path = validateZipPath(decoder.decode(data.slice(nameStart, nameEnd)));

        if (compressedSize !== uncompressedSize) {
            throw new Error("ZIP no admitido: la entrada declara tamaños incompatibles.");
        }
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
            data: data.slice(dataStart, dataEnd),
        });

        offset = nameEnd + extraLength + commentLength;
    }

    return entries;
}
