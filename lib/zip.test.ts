// ---------------------------------------------------------------------------
// Tests unitarios: lib/zip.ts
// ---------------------------------------------------------------------------

import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { createStoredZip, crc32, inflateRaw, parseStoredZip, parseZip, validateZipPath } from "./zip";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function textOf(data: Uint8Array): string {
    return decoder.decode(data);
}

// Construye un ZIP de una sola entrada con el método indicado, replicando el
// formato que producen herramientas externas (p. ej. método 8 = DEFLATE). Sirve
// para probar el lector general sin depender de cómo comprime cada sistema.
function buildSingleEntryZip(
    path: string,
    raw: Uint8Array,
    method: number,
    stored: Uint8Array,
): Uint8Array {
    const name = encoder.encode(path);
    const crc = crc32(raw);
    const localOffset = 0;
    const localSize = 30 + name.length + stored.length;
    const centralSize = 46 + name.length;
    const buf = new Uint8Array(localSize + centralSize + 22);
    const dv = new DataView(buf.buffer);
    let o = 0;

    // Cabecera local
    dv.setUint32(o, 0x04034b50, true); o += 4;
    dv.setUint16(o, 20, true); o += 2;       // versión necesaria
    dv.setUint16(o, 0x0800, true); o += 2;   // flags (UTF-8)
    dv.setUint16(o, method, true); o += 2;
    dv.setUint16(o, 0, true); o += 2;        // hora
    dv.setUint16(o, 0x21, true); o += 2;     // fecha (1980-01-01)
    dv.setUint32(o, crc, true); o += 4;
    dv.setUint32(o, stored.length, true); o += 4;  // tamaño comprimido
    dv.setUint32(o, raw.length, true); o += 4;     // tamaño sin comprimir
    dv.setUint16(o, name.length, true); o += 2;
    dv.setUint16(o, 0, true); o += 2;        // extra
    buf.set(name, o); o += name.length;
    buf.set(stored, o); o += stored.length;

    // Directorio central
    const centralStart = o;
    dv.setUint32(o, 0x02014b50, true); o += 4;
    dv.setUint16(o, 20, true); o += 2;       // versión creadora
    dv.setUint16(o, 20, true); o += 2;       // versión necesaria
    dv.setUint16(o, 0x0800, true); o += 2;   // flags
    dv.setUint16(o, method, true); o += 2;
    dv.setUint16(o, 0, true); o += 2;        // hora
    dv.setUint16(o, 0x21, true); o += 2;     // fecha
    dv.setUint32(o, crc, true); o += 4;
    dv.setUint32(o, stored.length, true); o += 4;
    dv.setUint32(o, raw.length, true); o += 4;
    dv.setUint16(o, name.length, true); o += 2;
    dv.setUint16(o, 0, true); o += 2;        // extra
    dv.setUint16(o, 0, true); o += 2;        // comentario
    dv.setUint16(o, 0, true); o += 2;        // disco
    dv.setUint16(o, 0, true); o += 2;        // atributos internos
    dv.setUint32(o, 0, true); o += 4;        // atributos externos
    dv.setUint32(o, localOffset, true); o += 4;
    buf.set(name, o); o += name.length;

    // Fin del directorio central
    dv.setUint32(o, 0x06054b50, true); o += 4;
    dv.setUint16(o, 0, true); o += 2;        // disco
    dv.setUint16(o, 0, true); o += 2;        // disco del directorio
    dv.setUint16(o, 1, true); o += 2;        // entradas en este disco
    dv.setUint16(o, 1, true); o += 2;        // entradas totales
    dv.setUint32(o, centralSize, true); o += 4;
    dv.setUint32(o, centralStart, true); o += 4;
    dv.setUint16(o, 0, true);                // longitud comentario

    return buf;
}

