import {
  buildTimelinePeriods,
  buildTimelineScale,
  periodsAreContemporary,
  type TimelineIssue,
  type TimelinePeriod,
  type TimelinePeriodBuildOptions,
  type TimelineScale,
} from "./timeline";
import type { Person } from "./types";

/** Reinos admitidos en la primera versión del ferrocarril histórico. */
export const RAILWAY_KINGDOMS = ["Asturias", "León", "Galicia", "Castilla"] as const;

export type RailwayKingdom = (typeof RAILWAY_KINGDOMS)[number];
export type RailwayTransitionKind =
  | "split"
  | "merge"
  | "transformation"
  | "restoration"
  | "dynastic-union"
  | "dynastic-separation";
export type RailwayTransitionAnchorRole = "source" | "target" | "participant";

export interface RailwaySplitTransitionDefinition {
  id: string;
  kind: "split";
  year: number;
  from: RailwayKingdom;
  to: readonly RailwayKingdom[];
  label?: string;
}

export interface RailwayMergeTransitionDefinition {
  id: string;
  kind: "merge";
  year: number;
  from: readonly RailwayKingdom[];
  to: RailwayKingdom;
  label?: string;
}

export interface RailwayTransformationTransitionDefinition {
  id: string;
  kind: "transformation";
  year: number;
  from: RailwayKingdom;
  to: RailwayKingdom;
  label?: string;
}

export interface RailwayRestorationTransitionDefinition {
  id: string;
  kind: "restoration";
  year: number;
  kingdom: RailwayKingdom;
  label?: string;
}

export interface RailwayDynasticUnionTransitionDefinition {
  id: string;
  kind: "dynastic-union";
  year: number;
  kingdoms: readonly RailwayKingdom[];
  label?: string;
}

export interface RailwayDynasticSeparationTransitionDefinition {
  id: string;
  kind: "dynastic-separation";
  year: number;
  kingdoms: readonly RailwayKingdom[];
  label?: string;
}

/**
 * Suceso político curado. Su forma discriminada impide confundir una unión
 * dinástica con una fusión de entidades políticas.
 */
export type RailwayTransitionDefinition =
  | RailwaySplitTransitionDefinition
  | RailwayMergeTransitionDefinition
  | RailwayTransformationTransitionDefinition
  | RailwayRestorationTransitionDefinition
  | RailwayDynasticUnionTransitionDefinition
  | RailwayDynasticSeparationTransitionDefinition;

/**
 * Intervalo editorial que identifica la vía conductora del relato histórico.
 * Los extremos nulos permiten ajustarlo al primer o al último servicio real
 * sin prolongar artificialmente la cobertura documental.
 */
export interface RailwayMainlineSegmentDefinition {
  id: string;
  kingdom: RailwayKingdom;
  startYear: number | null;
  endYear: number | null;
  label?: string;
}

/** Catálogo explícito y versionado de decisiones historiográficas. */
export interface RailwayTransitionCatalog {
  schemaVersion: 1;
  version: string;
  transitions: readonly RailwayTransitionDefinition[];
  mainlineSegments?: readonly RailwayMainlineSegmentDefinition[];
}

export interface RailwayStation {
  id: string;
  rowId: string;
  periodId: string;
  personId: string;
  name: string;
  reignName: string;
  kingdom: RailwayKingdom;
  startYear: number;
  endYear: number | null;
  period: TimelinePeriod;
}

/** Referencia topológica que inicia o termina un servicio documentado. */
export interface RailwayServiceTransitionBoundary {
  transitionId: string;
  kind: RailwayTransitionKind;
  role: RailwayTransitionAnchorRole;
  year: number;
}

/** Tramo dibujable sin huecos cronológicos ficticios. */
export interface RailwayService {
  id: string;
  trackId: string;
  kingdom: RailwayKingdom;
  stationIds: string[];
  startYear: number;
  endYear: number;
  startsAtTransitions: RailwayServiceTransitionBoundary[];
  endsAtTransitions: RailwayServiceTransitionBoundary[];
}

/**
 * Vía conceptual de un reino. La geometría continua debe construirse a partir
 * de sus servicios, no uniendo directamente la primera y la última estación.
 */
export interface RailwayTrack {
  id: string;
  kingdom: RailwayKingdom;
  stationIds: string[];
  serviceIds: string[];
}

/**
 * Parte dibujable de una vía troncal, ya recortada contra un servicio real.
 * Una definición puede originar varias partes si existen hiatos documentales.
 */
