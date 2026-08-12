// Comprueba presupuestos reproducibles de carga después de `vite build`.

import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
import process from "node:process";

const DIST_DIRECTORY = path.resolve(process.cwd(), "dist");
const MANIFEST_PATH = path.join(DIST_DIRECTORY, ".vite", "manifest.json");
const FAVICON_PATH = path.resolve(process.cwd(), "public", "favicon.png");

const MAX_INITIAL_JAVASCRIPT_GZIP_BYTES = 180 * 1024;
const MAX_LAZY_CHUNK_GZIP_BYTES = 125 * 1024;
const MIN_LAZY_ENTRY_COUNT = 5;
const MAX_FAVICON_BYTES = 460 * 1024;

function formatKibibytes(bytes) {
    return `${(bytes / 1024).toFixed(2)} KiB`;
}

async function gzipFileSize(relativePath) {
    const data = await readFile(path.join(DIST_DIRECTORY, relativePath));
    return gzipSync(data).byteLength;
}

function collectStaticImports(manifest, entryKey, collected = new Set()) {
    if (collected.has(entryKey)) return collected;
    const entry = manifest[entryKey];
    if (!entry) throw new Error(`El manifiesto referencia una entrada inexistente: ${entryKey}.`);

    collected.add(entryKey);
    for (const importedKey of entry.imports ?? []) {
        collectStaticImports(manifest, importedKey, collected);
    }
    return collected;
}

function failIfExceeded(label, measured, maximum, errors) {
    if (measured <= maximum) return;
    errors.push(
        `${label}: ${formatKibibytes(measured)} supera ${formatKibibytes(maximum)}.`
    );
}

async function main() {
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
    const entryPair = Object.entries(manifest).find(([, value]) => value.isEntry);
    if (!entryPair) throw new Error("El manifiesto de Vite no contiene una entrada principal.");

    const [entryKey] = entryPair;
    const initialEntryKeys = [...collectStaticImports(manifest, entryKey)];
    const initialFiles = Array.from(new Set(
        initialEntryKeys.map((key) => manifest[key].file)
    ));
    const initialGzipSizes = await Promise.all(initialFiles.map(gzipFileSize));
    const initialGzipBytes = initialGzipSizes.reduce((total, size) => total + size, 0);

    const lazyEntries = Object.values(manifest).filter((entry) => entry.isDynamicEntry);
    const lazySizes = await Promise.all(lazyEntries.map(async (entry) => ({
        file: entry.file,
        gzipBytes: await gzipFileSize(entry.file),
    })));
    const largestLazyChunk = lazySizes.sort(
        (left, right) => right.gzipBytes - left.gzipBytes
    )[0];
    const faviconBytes = (await stat(FAVICON_PATH)).size;
    const errors = [];

    failIfExceeded(
        "JavaScript inicial",
        initialGzipBytes,
        MAX_INITIAL_JAVASCRIPT_GZIP_BYTES,
        errors
    );
    if (largestLazyChunk) {
        failIfExceeded(
            `Fragmento diferido mayor (${largestLazyChunk.file})`,
            largestLazyChunk.gzipBytes,
            MAX_LAZY_CHUNK_GZIP_BYTES,
            errors
        );
    }
    if (lazyEntries.length < MIN_LAZY_ENTRY_COUNT) {
        errors.push(
            `Solo hay ${lazyEntries.length} entradas diferidas; se esperaban al menos ${MIN_LAZY_ENTRY_COUNT}.`
        );
    }
    failIfExceeded("Favicon", faviconBytes, MAX_FAVICON_BYTES, errors);

    console.log(`JavaScript inicial gzip: ${formatKibibytes(initialGzipBytes)}.`);
    console.log(`Entradas diferidas: ${lazyEntries.length}.`);
    console.log(
        largestLazyChunk
            ? `Fragmento diferido mayor: ${largestLazyChunk.file}, ${formatKibibytes(largestLazyChunk.gzipBytes)}.`
            : "Fragmento diferido mayor: ninguno."
    );
    console.log(`Favicon: ${formatKibibytes(faviconBytes)}.`);

    if (errors.length > 0) {
        throw new Error(`Presupuesto de recursos incumplido:\n- ${errors.join("\n- ")}`);
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
