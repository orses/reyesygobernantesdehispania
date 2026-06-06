import {
  asNumberOrNull,
  asYearOrNull,
  firstNonEmpty,
  getChronologyEvidence,
  normalizeUrl,
  rowDisplayName,
} from "./data";
import type { MediaAsset, MediaRightsStatus, Person, RawRow } from "./types";

export interface BadgeStyle {
  backgroundColor: string;
  borderColor: string;
  color: string;
}

export type DataMetaKind = "original" | "inferred" | "calculated";

export interface DataMeta {
  kind: DataMetaKind;
  label: string;
  tooltip: string;
}

export interface PersonLifeFields {
  birthRaw: string;
  deathRaw: string;
  birthDateDisplay: string;
  deathDateDisplay: string;
  birthLocationDisplay: string;
  deathLocationDisplay: string;
  birthDisplay: string;
  deathDisplay: string;
}

export interface ImageViewerSource {
  id: string;
  src: string;
  title: string;
  alt: string;
  workDate?: string;
}

export interface PersonDenomination {
  reino: string;
  nombre: string;
}

export interface GovernmentPeriodView {
  row: RawRow;
  rowId: string;
  reino: string;
  nombre: string;
  inicio: unknown;
  fin: unknown;
  duration: number | null;
  durationSource: unknown;
  nroReinado: string;
  tipoGobierno: unknown;
  dinastia: unknown;
}

export const RIGHTS_OPTIONS: { value: MediaRightsStatus; label: string }[] = [
  { value: "unknown", label: "derechos desconocidos" },
  { value: "public-domain", label: "dominio público" },
  { value: "licensed", label: "licencia documentada" },
  { value: "copyrighted", label: "con derechos de autor" },
];

// Los colores buscan reflejar la heráldica/vexilología histórica y, a la vez,
// las relaciones entre entidades emparentadas (mismo «aire» de color para
// reinos sucesores, con tonos claramente distintos para no confundirlos).
const KINGDOM_COLORS: Record<string, string> = {
  // Occidente: azules y púrpura.
  asturias: "#00468C",
  "reino de asturias": "#00468C",
  "reino de leon": "#702963",
  "reino de galicia": "#0079AF",

  // Castilla → España: familia del CARMESÍ, el color vexilológico tradicional
  // de Castilla (gules heráldico representado como carmesí). Del más claro
  // (condado, el más antiguo) al más profundo (Monarquía Hispánica/España),
  // para leer a la vez la continuidad y la especificidad de cada etapa.
  "condado de castilla": "#D2556A", // carmesí claro
  "reino de castilla": "#C2354A", // carmesí medio
  "corona de castilla": "#A51C30", // carmesí tradicional de Castilla
  "monarquia hispanica": "#7A1325", // carmesí profundo
  "monarquia hispanica / espana": "#7A1325",
  espana: "#7A1325",
  "reino de espana": "#7A1325",

  // Corona de Aragón y su núcleo catalán.
  "corona de aragon": "#3E2723",
  // Cataluña: oro/ámbar de la Senyera (campo de oro, palos de gules).
  "condado de barcelona": "#D97706",
  barcelona: "#D97706",
  "condado de cataluna": "#E08A1E",
  "condado de catalunya": "#E08A1E",
  cataluna: "#E08A1E",
  catalunya: "#E08A1E",

  // Pamplona → Navarra: oro de las cadenas. Pamplona (etapa primitiva) en un
  // oro viejo/bronce más oscuro y Navarra en su oro mostaza consolidado: mismo
  // «aire» dorado, pero con contraste de luminosidad suficiente para
  // distinguirlos manteniendo legible el texto blanco del chip.
  "reino de pamplona": "#936F15",
  pamplona: "#936F15",
  "reino de navarra": "#BE9F23",
  navarra: "#BE9F23",
};