export interface RailwayMainlineSegment {
  id: string;
  definitionId: string;
  catalogVersion: string;
  serviceId: string;
  kingdom: RailwayKingdom;
  startYear: number;
  endYear: number;
  label: string;
}

export interface RailwayPersonalUnion {
  id: string;
  kind: "personal-union";
  personId: string;
  stationIds: [string, string];
  kingdoms: [RailwayKingdom, RailwayKingdom];
  startYear: number;
  endYear: number;
}

export interface RailwayTransitionAnchor {
  role: RailwayTransitionAnchorRole;
  kingdom: RailwayKingdom;
  stationId: string | null;
  anchorYear: number | null;
  distanceYears: number | null;
}

export interface RailwayTransition {
  id: string;
  definitionId: string;
  catalogVersion: string;
  kind: RailwayTransitionKind;
  year: number;
  label: string;
  anchors: RailwayTransitionAnchor[];
  isAnchored: boolean;
}

export type RailwayIssueKind = "missing-transition-anchor";

export interface RailwayIssue {
  kind: RailwayIssueKind;
  severity: "warning";
  transitionId: string;
  transitionDefinitionId: string;
  role: RailwayTransitionAnchorRole;
  kingdom: RailwayKingdom;
  message: string;
}

export interface RailwayNetwork {
  schemaVersion: 1;
  catalogVersion: string | null;
  availableKingdoms: readonly RailwayKingdom[];
  periods: TimelinePeriod[];
  stations: RailwayStation[];
  services: RailwayService[];
  tracks: RailwayTrack[];
  personalUnions: RailwayPersonalUnion[];
  transitions: RailwayTransition[];
  mainlineSegments?: RailwayMainlineSegment[];
  scale: TimelineScale;
}

export interface RailwayProjectedTransition extends RailwayTransition {
  /** Indica que el selector ha ocultado uno o varios extremos del suceso. */
  isPartial: boolean;
}

export interface RailwayProjection {
  selectedKingdoms: RailwayKingdom[];
  periods: TimelinePeriod[];
  stations: RailwayStation[];
  services: RailwayService[];
  tracks: RailwayTrack[];
  personalUnions: RailwayPersonalUnion[];
  transitions: RailwayProjectedTransition[];
  mainlineSegments?: RailwayMainlineSegment[];
  scale: TimelineScale;
}

export interface RailwayModel {
  network: RailwayNetwork;
  projection: RailwayProjection;
  /** Incidencias de sucesos con al menos un anclaje representable. */
  issues: RailwayIssue[];
  /** Incidencias auditables de sucesos completamente ajenos al conjunto cargado. */
  unrepresentedIssues: RailwayIssue[];
  timelineIssues: TimelineIssue[];
}

export interface RailwayModelOptions {
  selectedKingdoms?: readonly (RailwayKingdom | string)[];
  transitionCatalog?: RailwayTransitionCatalog;
  timeline?: TimelinePeriodBuildOptions;
  marginRatio?: number;
  contiguityToleranceYears?: number;
  transitionAnchorToleranceYears?: number;
}

const DEFAULT_CONTIGUITY_TOLERANCE_YEARS = 1;
const DEFAULT_TRANSITION_ANCHOR_TOLERANCE_YEARS = 2;
const KINGDOM_ORDER = new Map<RailwayKingdom, number>(
  RAILWAY_KINGDOMS.map((kingdom, index) => [kingdom, index])
);
const TRANSITION_KIND_ORDER = new Map<RailwayTransitionKind, number>([
  ["split", 0],
  ["merge", 1],
  ["transformation", 2],
  ["restoration", 3],
  ["dynastic-union", 4],
  ["dynastic-separation", 5],
]);

function normalizeLookupText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const KINGDOM_BY_ALIAS = new Map<string, RailwayKingdom>([
  ["asturias", "Asturias"],
  ["reino de asturias", "Asturias"],
  ["leon", "León"],
  ["reino de leon", "León"],
  ["galicia", "Galicia"],
  ["reino de galicia", "Galicia"],
  ["castilla", "Castilla"],
  ["reino de castilla", "Castilla"],
]);

/**
 * Resuelve únicamente alias completos. No usa coincidencias parciales, por lo
 * que «Condado de Castilla» y «Corona de Castilla» quedan fuera del modelo.
 */
