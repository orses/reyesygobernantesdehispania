import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { kingdomColor } from "../../../lib/ficha-view";
import {
  DEFAULT_RAILWAY_ZOOM,
  MAX_RAILWAY_ZOOM,
  MIN_RAILWAY_ZOOM,
  centeredRailwayScrollLeft,
  clampRailwayZoom,
  nextRailwayZoom,
  railwayZoomToPercent,
} from "../../../lib/railway-zoom";
import {
  RAILWAY_KINGDOMS,
  railwayKingdomLabel,
  type RailwayKingdom,
  type RailwayProjection,
  type RailwayProjectedTransition,
  type RailwayStation,
} from "../../../lib/railway";
import type { TimelineScale } from "../../../lib/timeline";
import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";

interface RailwayViewProps {
  projection: RailwayProjection;
  issueCount: number;
  selectedPeriodId: string | null;
  onSelectPeriod: (periodId: string) => void;
}

const AXIS_HEIGHT = 48;
const LANE_HEIGHT = 184;
const RAIL_OFFSET = 92;
const LEFT_GUTTER = 216;
const RIGHT_GUTTER = 54;
const LABEL_OFFSETS = [-30, 46, -52, 68, -74, 90] as const;
const LABEL_GAP = 8;
const MIN_LABEL_WIDTH = 48;
const MAX_LABEL_WIDTH = 132;
const MIN_CANVAS_WIDTH = 1180;

export function railwayCanvasWidth(
  projection: RailwayProjection,
  zoom = DEFAULT_RAILWAY_ZOOM,
  fitWidth?: number
): number {
  if (fitWidth !== undefined && Number.isFinite(fitWidth)) {
    return Math.max(LEFT_GUTTER + RIGHT_GUTTER + 1, Math.round(fitWidth));
  }
  const chronologicalWidth = projection.scale.totalYears * 5 + LEFT_GUTTER + RIGHT_GUTTER;
  const baseWidth = Math.max(MIN_CANVAS_WIDTH, chronologicalWidth);
  const zoomedWidth = Math.round(baseWidth * clampRailwayZoom(zoom));
  return zoomedWidth;
}

function yearX(year: number, scale: TimelineScale, width: number): number {
  const drawableWidth = Math.max(1, width - LEFT_GUTTER - RIGHT_GUTTER);
  const ratio = (year - scale.minYear) / scale.totalYears;
  return LEFT_GUTTER + Math.min(1, Math.max(0, ratio)) * drawableWidth;
}

function trackColor(kingdom: RailwayKingdom): string {
  return kingdomColor(railwayKingdomLabel(kingdom)) ?? "#64748b";
}

function stationAriaLabel(
  name: string,
  kingdom: RailwayKingdom,
  startYear: number,
  endYear: number | null
): string {
  const end = endYear === null ? "final desconocido" : String(endYear);
  return `${name}, ${railwayKingdomLabel(kingdom)}, ${startYear}-${end}`;
}

function transitionPath(
  x: number,
  sourceY: number,
  targetY: number,
  kind: RailwayProjectedTransition["kind"]
): string {
  const controlX = x + (kind === "merge" ? 18 : -18);
  return [
    `M ${x} ${sourceY}`,
    `C ${controlX} ${sourceY}, ${controlX} ${targetY}, ${x} ${targetY}`,
  ].join(" ");
}

function mainlineHandoffPath(x: number, sourceY: number, targetY: number): string {
  return [
    `M ${x} ${sourceY}`,
    `C ${x + 30} ${sourceY}, ${x - 30} ${targetY}, ${x} ${targetY}`,
  ].join(" ");
}

