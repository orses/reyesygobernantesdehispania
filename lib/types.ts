// ---------------------------------------------------------------------------
// Tipos centrales del proyecto «Gobernantes de España»
// ---------------------------------------------------------------------------

/** Campos posibles de un registro CSV/JSON (una fila = un gobierno). */
export interface RawRow {
    // — Identificadores
    ID?: string;
    PersonID?: string | number;
    personId?: string | number;
    personID?: string | number;
    "Nº Reinado"?: string;

    // — Datos del gobernante
    "Nombre principal"?: string;
    Nombre?: string;
    nombre?: string;
    Apelativo?: string;
    apelativo?: string;

    // — Gobierno
    Reino?: string;
    "Tipo de gobierno"?: string;
    Dinastía?: string;
    "Inicio del reinado (año)"?: string | number;
    "Final del reinado (año)"?: string | number;
    "Inicio Reinado (Fecha)"?: string;
    "Fin Reinado (Fecha)"?: string;
    "Inicio reinado (fecha)"?: string;
    "Fin reinado (fecha)"?: string;
    inicioReinado?: string;
    finReinado?: string;
    inicioAnio?: string | number;
    finAnio?: string | number;
    duracionAnios?: string | number;
    "Duración (años)"?: string | number;
    "duración (años)"?: string | number;

    // — Nacimiento / Fallecimiento
    "Nacimiento (Fecha)"?: string;
    "Nacimiento (año)"?: string;
    "Nacimiento (Año)"?: string;
    Nacimiento?: string;
    nacimiento?: string;
    "Nacimiento (lugar)"?: string;
    "Nacimiento (ciudad)"?: string;
    "Nacimiento (provincia)"?: string;
    "Nacimiento (País)"?: string;
    "Fallecimiento (Fecha)"?: string;
    "Fallecimiento (año)"?: string;
    "Fallecimiento (Año)"?: string;
    Fallecimiento?: string;
    fallecimiento?: string;
    Defunción?: string;
    Muerte?: string;
    "Fallecimiento (lugar)"?: string;
    "Fallecimiento (ciudad)"?: string;
    "Fallecimiento (provincia)"?: string;
    "Fallecimiento (País)"?: string;
    Enterramiento?: string;

    // — Metadatos
    Descripción?: string;
    "Imagen URL"?: string;
    Galería?: string;
    "Ficha RAH URL"?: string;
    "Información verificada"?: string;

    // — Sucesión manual por gobierno (override del cálculo cronológico automático).
    // Guardan una referencia de fila «row:<_rowId>»; también aceptan el PersonID legado.
    // Vacío = automático.
    Predecesor?: string;
    Sucesor?: string;

    // — Campos derivados (calculados en runtime)
    _rowId?: string;
    _duracionCalc?: number | null;
    _duracionFuente?: string;

    // Permitir claves arbitrarias de CSV/JSON desconocidos
    [key: string]: unknown;
}

/** Estado jurídico declarado para una imagen. */
export type MediaRightsStatus =
    | "public-domain"
    | "licensed"
    | "copyrighted"
    | "unknown";

/** Origen técnico de una imagen asociada a un personaje. */
export type MediaKind = "external-url" | "uploaded-file";

/** Dirección de movimiento dentro de la galería de un personaje. */
export type MediaAssetMoveDirection = "up" | "down";

/** Metadatos opcionales al crear una imagen asociada a un personaje. */
export interface MediaInputOptions {
    rightsStatus?: MediaRightsStatus;
    title?: string;
    workDate?: string;
    author?: string;
    sourceName?: string;
    sourceUrl?: string;
    license?: string;
    usageNotes?: string;
}

/** Imagen asociada a un personaje, con metadatos de fuente y derechos. */
export interface MediaAsset {
    id: string;
    personId: string;
    kind: MediaKind;
    src: string;
    storageKey?: string;
    title?: string;
    /** Fecha de la obra (cuándo se creó el cuadro, foto, grabado…). Texto libre y editable. */
    workDate?: string;
    author?: string;
    sourceName?: string;
    sourceUrl?: string;
    license?: string;
    rightsStatus: MediaRightsStatus;
    usageNotes?: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
    packagePath?: string;
    printPackagePath?: string;
    printDpi?: number;
    isPrimary: boolean;
    createdAt: string;
    updatedAt?: string;
}

/** Resultado de parsear un CSV. */
export interface CsvParseResult {
    ok: boolean;
    value?: RawRow[];
    error?: string;
    delimiter?: string;
    usesQuotes?: boolean;
}

/** Resultado de parsear JSON. */
export interface JsonParseResult {
    ok: boolean;
    value?: unknown;
    error?: string;
}

/** Resultado de normalizar filas. */
export interface NormalizeResult {
    ok: boolean;
    value?: RawRow[];
    error?: string;
}

/** Personaje: agrupación de reinados con el mismo PersonID. */
export interface Person {
    personId: string | number;
    nombrePrincipal: string;
    nombres: string[];
    apelativos: string[];
    reinos: string[];
    dinastia: string;
    dinastias: string[];
    hasDinastiaConflict: boolean;
    verifiedAll: boolean;
    minInicioAnio: number | null;
    birthYear: number | null;
    deathYear: number | null;
    birthRaw: string | null;
    deathRaw: string | null;
    age: number | null;
    reinados: RawRow[];
}

/** Datos de duración de un reinado individual (para gráficos). */
export interface DurationEntry {
    label: string;
    years: number;
    personId: string;
}

/** Datos de edad de un gobernante (para gráficos). */
export interface AgeEntry {
    label: string;
    age: number;
    isApprox: boolean;
    personId: string;
}

/** Datos de conteo por categoría (dinastía, tipo, entidad...). */
export interface CountEntry {
    name: string;
    count: number;
}

/** Datos de duración acumulada por entidad. */
export interface DurationByEntityEntry {
    name: string;
    years: number;
}

/** Datos por siglo. */
export interface CenturyEntry {
    c: number;
    century: string;
    count: number;
}

/** Estadísticas globales o filtradas. */
export interface Stats {
    totalFilas: number;
    totalMonarcas: number;
    verifiedMonarcas: number;
    mean: number | null;
    byDinastia: CountEntry[];
    byTipoGobierno: CountEntry[];
    byEntity: CountEntry[];
    byEntityDuration: DurationByEntityEntry[];
    topLongestReign: DurationEntry[];
    topShortestReign: DurationEntry[];
    topOldestMonarch: AgeEntry[];
    topYoungestMonarch: AgeEntry[];
    perCentury: CenturyEntry[];
}

/** Estado de filtros. */
export interface FilterState {
    query: string;
    filterReino: string;
    filterDinastia: string;
    filterSiglo: string;
    filterDinastiaLocked: boolean;
    sortKey: string;
    sortDir: string;
}

/** Estado de edición. */
export interface EditorState {
    editorOpen: boolean;
    editorMode: "person" | "row";
    draftPersonId: string | number | null;
    draftRowId: string | number | null;
    draft: RawRow | null;
    deleteOpen: boolean;
    deleteTarget: { kind: string; id: string | number | null };
}

/** Estado de notificaciones. */
export interface NotificationState {
    showCsvNotice: boolean;
    showChecksNotice: boolean;
    showErrorNotice: boolean;
    showNoticeCenter: boolean;
}

/** Props del componente Notification. */
export interface NotificationProps {
    type: "csv" | "warn" | "error";
    message: string;
    list?: string[];
    rawText?: string;
    onClose: () => void;
}

/** Resultado de las comprobaciones del dataset. */
export interface DatasetChecks {
    ok: boolean;
    issues: string[];
}