export function normalizeRailwayKingdom(value: unknown): RailwayKingdom | null {
  return KINGDOM_BY_ALIAS.get(normalizeLookupText(value)) ?? null;
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function kingdomRank(kingdom: RailwayKingdom): number {
  return KINGDOM_ORDER.get(kingdom) ?? Number.MAX_SAFE_INTEGER;
}

function compareKingdoms(a: RailwayKingdom, b: RailwayKingdom): number {
  return kingdomRank(a) - kingdomRank(b);
}

function compareStations(a: RailwayStation, b: RailwayStation): number {
  const byKingdom = compareKingdoms(a.kingdom, b.kingdom);
  if (byKingdom !== 0) return byKingdom;
  if (a.startYear !== b.startYear) return a.startYear - b.startYear;
  const endA = a.endYear ?? a.startYear;
  const endB = b.endYear ?? b.startYear;
  if (endA !== endB) return endA - endB;
  const byRow = compareText(a.rowId, b.rowId);
  if (byRow !== 0) return byRow;
  return compareText(a.periodId, b.periodId);
}

function encodeIdPart(value: string): string {
  return encodeURIComponent(value);
}

function trackId(kingdom: RailwayKingdom): string {
  return `track:${normalizeLookupText(kingdom)}`;
}

function stationId(period: TimelinePeriod): string {
  return `station:${encodeIdPart(period.rowId)}`;
}

function stationCoverageEnd(station: RailwayStation): number {
  if (station.period.hasInvalidRange || station.endYear === null) return station.startYear;
  return Math.max(station.startYear, station.endYear);
}

function createStations(periods: TimelinePeriod[]): RailwayStation[] {
  return periods
    .map((period): RailwayStation | null => {
      const kingdom = normalizeRailwayKingdom(period.kingdom);
      if (!kingdom) return null;
      return {
        id: stationId(period),
        rowId: period.rowId,
        periodId: period.id,
        personId: period.personId,
        name: period.name,
        reignName: period.reignName,
        kingdom,
        startYear: period.startYear,
        endYear: period.endYear,
        period,
      };
    })
    .filter((station): station is RailwayStation => station !== null)
    .sort(compareStations);
}

function createService(
  kingdom: RailwayKingdom,
  stations: RailwayStation[]
): RailwayService {
  const first = stations[0];
  const last = stations[stations.length - 1];
  return {
    id: `service:${normalizeLookupText(kingdom)}:${encodeIdPart(first.rowId)}--${encodeIdPart(last.rowId)}`,
    trackId: trackId(kingdom),
    kingdom,
    stationIds: stations.map((station) => station.id),
    startYear: first.startYear,
    endYear: stations.reduce(
      (latest, station) => Math.max(latest, stationCoverageEnd(station)),
      first.startYear
    ),
    startsAtTransitions: [],
    endsAtTransitions: [],
  };
}

interface ServiceTopologyInstruction {
  boundary: RailwayServiceTransitionBoundary;
  stationId: string;
  startsService: boolean;
  endsService: boolean;
}

function serviceTopologyInstructions(
  transitions: RailwayTransition[]
): ServiceTopologyInstruction[] {
  return transitions.flatMap((transition) =>
    transition.anchors.flatMap((anchor): ServiceTopologyInstruction[] => {
      if (anchor.stationId === null) return [];
      return [{
        boundary: {
          transitionId: transition.id,
          kind: transition.kind,
          role: anchor.role,
          year: transition.year,
        },
        stationId: anchor.stationId,
        startsService: anchor.role === "target" || anchor.role === "participant",
        endsService: anchor.role === "source" || anchor.role === "participant",
      }];
    })
  );
}

function compareServiceBoundaries(
  a: RailwayServiceTransitionBoundary,
  b: RailwayServiceTransitionBoundary
): number {
  if (a.year !== b.year) return a.year - b.year;
  const byTransition = compareText(a.transitionId, b.transitionId);
  if (byTransition !== 0) return byTransition;
  return compareText(a.role, b.role);
}

function addServiceBoundary(
  boundaries: RailwayServiceTransitionBoundary[],
  boundary: RailwayServiceTransitionBoundary
): void {
  const exists = boundaries.some((candidate) =>
    candidate.transitionId === boundary.transitionId && candidate.role === boundary.role
  );
  if (!exists) boundaries.push(boundary);
  boundaries.sort(compareServiceBoundaries);
}

function serviceSegmentStations(
  service: RailwayService,
  startYear: number,
  endYear: number,
  stationById: Map<string, RailwayStation>
): string[] {
  return service.stationIds.filter((id) => {
    const station = stationById.get(id);
    if (!station) return false;
    return station.startYear <= endYear && stationCoverageEnd(station) >= startYear;
  });
}

function closestSegmentForInstruction(
  segments: RailwayService[],
  instruction: ServiceTopologyInstruction,
  edge: "start" | "end"
): RailwayService | null {
  const candidates = segments
    .filter((segment) => segment.stationIds.includes(instruction.stationId))
    .sort((a, b) => {
      const yearA = edge === "start" ? a.startYear : a.endYear;
      const yearB = edge === "start" ? b.startYear : b.endYear;
      const distance = Math.abs(yearA - instruction.boundary.year)
        - Math.abs(yearB - instruction.boundary.year);
      if (distance !== 0) return distance;
      return edge === "start" ? a.startYear - b.startYear : b.endYear - a.endYear;
    });
  return candidates[0] ?? null;
}

interface ServiceTopologyEvent {
  transitionId: string;
  year: number;
  startsService: boolean;
  endsService: boolean;
}

function serviceTopologyEvents(
  instructions: ServiceTopologyInstruction[]
): ServiceTopologyEvent[] {
  const eventsByTransition = new Map<string, ServiceTopologyEvent>();
  for (const instruction of instructions) {
    const transitionId = instruction.boundary.transitionId;
    const current = eventsByTransition.get(transitionId) ?? {
      transitionId,
      year: instruction.boundary.year,
      startsService: false,
      endsService: false,
    };
    current.startsService ||= instruction.startsService;
    current.endsService ||= instruction.endsService;
    eventsByTransition.set(transitionId, current);
  }
  return Array.from(eventsByTransition.values()).sort((a, b) =>
    a.year - b.year || compareText(a.transitionId, b.transitionId)
  );
}

function topologyStateAfterEvents(
  currentState: boolean,
  events: ServiceTopologyEvent[]
): boolean {
  if (events.some((event) => event.startsService)) return true;
  if (events.some((event) => event.endsService)) return false;
  return currentState;
}

/**
 * Corta un servicio únicamente dentro de su cobertura documentada. Una
 * transición próxima puede ajustar un extremo dentro de la tolerancia de
 * continuidad; una separación mayor conserva el hiato y solo queda enlazada
 * mediante sus referencias topológicas.
 */
function segmentServiceByTopology(
  service: RailwayService,
  instructions: ServiceTopologyInstruction[],
  stationById: Map<string, RailwayStation>,
  contiguityToleranceYears: number
): RailwayService[] {
  if (!instructions.length) return [service];

  const events = serviceTopologyEvents(instructions);
  let startYear = service.startYear;
  let endYear = service.endYear;
  for (const instruction of instructions) {
    const year = instruction.boundary.year;
    if (instruction.startsService && year < startYear
      && startYear - year <= contiguityToleranceYears) {
      startYear = year;
    }
    if (instruction.endsService && year > endYear
      && year - endYear <= contiguityToleranceYears) {
      endYear = year;
    }
  }

  const cutYears = Array.from(new Set(events
    .map((event) => event.year)
    .filter((year) => year > startYear && year < endYear)))
    .sort((a, b) => a - b);
  const points = [startYear, ...cutYears, endYear];
  const ranges = startYear === endYear
    ? [[startYear, endYear] as const]
    : points.slice(0, -1).map((point, index) => [point, points[index + 1]] as const);
  const isUnchanged = ranges.length === 1
    && startYear === service.startYear
    && endYear === service.endYear;
  const earliestEvents = events.filter((event) => event.year === events[0]?.year);
  let isActive = !(
    earliestEvents.some((event) => event.startsService)
    && !earliestEvents.some((event) => event.endsService)
  );
  let eventIndex = 0;
  const segments = ranges.flatMap(([segmentStart, segmentEnd]): RailwayService[] => {
    while (eventIndex < events.length && events[eventIndex].year <= segmentStart) {
      const eventYear = events[eventIndex].year;
      const simultaneousEvents: ServiceTopologyEvent[] = [];
      while (eventIndex < events.length && events[eventIndex].year === eventYear) {
        simultaneousEvents.push(events[eventIndex]);
        eventIndex += 1;
      }
      isActive = topologyStateAfterEvents(isActive, simultaneousEvents);
    }
    if (!isActive) return [];

    const stationIds = serviceSegmentStations(
      service,
      segmentStart,
      segmentEnd,
      stationById
    );
    const suffix = isUnchanged
      ? ""
      : `:${encodeIdPart(String(segmentStart))}-${encodeIdPart(String(segmentEnd))}`;
    return [{
      ...service,
      id: `${service.id}${suffix}`,
      stationIds: stationIds.length ? stationIds : [...service.stationIds],
      startYear: segmentStart,
      endYear: segmentEnd,
      startsAtTransitions: [],
      endsAtTransitions: [],
    }];
  });

  for (const instruction of instructions) {
    if (instruction.startsService) {
      const segment = segments.find((candidate) =>
        candidate.startYear === instruction.boundary.year
        && candidate.stationIds.includes(instruction.stationId)
      ) ?? closestSegmentForInstruction(segments, instruction, "start");
      if (segment) addServiceBoundary(segment.startsAtTransitions, instruction.boundary);
    }
    if (instruction.endsService) {
      const segment = [...segments].reverse().find((candidate) =>
        candidate.endYear === instruction.boundary.year
        && candidate.stationIds.includes(instruction.stationId)
      ) ?? closestSegmentForInstruction(segments, instruction, "end");
      if (segment) addServiceBoundary(segment.endsAtTransitions, instruction.boundary);
    }
  }

  return segments;
}

function buildTrackParts(
  stations: RailwayStation[],
  contiguityToleranceYears: number,
  transitions: RailwayTransition[]
): { tracks: RailwayTrack[]; services: RailwayService[] } {
  const tracks: RailwayTrack[] = [];
  const services: RailwayService[] = [];
  const stationById = new Map(stations.map((station) => [station.id, station]));
  const topologyInstructions = serviceTopologyInstructions(transitions);

  for (const kingdom of RAILWAY_KINGDOMS) {
    const kingdomStations = stations.filter((station) => station.kingdom === kingdom);
    if (!kingdomStations.length) continue;

    const kingdomServices: RailwayService[] = [];
    let currentStations: RailwayStation[] = [];
    let coverageEnd = Number.NEGATIVE_INFINITY;

    for (const station of kingdomStations) {
      const startsNewService = currentStations.length > 0
        && station.startYear > coverageEnd + contiguityToleranceYears;
      if (startsNewService) {
        kingdomServices.push(createService(kingdom, currentStations));
        currentStations = [];
        coverageEnd = Number.NEGATIVE_INFINITY;
      }
      currentStations.push(station);
      coverageEnd = Math.max(coverageEnd, stationCoverageEnd(station));
    }

    if (currentStations.length) {
      kingdomServices.push(createService(kingdom, currentStations));
    }

    const segmentedServices = kingdomServices.flatMap((service) => {
      const serviceStationIds = new Set(service.stationIds);
      const instructions = topologyInstructions.filter((instruction) =>
        serviceStationIds.has(instruction.stationId)
      );
      return segmentServiceByTopology(
        service,
        instructions,
        stationById,
        contiguityToleranceYears
      );
    });
    services.push(...segmentedServices);
    tracks.push({
      id: trackId(kingdom),
      kingdom,
      stationIds: kingdomStations.map((station) => station.id),
      serviceIds: segmentedServices.map((service) => service.id),
    });
  }

  return { tracks, services };
}

function buildMainlineSegments(
  catalog: RailwayTransitionCatalog | undefined,
  services: RailwayService[]
): RailwayMainlineSegment[] | undefined {
  if (catalog === undefined || catalog.mainlineSegments === undefined) return undefined;
  const definitions = catalog.mainlineSegments;

  return definitions.flatMap((definition): RailwayMainlineSegment[] => {
    const hasInvalidStart = definition.startYear !== null
      && !Number.isFinite(definition.startYear);
    const hasInvalidEnd = definition.endYear !== null
      && !Number.isFinite(definition.endYear);
    const hasInvertedRange = definition.startYear !== null
      && definition.endYear !== null
      && definition.startYear > definition.endYear;
    if (hasInvalidStart || hasInvalidEnd || hasInvertedRange) return [];

    return services
      .filter((service) => service.kingdom === definition.kingdom)
      .flatMap((service): RailwayMainlineSegment[] => {
        const startYear = Math.max(
          service.startYear,
          definition.startYear ?? service.startYear
        );
        const endYear = Math.min(
          service.endYear,
          definition.endYear ?? service.endYear
        );
        if (startYear >= endYear) return [];

        return [{
          id: [
            "mainline",
            encodeIdPart(definition.id),
            encodeIdPart(service.id),
            `${startYear}-${endYear}`,
          ].join(":"),
          definitionId: definition.id,
          catalogVersion: catalog.version,
          serviceId: service.id,
          kingdom: definition.kingdom,
          startYear,
          endYear,
          label: definition.label?.trim() || `Vía troncal de ${definition.kingdom}`,
        }];
      });
  }).sort((left, right) => {
    if (left.startYear !== right.startYear) return left.startYear - right.startYear;
    if (left.endYear !== right.endYear) return left.endYear - right.endYear;
    const byKingdom = compareKingdoms(left.kingdom, right.kingdom);
    if (byKingdom !== 0) return byKingdom;
    const byDefinition = compareText(left.definitionId, right.definitionId);
    return byDefinition || compareText(left.serviceId, right.serviceId);
  });
}

function compareStationPair(a: RailwayStation, b: RailwayStation): number {
  return compareStations(a, b);
}

function createPersonalUnions(stations: RailwayStation[]): RailwayPersonalUnion[] {
  const stationsByPerson = new Map<string, RailwayStation[]>();
  for (const station of stations) {
    const current = stationsByPerson.get(station.personId) ?? [];
    current.push(station);
    stationsByPerson.set(station.personId, current);
  }

  const unions: RailwayPersonalUnion[] = [];
  for (const [personId, personStations] of stationsByPerson) {
    const sorted = [...personStations].sort(compareStationPair);
    for (let leftIndex = 0; leftIndex < sorted.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < sorted.length; rightIndex += 1) {
        const left = sorted[leftIndex];
        const right = sorted[rightIndex];
        if (left.kingdom === right.kingdom) continue;
        if (!periodsAreContemporary(left.period, right.period)) continue;
        unions.push({
          id: `personal-union:${left.id}--${right.id}`,
          kind: "personal-union",
          personId,
          stationIds: [left.id, right.id],
          kingdoms: [left.kingdom, right.kingdom],
          startYear: Math.max(left.period.visualStartYear, right.period.visualStartYear),
          endYear: Math.min(left.period.visualEndYear, right.period.visualEndYear),
        });
      }
    }
  }

  return unions.sort((a, b) => compareText(a.id, b.id));
}

