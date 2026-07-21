import { useEffect, useMemo, useRef } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { kingdomColor } from "../../../lib/ficha-view";
import {
  RAILWAY_KINGDOMS,
  type RailwayKingdom,
  type RailwayProjection,
  type RailwayProjectedTransition,
  type RailwayStation,
} from "../../../lib/railway";
import { WESTERN_KINGDOMS_RAILWAY_SOURCES } from "../../../lib/railway-topology";
import type { TimelineScale } from "../../../lib/timeline";
import { cn } from "../../../lib/utils";

interface RailwayViewProps {
  projection: RailwayProjection;
  issueCount: number;
  selectedPeriodId: string | null;
  onSelectPeriod: (periodId: string) => void;
}

const AXIS_HEIGHT = 48;
const LANE_HEIGHT = 136;
const RAIL_OFFSET = 70;
const LEFT_GUTTER = 176;
const RIGHT_GUTTER = 54;
const LABEL_OFFSETS = [-28, 46, -48, 66] as const;

function canvasWidth(projection: RailwayProjection): number {
  const chronologicalWidth = projection.scale.totalYears * 5 + LEFT_GUTTER + RIGHT_GUTTER;
  return Math.max(1180, Math.min(5600, chronologicalWidth));
}

function yearX(year: number, scale: TimelineScale, width: number): number {
  const drawableWidth = width - LEFT_GUTTER - RIGHT_GUTTER;
  const ratio = (year - scale.minYear) / scale.totalYears;
  return LEFT_GUTTER + Math.min(1, Math.max(0, ratio)) * drawableWidth;
}

function trackColor(kingdom: RailwayKingdom): string {
  return kingdomColor(`Reino de ${kingdom}`) ?? "#64748b";
}

function stationAriaLabel(
  name: string,
  kingdom: RailwayKingdom,
  startYear: number,
  endYear: number | null
): string {
  const end = endYear === null ? "final desconocido" : String(endYear);
  return `${name}, ${kingdom}, ${startYear}-${end}`;
}

function transitionPath(
  x: number,
  sourceY: number,
  targetY: number
): string {
  return [
    `M ${x - 24} ${sourceY}`,
    `C ${x - 6} ${sourceY}, ${x + 6} ${targetY}, ${x + 24} ${targetY}`,
  ].join(" ");
}

