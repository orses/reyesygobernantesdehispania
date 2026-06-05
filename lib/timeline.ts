import {
  boolFromVerified,
  centuryFromYear,
  firstNonEmpty,
  formatCenturyLabel,
  getChronologyEvidence,
  rowDisplayName,
  type ChronologyEvidence,
} from "./data";
import { centuryColor, dynastyColor, kingdomColor } from "./ficha-view";
import { rowCenturies } from "./people";
import {
  buildGovernmentSuccession,
  type SuccessionPersonRef,
  type SuccessionSource,
} from "./succession";
import type { Person, RawRow } from "./types";

export type TimelineGroupMode = "kingdom" | "dynasty" | "century";
export type TimelineViewMode = "periods" | "succession" | "contemporaries";
export type TimelineScope = "filtered" | "global" | "selected";

export type TimelineIssueKind =
  | "missing-start"
  | "missing-end"
  | "invalid-range"
  | "inferred-start"
  | "inferred-end";

export type TimelineIssueSeverity = "info" | "warning" | "error";

export interface TimelineIssue {
  kind: TimelineIssueKind;
  severity: TimelineIssueSeverity;
  personId: string;
  rowId: string;
  personName: string;
  message: string;
}

export interface TimelinePeriod {
  id: string;
  personId: string;
  rowId: string;
  sourceRow: RawRow;
  name: string;
  reignName: string;
  kingdom: string;
  dynasty: string;
  governmentType: string;
  startEvidence: ChronologyEvidence;
  endEvidence: ChronologyEvidence;
  startYear: number;
  endYear: number | null;
  visualStartYear: number;
  visualEndYear: number;
  durationYears: number | null;
  durationSource: string;
  centuries: number[];
  verified: boolean;
  isOpenEnded: boolean;
  isInferredStart: boolean;
  isInferredEnd: boolean;
  hasInvalidRange: boolean;
  isFocused: boolean;
  predecessor: SuccessionPersonRef | null;
  successor: SuccessionPersonRef | null;
  predecessorSource: SuccessionSource;
  successorSource: SuccessionSource;
  color: string;
}

export interface TimelineLane {
  id: string;
  periods: TimelinePeriod[];
}

export interface TimelineGroup {
  key: string;
  label: string;
  color: string;
  periods: TimelinePeriod[];
  lanes: TimelineLane[];
  startYear: number;
  endYear: number;
}

export interface TimelineTick {
  year: number;
  label: string;
}

export interface TimelineScale {
  minYear: number;
  maxYear: number;
  totalYears: number;
  tickStep: number;
  ticks: TimelineTick[];
}

export interface TimelineStats {
  totalPeriods: number;
  skippedPeriods: number;
  inferredPeriods: number;
  openEndedPeriods: number;
  invalidPeriods: number;
}

export interface TimelinePeriodBuildOptions {
  selectedPersonId?: string | number | null;
  minVisualDurationYears?: number;
}

export interface TimelinePeriodBuildResult {
  periods: TimelinePeriod[];
  issues: TimelineIssue[];
}

export interface TimelineModelOptions extends TimelinePeriodBuildOptions {
  groupMode?: TimelineGroupMode;
  marginRatio?: number;
}

export interface TimelineModel {
  periods: TimelinePeriod[];
  groups: TimelineGroup[];
  scale: TimelineScale;
  issues: TimelineIssue[];
  stats: TimelineStats;
  groupMode: TimelineGroupMode;
}

export interface TimelinePeriodPosition {
  left: number;
  width: number;
}

const DEFAULT_MIN_VISUAL_DURATION_YEARS = 1;
const DEFAULT_GROUP_COLOR = "#64748b";

function firstChronologyValue(...values: unknown[]): unknown {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return value;
  }
  return "";
}

function timelineRowId(row: RawRow, personId: string, rowIndex: number): string {
  return String(row?._rowId ?? row?.ID ?? `${personId}-period-${rowIndex + 1}`);
}

function normalizedGroupKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function finiteDuration(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function periodCenturies(
  row: RawRow,
  startYear: number,
  endYear: number | null,
  hasInvalidRange: boolean
): number[] {
  if (!hasInvalidRange) {
    const centuries = rowCenturies(row);
    if (centuries.length) return centuries;
  }

  const startCentury = centuryFromYear(startYear);
  const endCentury = hasInvalidRange || endYear === null ? startCentury : centuryFromYear(endYear);
  if (startCentury === null || endCentury === null) return [];

  const from = Math.min(startCentury, endCentury);
  const to = Math.max(startCentury, endCentury);
  const centuries: number[] = [];
  for (let century = from; century <= to; century++) {
    centuries.push(century);
  }
  return centuries;
}

function createIssue(
  kind: TimelineIssueKind,
  severity: TimelineIssueSeverity,
  person: Person,
  rowId: string,
  message: string
): TimelineIssue {
  return {
    kind,
    severity,
    personId: String(person.personId),
    rowId,
    personName: person.nombrePrincipal,
    message,
  };
}

function comparePeriods(a: TimelinePeriod, b: TimelinePeriod): number {
  if (a.startYear !== b.startYear) return a.startYear - b.startYear;
  if (a.visualEndYear !== b.visualEndYear) return a.visualEndYear - b.visualEndYear;
  const byKingdom = a.kingdom.localeCompare(b.kingdom, "es");
  if (byKingdom !== 0) return byKingdom;
  return a.name.localeCompare(b.name, "es");
}

function periodsOverlap(a: TimelinePeriod, b: TimelinePeriod): boolean {
  return a.visualStartYear < b.visualEndYear && b.visualStartYear < a.visualEndYear;
}

function groupKeyForPeriod(period: TimelinePeriod, groupMode: TimelineGroupMode): string[] {
  if (groupMode === "dynasty") {
    return [`dynasty:${normalizedGroupKey(period.dynasty) || "unknown"}`];
  }

  if (groupMode === "century") {
    if (!period.centuries.length) return ["century:unknown"];
    return period.centuries.map((century) => `century:${century}`);
  }

  return [`kingdom:${normalizedGroupKey(period.kingdom) || "unknown"}`];
}

function groupLabelForPeriod(period: TimelinePeriod, key: string, groupMode: TimelineGroupMode): string {
  if (groupMode === "dynasty") return period.dynasty || "(sin dinastía)";
  if (groupMode === "century") {
    const century = Number.parseInt(key.replace("century:", ""), 10);
    return Number.isFinite(century) ? formatCenturyLabel(century) : "(sin siglo)";
  }
  return period.kingdom || "(sin reino)";
}

export function timelineGroupColor(label: string, groupMode: TimelineGroupMode): string {
  if (groupMode === "dynasty") return dynastyColor(label || "(sin dinastía)");
  if (groupMode === "century") {
    const century = label.replace(/^siglo\s+/i, "");
    return centuryColor(century || label);
  }
  return kingdomColor(label) || DEFAULT_GROUP_COLOR;
}

function groupSortValue(group: TimelineGroup): number {
  return group.periods.reduce((min, period) => Math.min(min, period.startYear), Number.POSITIVE_INFINITY);
}

function groupEndValue(group: TimelineGroup): number {
  return group.periods.reduce((max, period) => Math.max(max, period.visualEndYear), Number.NEGATIVE_INFINITY);
}

function chooseTickStep(totalYears: number): number {
  if (totalYears <= 40) return 5;
  if (totalYears <= 120) return 10;
  if (totalYears <= 350) return 25;
  if (totalYears <= 900) return 50;
  if (totalYears <= 1800) return 100;
  return 200;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildTimelinePeriods(
  people: Person[],
  options: TimelinePeriodBuildOptions = {}
): TimelinePeriodBuildResult {
  const minVisualDurationYears = Math.max(
    DEFAULT_MIN_VISUAL_DURATION_YEARS,
    options.minVisualDurationYears ?? DEFAULT_MIN_VISUAL_DURATION_YEARS
  );
  const selectedPersonId = options.selectedPersonId === null || options.selectedPersonId === undefined
    ? null
    : String(options.selectedPersonId);
  const successionByRowId = buildGovernmentSuccession(people);
  const periods: TimelinePeriod[] = [];
  const issues: TimelineIssue[] = [];

  for (const person of people) {
    person.reinados.forEach((row, rowIndex) => {
      const personId = String(person.personId);
      const rowId = timelineRowId(row, personId, rowIndex);
      const startValue = firstChronologyValue(
        row?.["Inicio del reinado (año)"],
        row?.inicioAnio,
        row?.["Inicio Reinado (Fecha)"],
        row?.["Inicio reinado (fecha)"],
        row?.inicioReinado
      );
      const endValue = firstChronologyValue(
        row?.["Final del reinado (año)"],
        row?.finAnio,
        row?.["Fin Reinado (Fecha)"],
        row?.["Fin reinado (fecha)"],
        row?.finReinado
      );
      const startEvidence = getChronologyEvidence(startValue);
      const endEvidence = getChronologyEvidence(endValue);

      if (startEvidence.year === null) {
        issues.push(createIssue(
          "missing-start",
          "error",
          person,
          rowId,
          "El gobierno no puede situarse en la línea temporal porque carece de inicio cronológico utilizable."
        ));
        return;
      }

      const endYear = endEvidence.year;
      const hasInvalidRange = endYear !== null && endYear < startEvidence.year;
      const isOpenEnded = endYear === null;
      const durationFromRow = finiteDuration(row?._duracionCalc);
      const durationYears = hasInvalidRange
        ? null
        : durationFromRow ?? (endYear === null ? null : endYear - startEvidence.year);
      const visualEndYear = hasInvalidRange || isOpenEnded
        ? startEvidence.year + minVisualDurationYears
        : Math.max(endYear, startEvidence.year + minVisualDurationYears);
      const succession = successionByRowId.get(rowId);
      const kingdom = firstNonEmpty(row?.Reino, "(sin reino)");
      const dynasty = firstNonEmpty(row?.Dinastía, person.dinastia, "(sin dinastía)");
      const governmentType = firstNonEmpty(row?.["Tipo de gobierno"], "(sin tipo)");
      const period: TimelinePeriod = {
        id: `${personId}:${rowId}`,
        personId,
        rowId,
        sourceRow: row,
        name: person.nombrePrincipal,
        reignName: rowDisplayName(row),
        kingdom,
        dynasty,
        governmentType,
        startEvidence,
        endEvidence,
        startYear: startEvidence.year,
        endYear,
        visualStartYear: startEvidence.year,
        visualEndYear,
        durationYears,
        durationSource: String(row?._duracionFuente ?? ""),
        centuries: periodCenturies(row, startEvidence.year, endYear, hasInvalidRange),
        verified: boolFromVerified(row?.["Información verificada"]),
        isOpenEnded,
        isInferredStart: startEvidence.kind === "inferred",
        isInferredEnd: endEvidence.kind === "inferred",
        hasInvalidRange,
        isFocused: selectedPersonId !== null && personId === selectedPersonId,
        predecessor: succession?.predecessor ?? null,
        successor: succession?.successor ?? null,
        predecessorSource: succession?.predecessorSource ?? "none",
        successorSource: succession?.successorSource ?? "none",
        color: kingdomColor(kingdom) || DEFAULT_GROUP_COLOR,
      };

      if (period.isOpenEnded) {
        issues.push(createIssue(
          "missing-end",
          "warning",
          person,
          rowId,
          "El final del gobierno no tiene un año utilizable; se representa como un periodo abierto o incompleto."
        ));
      }

      if (period.hasInvalidRange) {
        issues.push(createIssue(
          "invalid-range",
          "error",
          person,
          rowId,
          "El final cronológico es anterior al inicio; el periodo se conserva marcado como anomalía."
        ));
      }

      if (period.isInferredStart) {
        issues.push(createIssue(
          "inferred-start",
          "info",
          person,
          rowId,
          "El inicio se ha inferido desde una expresión cronológica aproximada."
        ));
      }

      if (period.isInferredEnd) {
        issues.push(createIssue(
          "inferred-end",
          "info",
          person,
          rowId,
          "El final se ha inferido desde una expresión cronológica aproximada."
        ));
      }

      periods.push(period);
    });
  }

  return {
    periods: periods.sort(comparePeriods),
    issues,
  };
}

export function packTimelineLanes(periods: TimelinePeriod[]): TimelineLane[] {
  const lanes: TimelinePeriod[][] = [];

  for (const period of [...periods].sort(comparePeriods)) {
    const lane = lanes.find((candidate) => !candidate.some((placed) => periodsOverlap(period, placed)));
    if (lane) {
      lane.push(period);
    } else {
      lanes.push([period]);
    }
  }

  return lanes.map((periodsInLane, index) => ({
    id: `lane-${index + 1}`,
    periods: periodsInLane,
  }));
}

export function buildTimelineGroups(
  periods: TimelinePeriod[],
  groupMode: TimelineGroupMode = "kingdom"
): TimelineGroup[] {
  const groupsByKey = new Map<string, TimelineGroup>();

  for (const period of periods) {
    for (const key of groupKeyForPeriod(period, groupMode)) {
      const label = groupLabelForPeriod(period, key, groupMode);
      const group = groupsByKey.get(key) ?? {
        key,
        label,
        color: timelineGroupColor(label, groupMode),
        periods: [],
        lanes: [],
        startYear: period.startYear,
        endYear: period.visualEndYear,
      };
      group.periods.push(period);
      groupsByKey.set(key, group);
    }
  }

  return Array.from(groupsByKey.values())
    .map((group) => {
      const periodsInGroup = [...group.periods].sort(comparePeriods);
      return {
        ...group,
        periods: periodsInGroup,
        lanes: packTimelineLanes(periodsInGroup),
        startYear: groupSortValue({ ...group, periods: periodsInGroup }),
        endYear: groupEndValue({ ...group, periods: periodsInGroup }),
      };
    })
    .sort((a, b) => {
      if (groupMode === "century") {
        const centuryA = Number.parseInt(a.key.replace("century:", ""), 10);
        const centuryB = Number.parseInt(b.key.replace("century:", ""), 10);
        if (Number.isFinite(centuryA) && Number.isFinite(centuryB) && centuryA !== centuryB) {
          return centuryA - centuryB;
        }
      }

      const byStart = a.startYear - b.startYear;
      if (byStart !== 0) return byStart;
      return a.label.localeCompare(b.label, "es");
    });
}

export function buildTimelineScale(
  periods: TimelinePeriod[],
  marginRatio = 0.05
): TimelineScale {
  if (!periods.length) {
    return { minYear: 0, maxYear: 1, totalYears: 1, tickStep: 1, ticks: [] };
  }

  const minRaw = periods.reduce((min, period) => Math.min(min, period.visualStartYear), Number.POSITIVE_INFINITY);
  const maxRaw = periods.reduce((max, period) => Math.max(max, period.visualEndYear), Number.NEGATIVE_INFINITY);
  const rawSpan = Math.max(1, maxRaw - minRaw);
  const margin = Math.max(1, Math.round(rawSpan * marginRatio));
  const minYear = Math.floor(minRaw - margin);
  const maxYear = Math.ceil(maxRaw + margin);
  const totalYears = Math.max(1, maxYear - minYear);
  const tickStep = chooseTickStep(totalYears);
  const firstTick = Math.floor(minYear / tickStep) * tickStep;
  const ticks: TimelineTick[] = [];

  for (let year = firstTick; year <= maxYear; year += tickStep) {
    if (year < minYear) continue;
    ticks.push({ year, label: String(year) });
  }

  return { minYear, maxYear, totalYears, tickStep, ticks };
}

export function buildTimelineStats(periods: TimelinePeriod[], issues: TimelineIssue[]): TimelineStats {
  return {
    totalPeriods: periods.length,
    skippedPeriods: issues.filter((issue) => issue.kind === "missing-start").length,
    inferredPeriods: periods.filter((period) => period.isInferredStart || period.isInferredEnd).length,
    openEndedPeriods: periods.filter((period) => period.isOpenEnded).length,
    invalidPeriods: periods.filter((period) => period.hasInvalidRange).length,
  };
}

export function buildTimelineModel(
  people: Person[],
  options: TimelineModelOptions = {}
): TimelineModel {
  const groupMode = options.groupMode ?? "kingdom";
  const { periods, issues } = buildTimelinePeriods(people, options);
  const groups = buildTimelineGroups(periods, groupMode);
  const scale = buildTimelineScale(periods, options.marginRatio);

  return {
    periods,
    groups,
    scale,
    issues,
    stats: buildTimelineStats(periods, issues),
    groupMode,
  };
}

export function getTimelinePeriodPosition(
  period: TimelinePeriod,
  scale: TimelineScale,
  minWidthPercentage = 0.45
): TimelinePeriodPosition {
  const left = ((period.visualStartYear - scale.minYear) / scale.totalYears) * 100;
  const right = ((period.visualEndYear - scale.minYear) / scale.totalYears) * 100;
  const width = Math.max(right - left, minWidthPercentage);
  const safeLeft = clamp(left, 0, 100);
  const safeWidth = clamp(width, minWidthPercentage, 100 - safeLeft);

  return {
    left: safeLeft,
    width: safeWidth,
  };
}

export function periodsAreContemporary(a: TimelinePeriod, b: TimelinePeriod): boolean {
  return periodsOverlap(a, b);
}

function meaningfulTimelineKey(value: string): string {
  const key = normalizedGroupKey(value);
  return key.startsWith("(sin ") ? "" : key;
}

function sameSuccessionSeries(a: TimelinePeriod, b: TimelinePeriod): boolean {
  const kingdomA = meaningfulTimelineKey(a.kingdom);
  const kingdomB = meaningfulTimelineKey(b.kingdom);
  if (!kingdomA || kingdomA !== kingdomB) return false;

  const dynastyA = meaningfulTimelineKey(a.dynasty);
  const dynastyB = meaningfulTimelineKey(b.dynasty);
  if (dynastyA && dynastyB) return dynastyA === dynastyB;

  return a.personId === b.personId;
}

export function getTimelineSuccessionPeriodIds(
  periods: TimelinePeriod[],
  selectedPeriod: TimelinePeriod | null
): Set<string> {
  if (!selectedPeriod) return new Set();

  return new Set(
    periods
      .filter((period) => sameSuccessionSeries(period, selectedPeriod))
      .sort(comparePeriods)
      .map((period) => period.id)
  );
}

export function getTimelineContemporaryPeriodIds(
  periods: TimelinePeriod[],
  selectedPeriod: TimelinePeriod | null
): Set<string> {
  if (!selectedPeriod) return new Set();

  return new Set(
    periods
      .filter((period) => period.id === selectedPeriod.id || periodsAreContemporary(period, selectedPeriod))
      .sort(comparePeriods)
      .map((period) => period.id)
  );
}