interface AnchorRequest {
  role: RailwayTransitionAnchorRole;
  kingdom: RailwayKingdom;
}

function uniqueSortedKingdoms(kingdoms: readonly RailwayKingdom[]): RailwayKingdom[] {
  return Array.from(new Set(kingdoms)).sort(compareKingdoms);
}

function transitionAnchorRequests(definition: RailwayTransitionDefinition): AnchorRequest[] {
  if (definition.kind === "split") {
    return [
      { role: "source", kingdom: definition.from },
      ...uniqueSortedKingdoms(definition.to).map((kingdom) => ({ role: "target" as const, kingdom })),
    ];
  }
  if (definition.kind === "merge") {
    return [
      ...uniqueSortedKingdoms(definition.from).map((kingdom) => ({ role: "source" as const, kingdom })),
      { role: "target", kingdom: definition.to },
    ];
  }
  if (definition.kind === "transformation") {
    return [
      { role: "source", kingdom: definition.from },
      { role: "target", kingdom: definition.to },
    ];
  }
  if (definition.kind === "restoration") {
    return [
      { role: "source", kingdom: definition.kingdom },
      { role: "target", kingdom: definition.kingdom },
    ];
  }
  return uniqueSortedKingdoms(definition.kingdoms)
    .map((kingdom) => ({ role: "participant" as const, kingdom }));
}