const DYNASTY_COLORS: Record<string, string> = {
  "astur-leonesa": "#0f766e",
  jimena: "#a16207",
  borgona: "#7e22ce",
  borgoña: "#7e22ce",
  trastamara: "#b91c1c",
  trastamaras: "#b91c1c",
  austria: "#d97706",
  habsburgo: "#d97706",
  borbon: "#2563eb",
  bonaparte: "#7c3aed",
  saboya: "#16a34a",
};

function colorKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function kingdomColor(name: string): string | undefined {
  const key = colorKey(name);
  if (!key) return undefined;

  const direct = KINGDOM_COLORS[key];
  if (direct) return direct;

  return Object.entries(KINGDOM_COLORS).find(([candidate]) =>
    key.includes(candidate) || candidate.includes(key)
  )?.[1];
}

function colorHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function dynastyColor(name: string): string {
  const fixed = DYNASTY_COLORS[colorKey(name)];
  if (fixed) return fixed;

  const hue = (colorHash(name) * 37) % 360;
  return `hsl(${hue} 62% 42%)`;
}

export function centuryColor(value: string): string {
  const n = asNumberOrNull(value) ?? colorHash(value);
  const hue = (190 + (Math.abs(Math.trunc(n)) * 23)) % 360;
  return `hsl(${hue} 70% 44%)`;
}

export function colorBadgeStyle(color: string, active = false): BadgeStyle {
  return {
    backgroundColor: active ? color : `color-mix(in srgb, ${color} 30%, rgb(2 6 23))`,
    borderColor: active ? color : `color-mix(in srgb, ${color} 72%, rgb(51 65 85))`,
    color: active ? "#ffffff" : `color-mix(in srgb, ${color} 30%, white)`,
  };
}

export function kingdomBadgeStyle(reino: string, active = false): BadgeStyle {
  return colorBadgeStyle(kingdomColor(reino) || "#64748b", active);
}

export function dynastyBadgeStyle(dinastia: string, active = false): BadgeStyle {
  return colorBadgeStyle(dynastyColor(dinastia), active);
}

export function centuryBadgeStyle(siglo: string, active = false): BadgeStyle {
  return colorBadgeStyle(centuryColor(siglo), active);
}

export function isApproxDate(raw: string | null): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  return !/^-?\d{1,4}$/.test(trimmed);
}

/** Extrae el año (primer número de 3-4 cifras) de una fecha en texto, para
 * resaltarlo en la ficha. Devuelve null si no hay año numérico (p. ej. «s. VII»). */
export function extractYear(text: unknown): string | null {
  const match = String(text ?? "").match(/\d{3,4}/);
  return match ? match[0] : null;
}

/** Extrae el primer número de un texto (p. ej. la edad en «~52 años»). */
export function extractLeadingNumber(text: unknown): string | null {
  const match = String(text ?? "").match(/\d+/);
  return match ? match[0] : null;
}

export function mediaAssetSrc(asset: MediaAsset | null, previewUrls: Record<string, string>): string {
  if (!asset) return "";
  if (asset.kind === "uploaded-file") return previewUrls[asset.id] ?? "";
  return normalizeUrl(asset.src);
}

export function mediaAssetViewerSource(
  asset: MediaAsset | null,
  previewUrls: Record<string, string>,
  personName: string
): ImageViewerSource | null {
  const src = mediaAssetSrc(asset, previewUrls);
  if (!asset || !src) return null;

  return {
    id: asset.id,
    src,
    title: firstNonEmpty(asset.title, asset.fileName, personName),
    alt: asset.title || `imagen de ${personName}`,
    workDate: asset.workDate,
  };
}

export function personMainImageViewerSource({
  asset,
  previewUrls,
  fallbackUrl,
  personName,
}: {
  asset: MediaAsset | null;
  previewUrls: Record<string, string>;
  fallbackUrl?: string;
  personName: string;
}): ImageViewerSource | null {
  const assetSource = mediaAssetViewerSource(asset, previewUrls, personName);
  if (assetSource) return assetSource;

  const src = normalizeUrl(fallbackUrl);
  if (!src) return null;

  return {
    id: `fallback:${src}`,
    src,
    title: personName,
    alt: `imagen de ${personName}`,
  };
}