// Constructor STORE multi-entrada SIN validar rutas, para reproducir paquetes
// de herramientas externas que incluyen marcadores de directorio ("media/").
function buildStoredZip(entries: { path: string; data: Uint8Array }[]): Uint8Array {
    const prepared = entries.map((e) => ({
        name: encoder.encode(e.path),
        data: e.data,
        crc: crc32(e.data),
    }));
    const localSize = prepared.reduce((t, e) => t + 30 + e.name.length + e.data.length, 0);
    const centralSize = prepared.reduce((t, e) => t + 46 + e.name.length, 0);
    const buf = new Uint8Array(localSize + centralSize + 22);
    const dv = new DataView(buf.buffer);
    const offsets: number[] = [];
    let o = 0;

    for (const e of prepared) {
        offsets.push(o);
        dv.setUint32(o, 0x04034b50, true); o += 4;
        dv.setUint16(o, 20, true); o += 2;
        dv.setUint16(o, 0x0800, true); o += 2;
        dv.setUint16(o, 0, true); o += 2;        // método STORE
        dv.setUint16(o, 0, true); o += 2;
        dv.setUint16(o, 0x21, true); o += 2;
        dv.setUint32(o, e.crc, true); o += 4;
        dv.setUint32(o, e.data.length, true); o += 4;
        dv.setUint32(o, e.data.length, true); o += 4;
        dv.setUint16(o, e.name.length, true); o += 2;
        dv.setUint16(o, 0, true); o += 2;
        buf.set(e.name, o); o += e.name.length;
        buf.set(e.data, o); o += e.data.length;
    }

    const centralStart = o;
    prepared.forEach((e, i) => {
        dv.setUint32(o, 0x02014b50, true); o += 4;
        dv.setUint16(o, 20, true); o += 2;
        dv.setUint16(o, 20, true); o += 2;
        dv.setUint16(o, 0x0800, true); o += 2;
        dv.setUint16(o, 0, true); o += 2;
        dv.setUint16(o, 0, true); o += 2;
        dv.setUint16(o, 0x21, true); o += 2;
        dv.setUint32(o, e.crc, true); o += 4;
        dv.setUint32(o, e.data.length, true); o += 4;
        dv.setUint32(o, e.data.length, true); o += 4;
        dv.setUint16(o, e.name.length, true); o += 2;
        dv.setUint16(o, 0, true); o += 2;
        dv.setUint16(o, 0, true); o += 2;
        dv.setUint16(o, 0, true); o += 2;
        dv.setUint16(o, 0, true); o += 2;
        dv.setUint32(o, 0, true); o += 4;
        dv.setUint32(o, offsets[i], true); o += 4;
        buf.set(e.name, o); o += e.name.length;
    });

    dv.setUint32(o, 0x06054b50, true); o += 4;
    dv.setUint16(o, 0, true); o += 2;
    dv.setUint16(o, 0, true); o += 2;
    dv.setUint16(o, prepared.length, true); o += 2;
    dv.setUint16(o, prepared.length, true); o += 2;
    dv.setUint32(o, centralSize, true); o += 4;
    dv.setUint32(o, centralStart, true); o += 4;
    dv.setUint16(o, 0, true);

    return buf;
}

describe("createStoredZip y parseStoredZip", () => {
    it("crea y lee un paquete ZIP sin compresión", () => {
        const zip = createStoredZip([
            { path: "datos.json", data: JSON.stringify({ datos: [{ Nombre: "Pelayo" }] }) },
            { path: "media/pelayo.txt", data: "imagen simulada" },
        ]);

        const entries = parseStoredZip(zip);

        expect(entries.map((entry) => entry.path)).toEqual(["datos.json", "media/pelayo.txt"]);
        expect(JSON.parse(textOf(entries[0].data))).toEqual({ datos: [{ Nombre: "Pelayo" }] });
        expect(textOf(entries[1].data)).toBe("imagen simulada");
    });

    it("rechaza rutas peligrosas", () => {
        expect(() => validateZipPath("../datos.json")).toThrow(/Ruta ZIP no válida/);
        expect(() => validateZipPath("/datos.json")).toThrow(/Ruta ZIP no válida/);
        expect(() => validateZipPath("C:/datos.json")).toThrow(/Ruta ZIP no válida/);
        expect(() => validateZipPath("media/../datos.json")).toThrow(/Ruta ZIP no válida/);
    });

    it("normaliza separadores internos de Windows sin permitir rutas absolutas", () => {
        expect(validateZipPath("media\\pelayo.jpg")).toBe("media/pelayo.jpg");
    });

    it("rechaza rutas duplicadas al crear el paquete", () => {
        expect(() =>
            createStoredZip([
                { path: "datos.json", data: "{}" },
                { path: "datos.json", data: "{}" },
            ])
        ).toThrow(/duplicada/);
    });
});