function sourceAnchorYear(station: RailwayStation): number | null {
  if (station.period.hasInvalidRange) return null;
  return station.endYear;
}

function participantAnchorYear(station: RailwayStation, transitionYear: number): number {
  const endYear = station.period.hasInvalidRange || station.endYear === null
    ? station.startYear
    : station.endYear;
  if (station.startYear <= transitionYear && transitionYear <= endYear) return transitionYear;
  return Math.abs(transitionYear - station.startYear) <= Math.abs(transitionYear - endYear)
    ? station.startYear
    : endYear;
}

function anchorYearForStation(
  station: RailwayStation,
  role: RailwayTransitionAnchorRole,
  transitionYear: number
): number | null {
  if (role === "source") return sourceAnchorYear(station);
  if (role === "target") return station.startYear;
  return participantAnchorYear(station, transitionYear);
}

function resolveAnchor(
  request: AnchorRequest,
  transitionYear: number,
  stations: RailwayStation[],
  toleranceYears: number
): RailwayTransitionAnchor {
  const candidates = stations
    .filter((station) => station.kingdom === request.kingdom)
    .map((station) => ({
      station,
      anchorYear: anchorYearForStation(station, request.role, transitionYear),
    }))
    .filter((candidate): candidate is { station: RailwayStation; anchorYear: number } =>
      candidate.anchorYear !== null
    )
    .map((candidate) => ({
      ...candidate,
      distanceYears: Math.abs(candidate.anchorYear - transitionYear),
    }))
    .sort((a, b) => {
      if (a.distanceYears !== b.distanceYears) return a.distanceYears - b.distanceYears;
      return compareStations(a.station, b.station);
    });
  const nearest = candidates[0];

  if (!nearest || nearest.distanceYears > toleranceYears) {
    return {
      ...request,
      stationId: null,
      anchorYear: null,
      distanceYears: null,
    };
  }

  return {
    ...request,
    stationId: nearest.station.id,
    anchorYear: nearest.anchorYear,
    distanceYears: nearest.distanceYears,
  };
}