export function personReignRangeLabel(person: Pick<Person, "reinados">): string {
  const years = person.reinados
    .flatMap((row) => [row?.["Inicio del reinado (año)"], row?.["Final del reinado (año)"]])
    .filter((year): year is string | number => year != null)
    .map((year) => asYearOrNull(year))
    .filter((year): year is number => year !== null);

  if (!years.length) return "—";

  return `${Math.min(...years)} - ${Math.max(...years)}`;
}

function uniqueLifeParts(values: unknown[]): string[] {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const value of values) {
    const part = String(value ?? "").trim();
    const key = colorKey(part);
    if (!part || seen.has(key)) continue;
    seen.add(key);
    parts.push(part);
  }

  return parts;
}

function splitParentheticalLocation(value: string): { main: string; parentLocations: string[] } {
  const match = value.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!match) return { main: value, parentLocations: [] };

  return {
    main: match[1].trim() || value,
    parentLocations: match[2].split(",").map((part) => part.trim()),
  };
}

function personLocationDisplay({
  place,
  city,
  province,
  country,
}: {
  place: unknown;
  city: unknown;
  province: unknown;
  country: unknown;
}): string {
  const mainLocationRaw = firstNonEmpty(place, city);
  const parsedMainLocation = splitParentheticalLocation(mainLocationRaw);
  const mainLocation = parsedMainLocation.main;
  const normalizedMainLocation = colorKey(mainLocation);
  const parentLocations = uniqueLifeParts([
    ...parsedMainLocation.parentLocations,
    province,
    country,
  ]).filter((part) => {
    const normalizedPart = colorKey(part);
    return !normalizedMainLocation || (
      normalizedPart !== normalizedMainLocation &&
      !normalizedMainLocation.includes(normalizedPart)
    );
  });

  if (mainLocation && parentLocations.length) {
    return `${mainLocation} (${parentLocations.join(", ")})`;
  }

  return mainLocation || parentLocations.join(", ");
}

function lifeDisplay(date: string, location: string): string {
  return uniqueLifeParts([date, location]).join(", ");
}

export function personLifeFields(person: Pick<Person, "reinados"> | null | undefined): PersonLifeFields {
  const firstRow = person?.reinados?.[0] ?? {};
  const birthRaw = firstNonEmpty(
    firstRow?.["Nacimiento (Fecha)"],
    firstRow?.["Nacimiento (año)"],
    firstRow?.["Nacimiento (Año)"],
    firstRow?.Nacimiento
  );
  const deathRaw = firstNonEmpty(
    firstRow?.["Fallecimiento (Fecha)"],
    firstRow?.["Fallecimiento (año)"],
    firstRow?.["Fallecimiento (Año)"],
    firstRow?.Fallecimiento,
    firstRow?.Defunción,
    firstRow?.Muerte
  );
  const birthLocation = personLocationDisplay({
    place: firstRow?.["Nacimiento (lugar)"],
    city: firstRow?.["Nacimiento (ciudad)"],
    province: firstRow?.["Nacimiento (provincia)"],
    country: firstNonEmpty(
      firstRow?.["Nacimiento (País)"],
      firstRow?.["Nacimiento (Pais)"],
      firstRow?.["Nacimiento (país)"],
      firstRow?.["Nacimiento (pais)"]
    ),
  });
  const deathLocation = personLocationDisplay({
    place: firstRow?.["Fallecimiento (lugar)"],
    city: firstRow?.["Fallecimiento (ciudad)"],
    province: firstRow?.["Fallecimiento (provincia)"],
    country: firstNonEmpty(
      firstRow?.["Fallecimiento (País)"],
      firstRow?.["Fallecimiento (Pais)"],
      firstRow?.["Fallecimiento (país)"],
      firstRow?.["Fallecimiento (pais)"]
    ),
  });

  return {
    birthRaw,
    deathRaw,
    birthDateDisplay: birthRaw,
    deathDateDisplay: deathRaw,
    birthLocationDisplay: birthLocation,
    deathLocationDisplay: deathLocation,
    birthDisplay: lifeDisplay(birthRaw, birthLocation),
    deathDisplay: lifeDisplay(deathRaw, deathLocation),
  };
}