function transitionConnectorPairs(
  transition: RailwayProjectedTransition,
  laneY: ReadonlyMap<RailwayKingdom, number>
): Array<{
  sourceY: number;
  targetY: number;
  sourceKingdom: RailwayKingdom;
  targetKingdom: RailwayKingdom;
}> {
  const anchors = transition.anchors
    .map((anchor) => ({ ...anchor, y: laneY.get(anchor.kingdom) }))
    .filter((anchor): anchor is typeof anchor & { y: number } => anchor.y !== undefined);

  if (
    transition.kind === "dynastic-union"
    || transition.kind === "dynastic-separation"
  ) {
    const sortedAnchors = [...anchors].sort((left, right) => left.y - right.y);
    const source = sortedAnchors[0];
    const target = sortedAnchors[sortedAnchors.length - 1];
    if (!source || !target || source === target) return [];
    return [{
      sourceY: source.y,
      targetY: target.y,
      sourceKingdom: source.kingdom,
      targetKingdom: target.kingdom,
    }];
  }

  const sources = anchors.filter((anchor) => anchor.role === "source");
  const targets = anchors.filter((anchor) => anchor.role === "target");
  if (!sources.length || !targets.length) return [];

  if (transition.kind === "merge") {
    return sources.flatMap((source) =>
      targets
        .filter((target) => target.y !== source.y)
        .map((target) => ({
          sourceY: source.y,
          targetY: target.y,
          sourceKingdom: source.kingdom,
          targetKingdom: target.kingdom,
        }))
    );
  }

  return targets.flatMap((target) =>
    sources
      .filter((source) => source.y !== target.y)
      .map((source) => ({
        sourceY: source.y,
        targetY: target.y,
        sourceKingdom: source.kingdom,
        targetKingdom: target.kingdom,
      }))
  );
}

export interface RailwayLabelPlacement {
  level: number;
  isVisible: boolean;
}

function estimatedLabelWidth(name: string): number {
  const textWidth = Array.from(name.trim()).length * 5.8 + 18;
  return Math.min(MAX_LABEL_WIDTH, Math.max(MIN_LABEL_WIDTH, textWidth));
}

export function railwayLabelPlacements(
  projection: RailwayProjection,
  width: number
): Map<string, RailwayLabelPlacement> {
  const output = new Map<string, RailwayLabelPlacement>();

  for (const track of projection.tracks) {
    const stations = projection.stations
      .filter((station) => station.kingdom === track.kingdom)
      .sort((left, right) => left.startYear - right.startYear || left.rowId.localeCompare(right.rowId));
    const rightEdges = LABEL_OFFSETS.map(() => Number.NEGATIVE_INFINITY);

    for (const station of stations) {
      const x = yearX(station.startYear, projection.scale, width);
      const halfWidth = estimatedLabelWidth(station.name) / 2;
      const leftEdge = x - halfWidth;
      const level = rightEdges.findIndex((rightEdge) => rightEdge + LABEL_GAP <= leftEdge);
      if (level < 0) {
        output.set(station.id, {
          level: LABEL_OFFSETS.length - 1,
          isVisible: false,
        });
        continue;
      }
      output.set(station.id, { level, isVisible: true });
      rightEdges[level] = x + halfWidth;
    }
  }

  return output;
}

function compareStationsForNavigation(left: RailwayStation, right: RailwayStation): number {
  return left.startYear - right.startYear || left.rowId.localeCompare(right.rowId);
}

export function findRailwayNavigationTarget(
  stations: readonly RailwayStation[],
  visibleKingdoms: readonly RailwayKingdom[],
  currentPeriodId: string,
  key: string
): RailwayStation | null {
  const current = stations.find((station) => station.periodId === currentPeriodId);
  if (!current) return null;

  const currentTrackStations = stations
    .filter((station) => station.kingdom === current.kingdom)
    .sort(compareStationsForNavigation);
  const currentTrackStationIndex = currentTrackStations.findIndex(
    (station) => station.periodId === currentPeriodId
  );

  if (key === "ArrowLeft") return currentTrackStations[currentTrackStationIndex - 1] ?? null;
  if (key === "ArrowRight") return currentTrackStations[currentTrackStationIndex + 1] ?? null;
  if (key === "Home") return currentTrackStations[0] ?? null;
  if (key === "End") return currentTrackStations[currentTrackStations.length - 1] ?? null;

  const trackOffset = key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0;
  if (!trackOffset) return null;
  const currentTrackIndex = visibleKingdoms.indexOf(current.kingdom);
  const targetKingdom = visibleKingdoms[currentTrackIndex + trackOffset];
  if (!targetKingdom) return null;

  return stations
    .filter((station) => station.kingdom === targetKingdom)
    .sort((left, right) => {
      const byDistance = Math.abs(left.startYear - current.startYear)
        - Math.abs(right.startYear - current.startYear);
      return byDistance || compareStationsForNavigation(left, right);
    })[0] ?? null;
}