function transitionLabel(definition: RailwayTransitionDefinition): string {
  return definition.label?.trim() || definition.id;
}

function compareTransitionDefinitions(
  a: RailwayTransitionDefinition,
  b: RailwayTransitionDefinition
): number {
  if (a.year !== b.year) return a.year - b.year;
  const byKind = (TRANSITION_KIND_ORDER.get(a.kind) ?? 99)
    - (TRANSITION_KIND_ORDER.get(b.kind) ?? 99);
  if (byKind !== 0) return byKind;
  return compareText(a.id, b.id);
}

function missingAnchorMessage(
  definition: RailwayTransitionDefinition,
  request: AnchorRequest,
  toleranceYears: number
): string {
  const role = request.role === "source"
    ? "de origen"
    : request.role === "target"
      ? "de destino"
      : "participante";
  return `La transición «${transitionLabel(definition)}» no tiene una estación ${role} de ${request.kingdom} a ${toleranceYears} años o menos de ${definition.year}.`;
}

function createTransitions(
  catalog: RailwayTransitionCatalog | undefined,
  stations: RailwayStation[],
  toleranceYears: number
): { transitions: RailwayTransition[]; issues: RailwayIssue[] } {
  if (!catalog) return { transitions: [], issues: [] };

  const transitions: RailwayTransition[] = [];
  const issues: RailwayIssue[] = [];
  const definitions = [...catalog.transitions].sort(compareTransitionDefinitions);

  for (const definition of definitions) {
    const id = `transition:${encodeIdPart(catalog.version)}:${encodeIdPart(definition.id)}`;
    const requests = transitionAnchorRequests(definition);
    const anchors = requests.map((request) =>
      resolveAnchor(request, definition.year, stations, toleranceYears)
    );
    transitions.push({
      id,
      definitionId: definition.id,
      catalogVersion: catalog.version,
      kind: definition.kind,
      year: definition.year,
      label: transitionLabel(definition),
      anchors,
      isAnchored: anchors.length > 0 && anchors.every((anchor) => anchor.stationId !== null),
    });

    anchors.forEach((anchor, index) => {
      if (anchor.stationId !== null) return;
      const request = requests[index];
      issues.push({
        kind: "missing-transition-anchor",
        severity: "warning",
        transitionId: id,
        transitionDefinitionId: definition.id,
        role: request.role,
        kingdom: request.kingdom,
        message: missingAnchorMessage(definition, request, toleranceYears),
      });
    });
  }

  return { transitions, issues };
}

