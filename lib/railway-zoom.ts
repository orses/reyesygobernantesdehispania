export const DEFAULT_RAILWAY_ZOOM = 1;
export const MIN_RAILWAY_ZOOM = 0.25;
export const MAX_RAILWAY_ZOOM = 4;
export const RAILWAY_ZOOM_STEP = 0.25;

export type RailwayZoomDirection = "in" | "out";

export function clampRailwayZoom(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RAILWAY_ZOOM;
  return Math.min(MAX_RAILWAY_ZOOM, Math.max(MIN_RAILWAY_ZOOM, value));
}

export function nextRailwayZoom(
  currentZoom: number,
  direction: RailwayZoomDirection
): number {
  const step = direction === "in" ? RAILWAY_ZOOM_STEP : -RAILWAY_ZOOM_STEP;
  return clampRailwayZoom(Number((currentZoom + step).toFixed(2)));
}

export function railwayZoomToPercent(value: number): number {
  return Math.round(clampRailwayZoom(value) * 100);
}

/**
 * Mantiene el mismo punto central del contenido al cambiar la anchura del
 * lienzo. El navegador aplicará después sus límites físicos de desplazamiento.
 */
export function centeredRailwayScrollLeft(
  scrollLeft: number,
  viewportWidth: number,
  previousCanvasWidth: number,
  nextCanvasWidth: number,
  leftGutter = 0,
  rightGutter = 0
): number {
  if (
    !Number.isFinite(scrollLeft)
    || !Number.isFinite(viewportWidth)
    || !Number.isFinite(previousCanvasWidth)
    || !Number.isFinite(nextCanvasWidth)
    || previousCanvasWidth <= 0
    || nextCanvasWidth <= 0
    || leftGutter < 0
    || rightGutter < 0
  ) {
    return 0;
  }
  const safeViewportWidth = Math.max(0, viewportWidth);
  const previousDrawableWidth = Math.max(
    1,
    previousCanvasWidth - leftGutter - rightGutter
  );
  const nextDrawableWidth = Math.max(1, nextCanvasWidth - leftGutter - rightGutter);
  const previousCenter = Math.max(0, scrollLeft) + safeViewportWidth / 2;
  const yearRatio = Math.min(
    1,
    Math.max(0, (previousCenter - leftGutter) / previousDrawableWidth)
  );
  const nextCenter = leftGutter + yearRatio * nextDrawableWidth;
  const unclampedScrollLeft = Math.max(0, nextCenter - safeViewportWidth / 2);
  return Math.min(Math.max(0, nextCanvasWidth - safeViewportWidth), unclampedScrollLeft);
}
