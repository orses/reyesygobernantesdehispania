// ---------------------------------------------------------------------------
// Pruebas unitarias: señal de sustitución completa del dataset.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
    isPendingDatasetReplacement,
    nextDatasetReplacementRevision,
} from "./dataset-revision";

describe("nextDatasetReplacementRevision", () => {
    it("distingue dos sustituciones consecutivas sin depender de Date.now", () => {
        const first = nextDatasetReplacementRevision(0);
        const second = nextDatasetReplacementRevision(first);

        expect(first).toBe(1);
        expect(second).toBe(2);
    });

    it("rechaza estados internos no válidos", () => {
        expect(() => nextDatasetReplacementRevision(-1)).toThrow(/entero seguro/);
        expect(() => nextDatasetReplacementRevision(1.5)).toThrow(/entero seguro/);
    });

    it("reinicia de forma segura tras alcanzar el máximo entero representable", () => {
        expect(nextDatasetReplacementRevision(Number.MAX_SAFE_INTEGER)).toBe(1);
    });
});

describe("isPendingDatasetReplacement", () => {
    it("ignora el estado inicial y una revisión ya consumida", () => {
        expect(isPendingDatasetReplacement(0, 0)).toBe(false);
        expect(isPendingDatasetReplacement(3, 3)).toBe(false);
    });

    it("detecta cada revisión nueva", () => {
        expect(isPendingDatasetReplacement(3, 2)).toBe(true);
        expect(isPendingDatasetReplacement(1, Number.MAX_SAFE_INTEGER)).toBe(true);
    });
});
