export const DEFAULT_IMAGE_ZOOM = 1;
export const MIN_IMAGE_ZOOM = 0.25;
export const MAX_IMAGE_ZOOM = 4;
export const IMAGE_ZOOM_STEP = 0.25;
export const MIN_IMAGE_ZOOM_PERCENT = MIN_IMAGE_ZOOM * 100;
export const MAX_IMAGE_ZOOM_PERCENT = MAX_IMAGE_ZOOM * 100;

export type ImageZoomDirection = "in" | "out";

export function clampImageZoom(value: number): number {
    if (!Number.isFinite(value)) return DEFAULT_IMAGE_ZOOM;
    return Math.min(MAX_IMAGE_ZOOM, Math.max(MIN_IMAGE_ZOOM, value));
}

export function nextImageZoom(currentZoom: number, direction: ImageZoomDirection): number {
    const step = direction === "in" ? IMAGE_ZOOM_STEP : -IMAGE_ZOOM_STEP;
    return clampImageZoom(Number((currentZoom + step).toFixed(2)));
}

export function imageZoomToPercent(value: number): number {
    return Math.round(clampImageZoom(value) * 100);
}

export function imageZoomFromPercent(value: number): number {
    return clampImageZoom(value / 100);
}