function normalizeSelection(
  selectedKingdoms: readonly (RailwayKingdom | string)[] | undefined
): RailwayKingdom[] {
  if (selectedKingdoms === undefined) return [...RAILWAY_KINGDOMS];
  const selected = new Set<RailwayKingdom>();
  for (const value of selectedKingdoms) {
    const kingdom = normalizeRailwayKingdom(value);
    if (kingdom) selected.add(kingdom);
  }
  return RAILWAY_KINGDOMS.filter((kingdom) => selected.has(kingdom));
}

function buildRailwayScale(
  periods: TimelinePeriod[],
  transitions: RailwayTransition[],
  marginRatio: number
): TimelineScale {
  const template = periods[0];
  if (!template) return buildTimelineScale([], marginRatio);
  const transitionYears = Array.from(new Set(transitions
    .filter((transition) => transition.anchors.some((anchor) => anchor.stationId !== null))
    .map((transition) => transition.year)))
    .sort((a, b) => a - b);
  const scaleAnchors = transitionYears.map((year, index): TimelinePeriod => ({
    ...template,
    id: `railway-scale-anchor:${year}:${index}`,
    visualStartYear: year,
    visualEndYear: year,
  }));
  return buildTimelineScale([...periods, ...scaleAnchors], marginRatio);
}