describe("parseZip (lector general STORED + DEFLATE)", () => {
    it("lee un paquete STORED creado por la propia app", async () => {
        const zip = createStoredZip([
            { path: "datos.json", data: JSON.stringify({ datos: [{ Nombre: "Pelayo" }] }) },
            { path: "media/pelayo.txt", data: "imagen simulada" },
        ]);

        const entries = await parseZip(zip);

        expect(entries.map((entry) => entry.path)).toEqual(["datos.json", "media/pelayo.txt"]);
        expect(JSON.parse(textOf(entries[0].data))).toEqual({ datos: [{ Nombre: "Pelayo" }] });
        expect(textOf(entries[1].data)).toBe("imagen simulada");
    });

    it("lee una entrada DEFLATE como las que generan 7-Zip, WinRAR o Windows", async () => {
        const content = JSON.stringify({ datos: Array.from({ length: 50 }, (_, i) => ({ ID: i })) });
        const raw = encoder.encode(content);
        const compressed = new Uint8Array(deflateRawSync(raw));
        const zip = buildSingleEntryZip("datos.json", raw, 8, compressed);

        const entries = await parseZip(zip);

        expect(entries).toHaveLength(1);
        expect(textOf(entries[0].data)).toBe(content);
    });

    it("detecta datos corruptos por CRC", async () => {
        const raw = encoder.encode("contenido íntegro");
        const zip = buildSingleEntryZip("datos.json", raw, 0, raw); // STORED
        const dataStart = 30 + encoder.encode("datos.json").length;
        zip[dataStart] ^= 0xff; // corromper el primer byte de datos

        await expect(parseZip(zip)).rejects.toThrow(/CRC/);
    });

    it("rechaza métodos de compresión no soportados", async () => {
        const raw = encoder.encode("x");
        const zip = buildSingleEntryZip("datos.json", raw, 99, raw);

        await expect(parseZip(zip)).rejects.toThrow(/método de compresión no soportado/);
    });

    it("ignora entradas de directorio que añaden Windows 11, 7-Zip, etc.", async () => {
        // Reproduce el zip real del diálogo "Crear archivo" de Windows 11, que
        // incluye un marcador de carpeta "media/" (tamaño 0, nombre con "/").
        const zip = buildStoredZip([
            { path: "media/", data: new Uint8Array(0) },
            { path: "datos.json", data: encoder.encode('{"datos":[]}') },
            { path: "media/foto.txt", data: encoder.encode("binario") },
        ]);

        const entries = await parseZip(zip);

        expect(entries.map((entry) => entry.path)).toEqual(["datos.json", "media/foto.txt"]);
        expect(textOf(entries[0].data)).toBe('{"datos":[]}');
    });
});

describe("inflateRaw (defensa anti-bomba de descompresión)", () => {
    it("descomprime correctamente dentro del tope", async () => {
        const compressed = new Uint8Array(deflateRawSync(encoder.encode("hola mundo")));
        const out = await inflateRaw(compressed, 1024);
        expect(textOf(out)).toBe("hola mundo");
    });

    it("aborta si la salida supera el tope permitido", async () => {
        // 5 KB muy repetitivos comprimen a poquísimo, pero se descomprimen por
        // encima de un tope de 100 bytes: simula una bomba de descompresión.
        const compressed = new Uint8Array(deflateRawSync(new Uint8Array(5000).fill(65)));
        await expect(inflateRaw(compressed, 100)).rejects.toThrow(/supera el tamaño/);
    });
});
