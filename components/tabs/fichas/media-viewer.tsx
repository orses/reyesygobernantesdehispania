import { useEffect, useMemo, useRef, useState } from "react";
import type * as React from "react";
import { createPortal } from "react-dom";
import { RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "../../ui/button";
import { mediaAssetSrc } from "../../../lib/ficha-view";
import {
  DEFAULT_IMAGE_ZOOM,
  MAX_IMAGE_ZOOM_PERCENT,
  MIN_IMAGE_ZOOM_PERCENT,
  clampImageZoom,
  imageZoomFromPercent,
  imageZoomToPercent,
  nextImageZoom,
} from "../../../lib/image-zoom";
import type { MediaAsset } from "../../../lib/types";

interface MediaViewerProps {
  asset: MediaAsset | null;
  previewUrls: Record<string, string>;
  personName: string;
  onClose: () => void;
}

export function MediaViewer({ asset, previewUrls, personName, onClose }: MediaViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const panStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_IMAGE_ZOOM);
  const [zoomInput, setZoomInput] = useState(String(imageZoomToPercent(DEFAULT_IMAGE_ZOOM)));
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const src = useMemo(() => mediaAssetSrc(asset, previewUrls), [asset, previewUrls]);
  const title = asset?.title || asset?.fileName || personName;

  useEffect(() => {
    setZoom(DEFAULT_IMAGE_ZOOM);
    setZoomInput(String(imageZoomToPercent(DEFAULT_IMAGE_ZOOM)));
    setNaturalWidth(null);
    setIsPanning(false);
    panStateRef.current = null;
  }, [asset?.id, src]);

  useEffect(() => {
    setZoomInput(String(imageZoomToPercent(zoom)));
  }, [zoom]);

  useEffect(() => {
    if (!asset || !src || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    viewportRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (!event.ctrlKey && !event.metaKey) return;

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoom((currentZoom) => nextImageZoom(currentZoom, "in"));
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setZoom((currentZoom) => nextImageZoom(currentZoom, "out"));
      }

      if (event.key === "0") {
        event.preventDefault();
        setZoom(DEFAULT_IMAGE_ZOOM);
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;

      event.preventDefault();
      setZoom((currentZoom) => nextImageZoom(currentZoom, event.deltaY < 0 ? "in" : "out"));
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("wheel", handleWheel);
    };
  }, [asset, src, onClose]);

  if (!asset || !src || typeof document === "undefined") return null;

  const commitZoomInput = () => {
    const nextPercent = Number.parseFloat(zoomInput.replace(",", "."));
    if (!Number.isFinite(nextPercent)) {
      setZoomInput(String(imageZoomToPercent(zoom)));
      return;
    }
    setZoom(imageZoomFromPercent(nextPercent));
  };

  const stopPanning = () => {
    panStateRef.current = null;
    setIsPanning(false);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    const canPan =
      viewport.scrollWidth > viewport.clientWidth ||
      viewport.scrollHeight > viewport.clientHeight;

    if (!canPan) return;

    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);
    panStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    setIsPanning(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const panState = panStateRef.current;
    if (!viewport || !panState || panState.pointerId !== event.pointerId) return;

    event.preventDefault();
    viewport.scrollLeft = panState.scrollLeft - (event.clientX - panState.startX);
    viewport.scrollTop = panState.scrollTop - (event.clientY - panState.startY);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const panState = panStateRef.current;
    if (viewport && panState?.pointerId === event.pointerId && viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    stopPanning();
  };

  const imageWidth = naturalWidth ? `${Math.round(naturalWidth * clampImageZoom(zoom))}px` : undefined;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-slate-950 text-slate-50"
      role="dialog"
      aria-modal="true"
      aria-label={`Visor de imagen: ${title}`}
    >
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-100">
            {title}
            {asset.workDate ? <span className="ml-2 font-normal text-slate-400">({asset.workDate})</span> : null}
          </div>
          <div className="text-xs font-semibold tabular-nums text-slate-400">{Math.round(zoom * 100)} %</div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-[3px] border-slate-700 bg-slate-950/60"
            onClick={() => setZoom((currentZoom) => nextImageZoom(currentZoom, "out"))}
            title="Reducir"
            aria-label="Reducir"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <label className="flex h-9 items-center gap-1 rounded-[3px] border border-slate-700 bg-slate-950/60 px-2 text-xs font-semibold text-slate-300">
            <span className="sr-only">Zoom personalizado</span>
            <input
              type="number"
              min={MIN_IMAGE_ZOOM_PERCENT}
              max={MAX_IMAGE_ZOOM_PERCENT}
              step={5}
              value={zoomInput}
              onChange={(event) => setZoomInput(event.target.value)}
              onBlur={commitZoomInput}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                commitZoomInput();
                event.currentTarget.blur();
              }}
              className="h-7 w-16 rounded-[3px] border border-slate-700 bg-slate-900 px-2 text-right text-xs font-semibold tabular-nums text-slate-100 outline-none focus:border-emerald-300"
              aria-label="Zoom personalizado"
            />
            <span>%</span>
          </label>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-[3px] border-slate-700 bg-slate-950/60"
            onClick={() => setZoom(DEFAULT_IMAGE_ZOOM)}
            title="Restablecer al 100 %"
            aria-label="Restablecer al 100 %"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-[3px] border-slate-700 bg-slate-950/60"
            onClick={() => setZoom((currentZoom) => nextImageZoom(currentZoom, "in"))}
            title="Aumentar"
            aria-label="Aumentar"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="ml-2 h-9 w-9 rounded-[3px] border-slate-700 bg-slate-950/60"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`min-h-0 flex-1 overflow-auto bg-slate-950 outline-none ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        tabIndex={-1}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={stopPanning}
        onLostPointerCapture={stopPanning}
      >
        <div className="min-h-full min-w-full p-4">
          <img
            src={src}
            alt={asset.title || `imagen de ${personName}`}
            className="pointer-events-none mx-auto h-auto max-w-none select-none"
            draggable={false}
            style={{ width: imageWidth }}
            onLoad={(event) => {
              setNaturalWidth(event.currentTarget.naturalWidth);
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
