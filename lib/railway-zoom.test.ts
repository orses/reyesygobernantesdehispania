import { describe, expect, it } from "vitest";
import {
  MAX_RAILWAY_ZOOM,
  MIN_RAILWAY_ZOOM,
  centeredRailwayScrollLeft,
  clampRailwayZoom,
  nextRailwayZoom,
  railwayZoomToPercent,
} from "./railway-zoom";

describe("zoom del gráfico ferroviario", () => {
  it("limita la escala y avanza en pasos previsibles", () => {
    expect(clampRailwayZoom(0)).toBe(MIN_RAILWAY_ZOOM);
    expect(clampRailwayZoom(99)).toBe(MAX_RAILWAY_ZOOM);
    expect(nextRailwayZoom(1, "in")).toBe(1.25);
    expect(nextRailwayZoom(1, "out")).toBe(0.75);
    expect(railwayZoomToPercent(1.25)).toBe(125);
  });

  it("conserva el centro temporal al estirar el lienzo", () => {
    expect(centeredRailwayScrollLeft(400, 800, 2000, 4000)).toBe(1200);
    expect(centeredRailwayScrollLeft(0, 800, 2000, 1000)).toBe(0);

    const expanded = centeredRailwayScrollLeft(700, 600, 2000, 4000, 200, 100);
    const restored = centeredRailwayScrollLeft(expanded, 600, 4000, 2000, 200, 100);
    expect(restored).toBeCloseTo(700, 8);
  });

  it("se recupera de geometrías no válidas", () => {
    expect(centeredRailwayScrollLeft(10, 100, 0, 200)).toBe(0);
    expect(centeredRailwayScrollLeft(Number.NaN, 100, 200, 400)).toBe(0);
  });
});