function transitionMarkerY(
  transition: RailwayProjectedTransition,
  laneY: ReadonlyMap<RailwayKingdom, number>
): number {
  const realAnchors = transition.anchors.filter((anchor) => anchor.stationId !== null);
  const preferredRole = transition.kind === "split"
    ? "source"
    : transition.kind === "merge"
      ? "target"
      : null;
  const preferredAnchors = preferredRole
    ? realAnchors.filter((anchor) => anchor.role === preferredRole)
    : realAnchors;
  const anchors = preferredAnchors.length ? preferredAnchors : realAnchors;
  const values = anchors
    .map((anchor) => laneY.get(anchor.kingdom))
    .filter((value): value is number => value !== undefined);
  if (!values.length) return AXIS_HEIGHT + RAIL_OFFSET;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function transitionConnectorPairs(
  transition: RailwayProjectedTransition,
  laneY: ReadonlyMap<RailwayKingdom, number>
): Array<{ sourceY: number; targetY: number }> {
  const anchors = transition.anchors
    .map((anchor) => ({ ...anchor, y: laneY.get(anchor.kingdom) }))
    .filter((anchor): anchor is typeof anchor & { y: number } => anchor.y !== undefined);

  if (
    transition.kind === "dynastic-union"
    || transition.kind === "dynastic-separation"
  ) {
    const values = anchors.map((anchor) => anchor.y);
    if (values.length < 2) return [];
    return [{ sourceY: Math.min(...values), targetY: Math.max(...values) }];
  }

  const sources = anchors.filter((anchor) => anchor.role === "source");
  const targets = anchors.filter((anchor) => anchor.role === "target");
  if (!sources.length || !targets.length) return [];

  if (transition.kind === "merge") {
    return sources.flatMap((source) =>
      targets
        .filter((target) => target.y !== source.y)
        .map((target) => ({ sourceY: source.y, targetY: target.y }))
    );
  }

  return targets.flatMap((target) =>
    sources
      .filter((source) => source.y !== target.y)
      .map((source) => ({ sourceY: source.y, targetY: target.y }))
  );
}

function labelLevels(
  projection: RailwayProjection,
  width: number
): Map<string, number> {
  const output = new Map<string, number>();

  for (const track of projection.tracks) {
    const stations = projection.stations
      .filter((station) => station.kingdom === track.kingdom)
      .sort((left, right) => left.startYear - right.startYear || left.rowId.localeCompare(right.rowId));
    const lastX = LABEL_OFFSETS.map(() => Number.NEGATIVE_INFINITY);

    for (const station of stations) {
      const x = yearX(station.startYear, projection.scale, width);
      let level = lastX.findIndex((last) => x - last >= 104);
      if (level < 0) {
        level = lastX.reduce(
          (oldestIndex, value, index) => value < lastX[oldestIndex] ? index : oldestIndex,
          0
        );
      }
      output.set(station.id, level);
      lastX[level] = x;
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
  const width = canvasWidth(projection);
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
  const levels = useMemo(() => labelLevels(projection, width), [projection, width]);
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
    if (topScrollRef.current && viewportRef.current) {
      topScrollRef.current.scrollLeft = viewportRef.current.scrollLeft;
    }
  }, [width, visibleKingdoms.length]);

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
        Seleccione al menos un reino para proyectar el ferrocarril histórico.
      </div>
    );
  }

  if (!projection.stations.length) {
    return (
      <div className="rounded-[3px] border border-slate-800 bg-slate-950/30 p-6 text-center text-sm text-slate-400">
        Los reinos elegidos no contienen gobiernos cronológicos representables.
      </div>
    );
  }

  const firstTabbablePeriodId = selectedPeriodId
    && orderedStations.some((station) => station.periodId === selectedPeriodId)
    ? selectedPeriodId
    : orderedStations[0]?.periodId;

  return (
    <section
      className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-[3px] border border-slate-800/70 bg-slate-950/35"
      aria-label={`Ferrocarril histórico: ${projection.stations.length} gobiernos en ${projection.tracks.length} reinos`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-800 px-3 py-2 text-[11px] text-slate-400">
        <span className="font-medium text-slate-200">Lectura del mapa</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-6 rounded-full bg-slate-300" aria-hidden="true" />
          vía documentada en los datos
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-6 border-t border-dashed border-slate-400" aria-hidden="true" />
          hiato o anclaje incompleto
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rotate-45 border border-emerald-300 bg-emerald-950" aria-hidden="true" />
          transición histórica curada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-4 border-l border-dashed border-sky-300" aria-hidden="true" />
          mismo monarca; los reinos siguen separados
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
                      d={transitionPath(x, pair.sourceY, pair.targetY)}
                      fill="none"
                      stroke="#a7f3d0"
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
              return (
                <div
                  key={`${track.id}-label-row`}
                  className="pointer-events-none absolute left-0 right-0 z-20"
                  style={{ top: y - 18 }}
                >
                  <div className="sticky left-0 inline-flex h-9 max-w-[168px] items-center gap-2 rounded-r-[3px] border border-l-0 border-slate-700 bg-slate-950/95 px-3 text-xs font-medium text-slate-100 shadow-lg">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-white/30"
                      style={{ backgroundColor: trackColor(track.kingdom) }}
                      aria-hidden="true"
                    />
                    <span className="truncate">Reino de {track.kingdom}</span>
                    <span className="text-slate-500">{track.stationIds.length}</span>
                  </div>
                </div>
              );
            })}

            {visibleTransitions.map((transition) => {
              const x = yearX(transition.year, projection.scale, width);
              const y = transitionMarkerY(transition, laneY);
              const sourceUrl = WESTERN_KINGDOMS_RAILWAY_SOURCES[transition.definitionId];
              const markerClass = cn(
                "group absolute z-30 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none",
                "focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              );
              const markerContent = (
                <>
                  <span
                    className={cn(
                      "h-3.5 w-3.5 rotate-45 border-2 bg-emerald-950 shadow-sm",
                      transition.isAnchored ? "border-emerald-200" : "border-dashed border-amber-200"
                    )}
                    aria-hidden="true"
                  />
                  <span className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 hidden w-max max-w-[18rem] -translate-x-1/2 rounded-[3px] border border-slate-700 bg-slate-950 px-2 py-1 text-center text-[11px] text-slate-100 shadow-xl group-hover:block group-focus:block">
                    {transition.year} · {transition.label}
                    {sourceUrl ? " · fuente: RAH" : ""}
                  </span>
                </>
              );

              return sourceUrl ? (
                <a
                  key={transition.id}
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={markerClass}
                  style={{ left: x, top: y }}
                  aria-label={`${transition.year}: ${transition.label}. Abrir fuente de la Real Academia de la Historia`}
                >
                  {markerContent}
                  <ExternalLink className="sr-only" />
                </a>
              ) : (
                <span
                  key={transition.id}
                  tabIndex={0}
                  className={markerClass}
                  style={{ left: x, top: y }}
                  aria-label={`${transition.year}: ${transition.label}`}
                >
                  {markerContent}
                </span>
              );
            })}

            {orderedStations.map((station) => {
              const y = laneY.get(station.kingdom);
              if (y === undefined) return null;
              const x = yearX(station.startYear, projection.scale, width);
              const labelLevel = levels.get(station.id) ?? 0;
              const selected = station.periodId === selectedPeriodId;
              const inferred = station.period.isInferredStart;

              return (
                <div
                  key={station.id}
                  className="group absolute z-20 h-11 w-11 -translate-x-1/2 -translate-y-1/2"
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
                      "flex h-11 w-11 items-center justify-center rounded-full outline-none",
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
                  </button>
                  <span
                    className={cn(
                      "pointer-events-none absolute left-1/2 z-30 max-w-[116px] -translate-x-1/2 truncate rounded-[3px] border px-1.5 py-0.5 text-center text-[10px] leading-tight shadow-sm",
                      selected
                        ? "border-emerald-400/60 bg-emerald-950/95 text-emerald-50"
                        : "border-slate-700/80 bg-slate-950/92 text-slate-200"
                    )}
                    style={{ top: LABEL_OFFSETS[labelLevel] }}
                    title={`${station.name} (${station.startYear})`}
                  >
                    {station.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
