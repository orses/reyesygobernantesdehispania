import { describe, expect, it } from "vitest";
import {
    DEFAULT_IMAGE_ZOOM,
    MAX_IMAGE_ZOOM,
    MIN_IMAGE_ZOOM,
    clampImageZoom,
    imageZoomFromPercent,
    imageZoomToPercent,
    nextImageZoom,
} from "./image-zoom";

describe("zoom de imágenes", () => {
    it("limita el zoom a los valores admitidos", () => {
        expect(clampImageZoom(0)).toBe(MIN_IMAGE_ZOOM);
        expect(clampImageZoom(8)).toBe(MAX_IMAGE_ZOOM);
    });

    it("usa el zoom por defecto ante valores no numéricos", () => {
        expect(clampImageZoom(Number.NaN)).toBe(DEFAULT_IMAGE_ZOOM);
    });

    it("calcula el siguiente paso de ampliación y reducción", () => {
        expect(nextImageZoom(1, "in")).toBe(1.25);
        expect(nextImageZoom(1, "out")).toBe(0.75);
    });

    it("convierte entre escala interna y porcentaje visible", () => {
        expect(imageZoomToPercent(1.37)).toBe(137);
        expect(imageZoomFromPercent(150)).toBe(1.5);
        expect(imageZoomFromPercent(999)).toBe(MAX_IMAGE_ZOOM);
    });
});