export function RailwayView({
  projection,
  issueCount,
  selectedPeriodId,
  onSelectPeriod,
}: RailwayViewProps) {
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);
  const previousWidthRef = useRef<number | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_RAILWAY_ZOOM);
  const [fitWidth, setFitWidth] = useState<number | undefined>(undefined);
  const [isExpanded, setIsExpanded] = useState(false);
  const width = railwayCanvasWidth(projection, zoom, fitWidth);
  const visibleKingdoms = projection.tracks.map((track) => track.kingdom);
  const laneY = useMemo(
    () => new Map(visibleKingdoms.map((kingdom, index) => [
      kingdom,
      AXIS_HEIGHT + index * LANE_HEIGHT + RAIL_OFFSET,
    ])),
    [visibleKingdoms]
  );
  const visibleTransitions = projection.transitions.filter((transition) =>
    transition.anchors.some(
      (anchor) => anchor.stationId !== null && laneY.has(anchor.kingdom)
    )
  );
  const hasMissingCastilianFinalUnionAnchor = visibleTransitions.some(
    (transition) => transition.definitionId === "union-definitiva-1230"
      && transition.anchors.some(
        (anchor) => anchor.kingdom === "Castilla" && anchor.stationId === null
      )
  );
  const height = Math.max(220, AXIS_HEIGHT + visibleKingdoms.length * LANE_HEIGHT + 18);
  const labelPlacements = useMemo(
    () => railwayLabelPlacements(projection, width),
    [projection, width]
  );
  const stationById = useMemo(
    () => new Map(projection.stations.map((station) => [station.id, station])),
    [projection.stations]
  );
  const orderedStations = useMemo(
    () => [...projection.stations].sort((left, right) => {
      if (left.startYear !== right.startYear) return left.startYear - right.startYear;
      const byKingdom = RAILWAY_KINGDOMS.indexOf(left.kingdom) - RAILWAY_KINGDOMS.indexOf(right.kingdom);
      return byKingdom || left.rowId.localeCompare(right.rowId);
    }),
    [projection.stations]
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    const topScroll = topScrollRef.current;
    const previousWidth = previousWidthRef.current;
    previousWidthRef.current = width;
    if (!viewport || !topScroll) return;

    if (previousWidth !== null && previousWidth !== width) {
      viewport.scrollLeft = centeredRailwayScrollLeft(
        viewport.scrollLeft,
        viewport.clientWidth,
        previousWidth,
        width,
        LEFT_GUTTER,
        RIGHT_GUTTER
      );
    }
    topScroll.scrollLeft = viewport.scrollLeft;
  }, [width, visibleKingdoms.length]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || fitWidth === undefined || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.max(1, Math.round(entry.contentRect.width));
      setFitWidth((current) => current === undefined || current === nextWidth ? current : nextWidth);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitWidth]);

  useEffect(() => {
    if (!isExpanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExpanded(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isExpanded]);

  function changeZoom(direction: "in" | "out") {
    if (fitWidth !== undefined) {
      setFitWidth(undefined);
      setZoom(MIN_RAILWAY_ZOOM);
      return;
    }
    setFitWidth(undefined);
    setZoom((current) => nextRailwayZoom(current, direction));
  }

  function resetZoom() {
    setFitWidth(undefined);
    setZoom(DEFAULT_RAILWAY_ZOOM);
  }

  function fitRailwayToViewport() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setZoom(MIN_RAILWAY_ZOOM);
    setFitWidth(Math.max(1, viewport.clientWidth));
    viewport.scrollLeft = 0;
    if (topScrollRef.current) topScrollRef.current.scrollLeft = 0;
  }

  function scrollToKingdom(value: string) {
    const kingdom = visibleKingdoms.find((candidate) => candidate === value);
    const viewport = viewportRef.current;
    if (!kingdom || !viewport) return;
    const y = laneY.get(kingdom);
    if (y === undefined) return;
    viewport.scrollTop = Math.max(0, y - viewport.clientHeight / 2);
  }

  function syncHorizontalScroll(source: HTMLDivElement, target: HTMLDivElement | null) {
    if (!target || syncingScrollRef.current) return;
    syncingScrollRef.current = true;
    target.scrollLeft = source.scrollLeft;
    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }

  function focusStation(periodId: string) {
    onSelectPeriod(periodId);
    window.requestAnimationFrame(() => {
      document.getElementById(`railway-${periodId}`)?.focus();
    });
  }

  function handleStationKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, periodId: string) {
    const target = findRailwayNavigationTarget(
      projection.stations,
      visibleKingdoms,
      periodId,
      event.key
    );
    if (!target) return;

    event.preventDefault();
    focusStation(target.periodId);
  }

  if (!projection.selectedKingdoms.length) {
    return (
      <div className="rounded-[3px] border border-slate-800 bg-slate-950/30 p-6 text-center text-sm text-slate-400">
        Seleccione al menos una entidad para proyectar el ferrocarril histórico.
      </div>
    );
  }

  if (!projection.stations.length) {
    return (
      <div className="rounded-[3px] border border-slate-800 bg-slate-950/30 p-6 text-center text-sm text-slate-400">
        Las entidades elegidas no contienen gobiernos cronológicos representables.
      </div>
    );
  }

  const firstTabbablePeriodId = selectedPeriodId
    && orderedStations.some((station) => station.periodId === selectedPeriodId)
    ? selectedPeriodId
    : orderedStations[0]?.periodId;

  return (
    <section
      className={cn(
        "grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-[3px] border border-slate-800/70 bg-slate-950/35",
        isExpanded && "fixed inset-2 z-[80] bg-slate-950 shadow-2xl"
      )}
      aria-label={`Ferrocarril histórico: ${projection.stations.length} gobiernos en ${projection.tracks.length} entidades`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-800 px-3 py-2 text-[11px] text-slate-400">
        <span className="font-medium text-slate-200">Lectura del mapa</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-6 rounded-full bg-slate-300" aria-hidden="true" />
          vía documentada en los datos
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-6 rounded-full border border-slate-100/70 bg-slate-300"
            aria-hidden="true"
          />
          vía principal de cada etapa
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-6 border-t border-dashed border-slate-400" aria-hidden="true" />
          hiato o anclaje incompleto
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-4 border-l border-dashed border-sky-300" aria-hidden="true" />
          mismo monarca; los reinos siguen separados
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-4 border-l-4 border-slate-200/70" aria-hidden="true" />
          relevo de la vía principal; la etapa anterior puede continuar
        </span>
        {issueCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            {issueCount} {issueCount === 1 ? "anclaje incompleto" : "anclajes incompletos"}
          </span>
        )}
        {hasMissingCastilianFinalUnionAnchor && (
          <span className="basis-full text-amber-100/85">
            No hay un ancla castellana disponible para la transición de 1230 dentro del alcance
            seleccionado.
          </span>
        )}
        <label className="ml-auto inline-flex items-center gap-1.5 text-slate-300">
          <span>Ir a</span>
          <select
            className="h-8 max-w-[230px] rounded-[3px] border border-slate-700 bg-slate-950 px-2 text-[11px] text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            value=""
            onChange={(event) => scrollToKingdom(event.currentTarget.value)}
            aria-label="Ir a una vía concreta"
          >
            <option value="" disabled>Seleccione una vía</option>
            {visibleKingdoms.map((kingdom) => (
              <option key={kingdom} value={kingdom}>
                {railwayKingdomLabel(kingdom)}
              </option>
            ))}
          </select>
        </label>
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Escala horizontal del ferrocarril"
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-[3px] border-slate-700 bg-slate-950/60"
            onClick={() => changeZoom("out")}
            disabled={fitWidth !== undefined || zoom <= MIN_RAILWAY_ZOOM}
            title="Comprimir la escala horizontal"
            aria-label="Comprimir la escala horizontal"
          >
            <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <output
            className="min-w-14 text-center text-xs font-medium tabular-nums text-slate-200"
            aria-live="polite"
            aria-label={fitWidth === undefined
              ? `Escala horizontal al ${railwayZoomToPercent(zoom)} %`
              : "Escala horizontal ajustada al ancho visible"}
          >
            {fitWidth === undefined ? `${railwayZoomToPercent(zoom)} %` : "Ajustado"}
          </output>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-[3px] border-slate-700 bg-slate-950/60"
            onClick={resetZoom}
            disabled={zoom === DEFAULT_RAILWAY_ZOOM && fitWidth === undefined}
            title="Restablecer la escala al 100 %"
            aria-label="Restablecer la escala al 100 %"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-[3px] border-slate-700 bg-slate-950/60"
            onClick={() => changeZoom("in")}
            disabled={zoom >= MAX_RAILWAY_ZOOM}
            title="Estirar la escala horizontal"
            aria-label="Estirar la escala horizontal"
          >
            <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-[3px] border-slate-700 bg-slate-950/60 px-2 text-[11px]"
            onClick={fitRailwayToViewport}
            title="Ajustar toda la cronología al ancho visible"
            aria-label="Ajustar toda la cronología al ancho visible"
          >
            Ajustar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-[3px] border-slate-700 bg-slate-950/60 px-2 text-[11px]"
            onClick={() => setIsExpanded((current) => !current)}
            title={isExpanded ? "Salir de la vista ampliada" : "Ampliar el gráfico"}
            aria-label={isExpanded ? "Salir de la vista ampliada" : "Ampliar el gráfico"}
            aria-pressed={isExpanded}
          >
            {isExpanded
              ? <Minimize2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              : <Maximize2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />}
            {isExpanded ? "Contraer" : "Ampliar"}
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
        <div
          ref={topScrollRef}
          className="overflow-x-auto overflow-y-hidden border-b border-slate-800 bg-slate-950/80 custom-scrollbar"
          onScroll={(event) => syncHorizontalScroll(event.currentTarget, viewportRef.current)}
          aria-label="Desplazamiento horizontal del ferrocarril histórico"
        >
          <div style={{ width, height: 14 }} />
        </div>

        <div
          ref={viewportRef}
          className="min-h-0 overflow-auto custom-scrollbar"
          onScroll={(event) => syncHorizontalScroll(event.currentTarget, topScrollRef.current)}
        >
          <div className="relative" style={{ width, height }}>
            <div className="sticky top-0 z-40 h-[48px] border-b border-slate-800 bg-slate-950/95 shadow-sm">
              {projection.scale.ticks.map((tick) => (
                <span
                  key={tick.year}
                  className={cn(
                    "pointer-events-none absolute top-2 -translate-x-1/2 px-1 text-[11px]",
                    tick.year % 100 === 0 ? "font-semibold text-amber-300" : "text-slate-400"
                  )}
                  style={{ left: yearX(tick.year, projection.scale, width) }}
                >
                  {tick.label}
                </span>
              ))}
            </div>

            <svg
              className="pointer-events-none absolute inset-0 z-0"
              width={width}
              height={height}
              aria-hidden="true"
            >
              {projection.scale.ticks.map((tick) => {
                const x = yearX(tick.year, projection.scale, width);
                return (
                  <line
                    key={`grid-${tick.year}`}
                    x1={x}
                    x2={x}
                    y1={AXIS_HEIGHT}
                    y2={height}
                    stroke="#1e293b"
                    strokeWidth="1"
                  />
                );
              })}

              {projection.tracks.flatMap((track) => {
                const services = track.serviceIds
                  .map((id) => projection.services.find((service) => service.id === id))
                  .filter((service): service is NonNullable<typeof service> => Boolean(service))
                  .sort((left, right) => left.startYear - right.startYear);
                const y = laneY.get(track.kingdom);
                if (y === undefined) return [];
                const color = trackColor(track.kingdom);
                const elements: React.ReactNode[] = [];

                services.forEach((service, index) => {
                  const startX = yearX(service.startYear, projection.scale, width);
                  const rawEndX = yearX(service.endYear, projection.scale, width);
                  const endX = Math.max(startX + 10, rawEndX);
                  elements.push(
                    <line
                      key={`${service.id}-base`}
                      x1={startX}
                      x2={endX}
                      y1={y}
                      y2={y}
                      stroke="#020617"
                      strokeWidth="11"
                      strokeLinecap="round"
                    />,
                    <line
                      key={service.id}
                      x1={startX}
                      x2={endX}
                      y1={y}
                      y2={y}
                      stroke={color}
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                  );

                  const nextService = services[index + 1];
                  if (nextService) {
                    elements.push(
                      <line
                        key={`${service.id}-gap`}
                        x1={rawEndX}
                        x2={yearX(nextService.startYear, projection.scale, width)}
                        y1={y}
                        y2={y}
                        stroke={color}
                        strokeWidth="2"
                        strokeDasharray="5 7"
                        opacity="0.55"
                      />
                    );
                  }
                });

                return elements;
              })}

              {projection.mainlineSegments?.flatMap((segment) => {
                const y = laneY.get(segment.kingdom);
                if (y === undefined || segment.startYear >= segment.endYear) return [];
                const startX = yearX(segment.startYear, projection.scale, width);
                const endX = yearX(segment.endYear, projection.scale, width);
                const color = trackColor(segment.kingdom);

                return [
                  <line
                    key={`${segment.id}-halo`}
                    x1={startX}
                    x2={endX}
                    y1={y}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeWidth="12"
                    strokeLinecap="round"
                    opacity="0.38"
                  />,
                  <line
                    key={segment.id}
                    x1={startX}
                    x2={endX}
                    y1={y}
                    y2={y}
                    data-railway-mainline="true"
                    data-mainline-kingdom={segment.kingdom}
                    data-mainline-start-year={segment.startYear}
                    data-mainline-end-year={segment.endYear}
                    stroke={color}
                    strokeWidth="8"
                    strokeLinecap="round"
                  />,
                ];
              })}

              {projection.personalUnions.flatMap((union) => {
                const first = stationById.get(union.stationIds[0]);
                const second = stationById.get(union.stationIds[1]);
                if (!first || !second) return [];
                const firstY = laneY.get(first.kingdom);
                const secondY = laneY.get(second.kingdom);
                if (firstY === undefined || secondY === undefined) return [];
                const x = yearX(union.startYear, projection.scale, width);
                return [
                  <line
                    key={union.id}
                    x1={x}
                    x2={x}
                    y1={firstY}
                    y2={secondY}
                    stroke="#7dd3fc"
                    strokeWidth="2"
                    strokeDasharray="4 5"
                    opacity="0.7"
                  />,
                ];
              })}

              {visibleTransitions.flatMap((transition) => {
                const x = yearX(transition.year, projection.scale, width);
                const pairs = transitionConnectorPairs(transition, laneY);
                if (transition.kind === "integration") {
                  return pairs.flatMap((pair, index) => {
                    const path = mainlineHandoffPath(x, pair.sourceY, pair.targetY);
                    return [
                      <path
                        key={`${transition.id}-${index}-halo`}
                        d={path}
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="12"
                        strokeLinecap="round"
                        opacity="0.38"
                      />,
                      <path
                        key={`${transition.id}-${index}`}
                        d={path}
                        data-railway-transition-connector="true"
                        data-transition-kind="integration"
                        data-transition-year={transition.year}
                        data-source-kingdom={pair.sourceKingdom}
                        data-target-kingdom={pair.targetKingdom}
                        fill="none"
                        stroke={trackColor(pair.targetKingdom)}
                        strokeWidth="8"
                        strokeLinecap="round"
                        opacity={transition.isAnchored ? 1 : 0.6}
                      />,
                    ];
                  });
                }
                return pairs.map((pair, index) => (
                  transition.kind === "dynastic-union"
                    || transition.kind === "dynastic-separation" ? (
                    <line
                      key={`${transition.id}-${index}`}
                      x1={x}
                      x2={x}
                      y1={pair.sourceY}
                      y2={pair.targetY}
                      stroke="#d1fae5"
                      strokeWidth="3"
                      strokeDasharray={transition.kind === "dynastic-union" ? "6 5" : "2 5"}
                      opacity={transition.isAnchored ? 0.9 : 0.55}
                    />
                  ) : (
                    <path
                      key={`${transition.id}-${index}`}
                      d={transitionPath(x, pair.sourceY, pair.targetY, transition.kind)}
                      data-railway-transition-connector="true"
                      data-transition-kind={transition.kind}
                      data-transition-year={transition.year}
                      data-source-kingdom={pair.sourceKingdom}
                      data-target-kingdom={pair.targetKingdom}
                      fill="none"
                      stroke={trackColor(
                        transition.kind === "merge"
                          ? pair.sourceKingdom
                          : pair.targetKingdom
                      )}
                      strokeWidth="4"
                      strokeDasharray={transition.isAnchored ? undefined : "6 5"}
                      strokeLinecap="round"
                      opacity={transition.isPartial ? 0.6 : 0.95}
                    />
                  )
                ));
              })}
            </svg>

            {projection.tracks.map((track) => {
              const y = laneY.get(track.kingdom);
              if (y === undefined) return null;
              const label = railwayKingdomLabel(track.kingdom);
              return (
                <div
                  key={`${track.id}-label-row`}
                  className="pointer-events-none absolute left-0 right-0 z-20"
                  style={{ top: y - 18 }}
                >
                  <div
                    className="sticky left-0 inline-flex h-9 max-w-[208px] items-center gap-2 rounded-r-[3px] border border-l-0 border-slate-700 bg-slate-950/95 px-3 text-xs font-medium text-slate-100 shadow-lg"
                    title={label}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-white/30"
                      style={{ backgroundColor: trackColor(track.kingdom) }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{label}</span>
                    <span className="text-slate-500">{track.stationIds.length}</span>
                  </div>
                </div>
              );
            })}

            {orderedStations.map((station) => {
              const y = laneY.get(station.kingdom);
              if (y === undefined) return null;
              const x = yearX(station.startYear, projection.scale, width);
              const placement = labelPlacements.get(station.id) ?? {
                level: 0,
                isVisible: true,
              };
              const selected = station.periodId === selectedPeriodId;
              const inferred = station.period.isInferredStart;

              return (
                <div
                  key={station.id}
                  className={cn(
                    "group absolute z-20 h-11 w-11 -translate-x-1/2 -translate-y-1/2 focus-within:z-50",
                    selected && "z-40"
                  )}
                  style={{ left: x, top: y }}
                >
                  <button
                    id={`railway-${station.periodId}`}
                    type="button"
                    data-railway-station="true"
                    aria-label={stationAriaLabel(
                      station.name,
                      station.kingdom,
                      station.startYear,
                      station.endYear
                    )}
                    aria-pressed={selected}
                    tabIndex={station.periodId === firstTabbablePeriodId ? 0 : -1}
                    onClick={() => onSelectPeriod(station.periodId)}
                    onKeyDown={(event) => handleStationKeyDown(event, station.periodId)}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center overflow-visible rounded-full outline-none",
                      "focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    )}
                  >
                    <span
                      className={cn(
                        "block h-4 w-4 rounded-full border-[3px] border-slate-100 bg-slate-950 shadow-[0_0_0_3px_rgba(2,6,23,0.9)] transition-transform",
                        selected && "scale-125 border-emerald-200 bg-emerald-400",
                        inferred && "border-dashed border-amber-200",
                        !selected && "group-hover:scale-110"
                      )}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        "absolute left-1/2 z-30 max-w-[132px] -translate-x-1/2 truncate rounded-[3px] border px-1.5 py-0.5 text-center text-[10px] leading-tight shadow-sm transition-opacity",
                        selected
                          ? "border-emerald-400/60 bg-emerald-950/95 text-emerald-50"
                          : "border-slate-700/80 bg-slate-950/92 text-slate-200",
                        !placement.isVisible && !selected
                          ? "pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                          : "pointer-events-auto opacity-100"
                      )}
                      style={{ top: LABEL_OFFSETS[placement.level] }}
                      title={`${station.name} (${station.startYear})`}
                    >
                      {station.name}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