/**
 * Crea una vista podada sin mutar ni recalcular las relaciones de la red
 * completa. Una transición parcialmente visible conserva esa condición.
 */
export function projectRailwayNetwork(
  network: RailwayNetwork,
  selectedKingdoms?: readonly (RailwayKingdom | string)[]
): RailwayProjection {
  const selection = normalizeSelection(selectedKingdoms);
  const selected = new Set<RailwayKingdom>(selection);
  const stations = network.stations.filter((station) => selected.has(station.kingdom));
  const stationIds = new Set(stations.map((station) => station.id));
  const services = network.services.filter((service) => selected.has(service.kingdom));
  const serviceIds = new Set(services.map((service) => service.id));
  const tracks = network.tracks
    .filter((track) => selected.has(track.kingdom))
    .map((track) => ({
      ...track,
      stationIds: track.stationIds.filter((id) => stationIds.has(id)),
      serviceIds: track.serviceIds.filter((id) => serviceIds.has(id)),
    }));
  const periods = stations.map((station) => station.period);
  const personalUnions = network.personalUnions.filter((union) =>
    union.kingdoms.every((kingdom) => selected.has(kingdom))
  );
  const mainlineSegments = network.mainlineSegments?.filter((segment) =>
    selected.has(segment.kingdom) && serviceIds.has(segment.serviceId)
  );
  const transitions = network.transitions
    .map((transition): RailwayProjectedTransition => {
      const anchors = transition.anchors.filter((anchor) => selected.has(anchor.kingdom));
      return {
        ...transition,
        anchors,
        isAnchored: anchors.length > 0 && anchors.every((anchor) => anchor.stationId !== null),
        isPartial: anchors.length !== transition.anchors.length,
      };
    })
    .filter((transition) => transition.anchors.some((anchor) =>
      anchor.stationId !== null && stationIds.has(anchor.stationId)
    ));

  return {
    selectedKingdoms: selection,
    periods,
    stations,
    services,
    tracks,
    personalUnions,
    transitions,
    ...(mainlineSegments === undefined ? {} : { mainlineSegments }),
    scale: network.scale,
  };
}

/**
 * Construye el modelo ferroviario desde gobiernos normalizados. Las estaciones
 * representan filas de gobierno (`rowId`), nunca personas agregadas.
 */
export function buildRailwayModel(
  people: Person[],
  options: RailwayModelOptions = {}
): RailwayModel {
  const marginRatio = options.marginRatio ?? 0.05;
  const contiguityToleranceYears = Math.max(
    0,
    options.contiguityToleranceYears ?? DEFAULT_CONTIGUITY_TOLERANCE_YEARS
  );
  const transitionAnchorToleranceYears = Math.max(
    0,
    options.transitionAnchorToleranceYears ?? DEFAULT_TRANSITION_ANCHOR_TOLERANCE_YEARS
  );
  const timeline = buildTimelinePeriods(people, options.timeline);
  const stations = createStations(timeline.periods);
  const periods = stations.map((station) => station.period);
  const personalUnions = createPersonalUnions(stations);
  const transitionResult = createTransitions(
    options.transitionCatalog,
    stations,
    transitionAnchorToleranceYears
  );
  const { transitions } = transitionResult;
  const { tracks, services } = buildTrackParts(
    stations,
    contiguityToleranceYears,
    transitions
  );
  const mainlineSegments = buildMainlineSegments(options.transitionCatalog, services);
  const representableTransitionIds = new Set(transitions
    .filter((transition) => transition.anchors.some((anchor) => anchor.stationId !== null))
    .map((transition) => transition.id));
  const issues = transitionResult.issues.filter((issue) =>
    representableTransitionIds.has(issue.transitionId)
  );
  const unrepresentedIssues = transitionResult.issues.filter((issue) =>
    !representableTransitionIds.has(issue.transitionId)
  );
  const network: RailwayNetwork = {
    schemaVersion: 1,
    catalogVersion: options.transitionCatalog?.version ?? null,
    availableKingdoms: RAILWAY_KINGDOMS,
    periods,
    stations,
    services,
    tracks,
    personalUnions,
    transitions,
    ...(mainlineSegments === undefined ? {} : { mainlineSegments }),
    scale: buildRailwayScale(periods, transitions, marginRatio),
  };

  return {
    network,
    projection: projectRailwayNetwork(network, options.selectedKingdoms),
    issues,
    unrepresentedIssues,
    timelineIssues: timeline.issues,
  };
}