export function personDenominationsByKingdom(person: Pick<Person, "reinados">): PersonDenomination[] {
  return Array.from(
    new Map<string, PersonDenomination>(
      person.reinados.map((row): [string, PersonDenomination] => {
        const reino = String(row?.Reino ?? "").trim();
        const nombre = rowDisplayName(row);
        return [`${reino}::${nombre}`, { reino, nombre }];
      })
    ).values()
  );
}

export function personRahUrl(person: Pick<Person, "reinados"> | null | undefined): string {
  return normalizeUrl(person?.reinados?.[0]?.["Ficha RAH URL"]);
}

export function personImageFallbackUrl(person: Pick<Person, "reinados"> | null | undefined): string {
  return firstNonEmpty(...(person?.reinados ?? []).map((row) => row?.["Imagen URL"]));
}

export function personGovernmentPeriods(person: Pick<Person, "reinados">): GovernmentPeriodView[] {
  return person.reinados.map((row, index) => {
    const duration = row?._duracionCalc;
    return {
      row,
      rowId: String(row?._rowId ?? row?.ID ?? `period-${index + 1}`),
      reino: String(row?.Reino || "(sin reino)").trim() || "(sin reino)",
      nombre: rowDisplayName(row),
      inicio: row?.["Inicio del reinado (año)"],
      fin: row?.["Final del reinado (año)"],
      duration: typeof duration === "number" && Number.isFinite(duration) ? duration : null,
      durationSource: row?._duracionFuente,
      nroReinado: String(row?.["Nº Reinado"] ?? "").trim(),
      tipoGobierno: row?.["Tipo de gobierno"],
      dinastia: row?.Dinastía,
    };
  });
}

export function rightsLabel(status: MediaRightsStatus): string {
  return RIGHTS_OPTIONS.find((option) => option.value === status)?.label ?? RIGHTS_OPTIONS[0].label;
}

export function chronologyMeta(value: unknown): DataMeta | undefined {
  const evidence = getChronologyEvidence(value);
  if (evidence.kind === "empty") return undefined;
  return {
    kind: evidence.kind === "inferred" ? "inferred" : "original",
    label: evidence.kind === "inferred" ? "Inferido" : "Original",
    tooltip: evidence.tooltip,
  };
}

export function calculatedMeta(tooltip: string): DataMeta {
  return { kind: "calculated", label: "Calculado", tooltip };
}

export function durationMeta(source: unknown): DataMeta {
  const raw = String(source ?? "").trim();
  if (raw === "duracionAnios") {
    return {
      kind: "original",
      label: "Original",
      tooltip: "Dato original del campo de duración.",
    };
  }

  if (raw.startsWith("inicio/fin")) {
    return {
      kind: "calculated",
      label: "Calculado",
      tooltip: "Calculado desde el inicio y el final del gobierno.",
    };
  }

  return {
    kind: "calculated",
    label: "Calculado",
    tooltip: "Calculado con los datos cronológicos disponibles.",
  };
}

export function rangeMeta(start: unknown, end: unknown): DataMeta {
  const startEvidence = getChronologyEvidence(start);
  const endEvidence = getChronologyEvidence(end);
  const hasInferred = startEvidence.kind === "inferred" || endEvidence.kind === "inferred";
  const hasComputed = startEvidence.year !== null || endEvidence.year !== null;

  if (hasInferred) {
    return {
      kind: "inferred",
      label: "Inferido",
      tooltip: `Inferido desde el rango. Inicio: ${startEvidence.tooltip} Final: ${endEvidence.tooltip}`,
    };
  }

  return {
    kind: hasComputed ? "original" : "calculated",
    label: hasComputed ? "Original" : "Calculado",
    tooltip: hasComputed
      ? "Dato original del rango de gobierno."
      : "Calculado sin rango cronológico completo.",
  };
}
