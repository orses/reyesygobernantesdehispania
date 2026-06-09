import { RotateCcw, Search, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { ScrollArea } from "../../ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { asYearOrNull, firstNonEmpty, formatCenturyLabel, rowDisplayName } from "../../../lib/data";
import { kingdomColor } from "../../../lib/ficha-view";
import { getPrimaryMediaAsset } from "../../../lib/media";
import { normalizePersonSearchText, personDinastiaSummary, rowSpansCentury } from "../../../lib/people";
import type { MediaAsset, Person, RawRow } from "../../../lib/types";
import { MediaThumb } from "./shared";

type StateSetter<T> = (value: T | ((prev: T) => T)) => void;

interface GovernmentCardItem {
  person: Person;
  row: RawRow;
  rowId: string;
  name: string;
  kingdom: string;
  dynastyLabel: string;
  governmentType: string;
  startYear: number | null;
  endYear: number | null;
  duration: number | null;
  order: number;
}

function normalizeSearchNeedle(value: string): string {
  return normalizePersonSearchText(
    value
      .replace(/\b(nombre|name|rey|monarca|personaje|reino|reinos|kingdom|dinastia|dinastía|tipo|gobierno)\s*[:=]\s*/gi, "")
      .replace(/\b(and|y)\b/gi, " ")
      .replace(/["']/g, "")
  );
}

function simpleRowSearchTerms(query: string): string[] | null {
  if (!query.trim()) return [];
  if (/[<>=()]/.test(query) || /\b(no|not|or|o)\b/iu.test(query) || /(^|\s)-\S/.test(query)) {
    return null;
  }

  return normalizeSearchNeedle(query).split(/\s+/).filter(Boolean);
}

function rowDynasty(row: RawRow): string {
  return String(row?.Dinastía ?? "").trim();
}

function rowKingdom(row: RawRow): string {
  return String(row?.Reino ?? "").trim();
}

function rowGovernmentType(row: RawRow): string {
  return String(row?.["Tipo de gobierno"] ?? "").trim();
}

function rowDuration(row: RawRow): number | null {
  const duration = row?._duracionCalc;
  return typeof duration === "number" && Number.isFinite(duration) ? duration : null;
}

function rowSearchText(person: Person, row: RawRow): string {
  return [
    person.nombrePrincipal,
    ...person.apelativos,
    rowDisplayName(row),
    row?.Nombre,
    row?.nombre,
    row?.Apelativo,
    row?.apelativo,
    row?.Reino,
    row?.Dinastía,
    row?.["Tipo de gobierno"],
    row?.["Inicio del reinado (año)"],
    row?.["Final del reinado (año)"],
  ].map((value) => String(value ?? "")).join(" ");
}

function rowMatchesQuery(person: Person, row: RawRow, query: string): boolean {
  const terms = simpleRowSearchTerms(query);
  if (terms === null || terms.length === 0) return true;

  const haystack = normalizePersonSearchText(rowSearchText(person, row));
  return terms.every((term) => haystack.includes(term));
}

function rowMatchesFilters(
  person: Person,
  row: RawRow,
  query: string,
  filterReino: string,
  filterDinastia: string,
  filterSiglo: string
): boolean {
  if (filterReino !== "__all__" && rowKingdom(row) !== filterReino) return false;
  if (
    filterDinastia !== "__all__" &&
    normalizePersonSearchText(rowDynasty(row)) !== normalizePersonSearchText(filterDinastia)
  ) {
    return false;
  }
  if (filterSiglo !== "__all__") {
    const century = Number.parseInt(filterSiglo, 10);
    if (Number.isFinite(century) && !rowSpansCentury(row, century)) return false;
  }

  return rowMatchesQuery(person, row, query);
}

function governmentCardItems(
  people: Person[],
  query: string,
  filterReino: string,
  filterDinastia: string,
  filterSiglo: string
): GovernmentCardItem[] {
  let order = 0;
  const items: GovernmentCardItem[] = [];

  for (const person of people) {
    const personDynastySummary = personDinastiaSummary(person);

    for (const [rowIndex, row] of person.reinados.entries()) {
      const rowId = String(row?._rowId ?? row?.ID ?? `period-${rowIndex + 1}`);
      const currentOrder = order;
      order += 1;
      if (!rowMatchesFilters(person, row, query, filterReino, filterDinastia, filterSiglo)) continue;

      items.push({
        person,
        row,
        rowId,
        name: rowDisplayName(row),
        kingdom: rowKingdom(row),
        dynastyLabel: rowDynasty(row) || personDynastySummary.label,
        governmentType: rowGovernmentType(row),
        startYear: asYearOrNull(row?.["Inicio del reinado (año)"]),
        endYear: asYearOrNull(row?.["Final del reinado (año)"]),
        duration: rowDuration(row),
        order: currentOrder,
      });
    }
  }

  return items;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "es");
}

function compareGovernmentCards(a: GovernmentCardItem, b: GovernmentCardItem, sortKey: string, sortDir: string): number {
  let comparison: number;

  switch (sortKey) {
    case "nombre":
      comparison = compareText(a.name, b.name);
      break;
    case "dinastia":
      comparison = compareText(a.dynastyLabel, b.dynastyLabel);
      break;
    case "reinos":
      comparison = compareText(a.kingdom, b.kingdom);
      break;
    case "duracion":
      comparison = (a.duration ?? -1) - (b.duration ?? -1);
      break;
    case "edad":
      comparison = (a.person.age ?? -1) - (b.person.age ?? -1);
      break;
    case "cronologia":
    default:
      comparison = (a.startYear ?? 9999) - (b.startYear ?? 9999);
      if (comparison === 0) comparison = (a.endYear ?? 9999) - (b.endYear ?? 9999);
      if (comparison === 0) comparison = compareText(a.name, b.name);
      break;
  }

  if (comparison === 0) comparison = a.order - b.order;
  return sortDir === "desc" ? -comparison : comparison;
}

function rangeLabel(item: GovernmentCardItem): string {
  return `${item.startYear !== null ? item.startYear : "—"} - ${item.endYear !== null ? item.endYear : "—"}`;
}

interface PersonListPanelProps {
  people: Person[];
  totalPeopleCount: number;
  rowsCount: number;
  query: string;
  setQuery: StateSetter<string>;
  filterReino: string;
  setFilterReino: StateSetter<string>;
  filterDinastia: string;
  setFilterDinastia: StateSetter<string>;
  filterSiglo: string;
  setFilterSiglo: StateSetter<string>;
  setFilterDinastiaLocked: StateSetter<boolean>;
  sortKey: string;
  setSortKey: (value: string) => void;
  sortDir: string;
  setSortDir: (value: string) => void;
  sortOptions: Record<string, string>;
  selectedPersonId: string | null;
  selectedGovernmentRowId: string | null;
  setSelectedGovernment: (personId: string, rowId: string) => void;
  onSearchSubmit: (query: string) => void;
  reinos: string[];
  dinastias: string[];
  siglos: string[];
  mediaAssets: MediaAsset[];
  mediaPreviewUrls: Record<string, string>;
}

export function PersonListPanel({
  people,
  totalPeopleCount,
  rowsCount,
  query,
  setQuery,
  filterReino,
  setFilterReino,
  filterDinastia,
  setFilterDinastia,
  filterSiglo,
  setFilterSiglo,
  setFilterDinastiaLocked,
  sortKey,
  setSortKey,
  sortDir,
  setSortDir,
  sortOptions,
  selectedPersonId,
  selectedGovernmentRowId,
  setSelectedGovernment,
  onSearchSubmit,
  reinos,
  dinastias,
  siglos,
  mediaAssets,
  mediaPreviewUrls,
}: PersonListPanelProps) {
  const hasQuery = query.trim().length > 0;
  const hasReinoFilter = filterReino !== "__all__";
  const hasDinastiaFilter = filterDinastia !== "__all__";
  const hasSigloFilter = filterSiglo !== "__all__";
  const hasSortFilter = sortKey !== "cronologia" || sortDir !== "asc";
  const governmentCards = governmentCardItems(people, query, filterReino, filterDinastia, filterSiglo)
    .sort((a, b) => compareGovernmentCards(a, b, sortKey, sortDir));
  const activeFilterCount =
    (hasQuery ? 1 : 0) +
    (hasReinoFilter ? 1 : 0) +
    (hasDinastiaFilter ? 1 : 0) +
    (hasSigloFilter ? 1 : 0) +
    (hasSortFilter ? 1 : 0);
  const hasAnyFilter = activeFilterCount > 0;
  const governmentCountLabel = hasAnyFilter
    ? (
      <>
        <span className="inline-flex min-w-7 items-center justify-center rounded-[3px] border border-amber-400/70 bg-amber-400/90 px-1.5 font-semibold tabular-nums text-slate-950">
          {governmentCards.length}
        </span>{" "}
        de {rowsCount} gobiernos, {totalPeopleCount} personajes
      </>
    )
    : (
      <>{governmentCards.length} gobiernos, {totalPeopleCount} personajes</>
    );
  const filterLabelClass = (active: boolean) =>
    `text-sm font-medium ${active ? "text-amber-200" : "text-slate-200"}`;
  const controlClass = (active: boolean) =>
    `h-9 cursor-pointer rounded-[3px] text-slate-50 hover:bg-slate-900/60 ${
      active
        ? "border-amber-400/70 bg-amber-950/25 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.14)]"
        : "border-slate-700/70 bg-slate-950/30"
    }`;
  const clearSearch = () => setQuery("");

  return (
    <Card className="min-w-0 rounded-[3px] shadow-sm bg-slate-900/30 border border-slate-800 xl:sticky xl:top-2 xl:flex xl:h-[calc(100vh-1rem)] xl:max-h-[calc(100vh-1rem)] xl:flex-col xl:overflow-visible">
      <CardHeader className="relative z-40 shrink-0 border-b border-slate-800/70 bg-slate-900/95 p-4 pb-3">
        <CardTitle className="text-lg font-medium tracking-tight text-slate-50">Gobiernos</CardTitle>
        <CardDescription className="text-base text-slate-200">
          {governmentCountLabel}
        </CardDescription>

        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${hasQuery ? "text-amber-200" : "text-slate-300"}`} />
            <Input
              className={`h-9 rounded-[3px] pl-10 pr-11 text-sm font-medium text-slate-50 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                hasQuery
                  ? "border-amber-400/70 bg-amber-950/25 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.14)]"
                  : "border-slate-700/60 bg-slate-900/60"
              }`}
              placeholder="Buscar: reino:Castilla, siglo>=15, NO Aragón..."
              title="Búsqueda avanzada: OR/O, AND/Y, espacio como AND, NO/NOT/- y campos como reino:, dinastia:, año>=, inicio>=, fin<=, siglo=."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  if (query) {
                    event.preventDefault();
                    clearSearch();
                  }
                  return;
                }

                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                onSearchSubmit(event.currentTarget.value);
              }}
            />
            {query ? (
              <button
                type="button"
                className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[3px] text-slate-200 hover:bg-slate-800 hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                onClick={clearSearch}
                aria-label="Borrar búsqueda"
                title="Borrar"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-1">
              <div className={filterLabelClass(hasSigloFilter)}>Siglo</div>
              <Select value={filterSiglo} onValueChange={setFilterSiglo}>
                <SelectTrigger className={controlClass(hasSigloFilter)}>
                  <SelectValue>{filterSiglo === "__all__" ? "todos" : formatCenturyLabel(filterSiglo)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-slate-950 text-slate-50 border-slate-800">
                  <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="__all__">todos</SelectItem>
                  {siglos.map((siglo) => (
                    <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" key={siglo} value={String(siglo)}>
                      {formatCenturyLabel(siglo)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <div className={filterLabelClass(hasReinoFilter)}>Reino</div>
              <Select value={filterReino} onValueChange={setFilterReino}>
                <SelectTrigger className={controlClass(hasReinoFilter)}>
                  <SelectValue>{filterReino === "__all__" ? "todos" : filterReino}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-slate-950 text-slate-50 border-slate-800">
                  <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="__all__">todos</SelectItem>
                  {reinos.map((reino) => (
                    <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" key={reino} value={reino}>
                      {reino}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <div className={filterLabelClass(hasDinastiaFilter)}>Dinastía</div>
            <Select value={filterDinastia} onValueChange={setFilterDinastia}>
              <SelectTrigger className={controlClass(hasDinastiaFilter)}>
                <SelectValue>{filterDinastia === "__all__" ? "todas" : filterDinastia}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-slate-950 text-slate-50 border-slate-800">
                <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="__all__">todas</SelectItem>
                {dinastias.map((dinastia) => (
                  <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" key={dinastia} value={dinastia}>
                    {dinastia}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className={filterLabelClass(hasSortFilter)}>Orden</div>
            <Select
              value={`${sortKey}:${sortDir}`}
              onValueChange={(value: string) => {
                const [key, direction] = value.split(":");
                setSortKey(key);
                setSortDir(direction);
              }}
            >
              <SelectTrigger className={controlClass(hasSortFilter)}>
                <SelectValue>{sortOptions[`${sortKey}:${sortDir}`] || "ordenar..."}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-slate-950 text-slate-50 border-slate-800">
                <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="cronologia:asc">cronología: más antiguos a más recientes</SelectItem>
                <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="cronologia:desc">cronología: más recientes a más antiguos</SelectItem>
                <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="nombre:asc">nombre: A-Z</SelectItem>
                <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="nombre:desc">nombre: Z-A</SelectItem>
                <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="dinastia:asc">dinastía: A-Z</SelectItem>
                <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="dinastia:desc">dinastía: Z-A</SelectItem>
                <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="reinos:asc">reinos: A-Z</SelectItem>
                <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="reinos:desc">reinos: Z-A</SelectItem>
                <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="duracion:desc">duración: mayor a menor</SelectItem>
                <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="duracion:asc">duración: menor a mayor</SelectItem>
                <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="edad:desc">edad: mayor a menor</SelectItem>
                <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="edad:asc">edad: menor a mayor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={!hasAnyFilter}
              className={`rounded-[3px] border transition-colors ${
                hasAnyFilter
                  ? "cursor-pointer border-amber-400/70 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.18)]"
                  : "border-slate-800 bg-slate-950/20 text-slate-500"
              }`}
              title={hasAnyFilter ? `Restablecer ${activeFilterCount} filtro(s) activo(s)` : "No hay filtros que restablecer"}
              onClick={() => {
                setQuery("");
                setFilterReino("__all__");
                setFilterDinastia("__all__");
                setFilterSiglo("__all__");
                setFilterDinastiaLocked(false);
                setSortKey("cronologia");
                setSortDir("asc");
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              restablecer filtros
              {hasAnyFilter ? (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400/90 px-1.5 text-xs font-semibold text-slate-950">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 min-h-0 flex-1 overflow-hidden pt-3">
        <ScrollArea className="h-[62vh] max-h-[520px] pr-2 xl:h-full xl:max-h-none xl:min-h-0 xl:pr-3">
          <div className="space-y-2">
            {governmentCards.map((item) => {
              const active =
                item.rowId === selectedGovernmentRowId ||
                (!selectedGovernmentRowId && String(item.person.personId) === String(selectedPersonId));
              const primaryMedia = getPrimaryMediaAsset(mediaAssets, item.person.personId);
              const rangeStr = rangeLabel(item);

              return (
                <button
                  key={`${item.person.personId}-${item.rowId}`}
                  className={`w-full cursor-pointer text-left rounded-[3px] px-3 py-2 transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${active ? "bg-slate-800/70 border-emerald-400/70" : "bg-slate-900/35 border-slate-600/80 hover:bg-slate-900/55 hover:border-slate-400/90"}`}
                  onClick={() => setSelectedGovernment(String(item.person.personId), item.rowId)}
                  title={item.person.nombrePrincipal !== item.name ? `${item.name} · ${item.person.nombrePrincipal}` : item.name}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <MediaThumb
                        asset={primaryMedia}
                        previewUrls={mediaPreviewUrls}
                        fallbackUrl={firstNonEmpty(item.row?.["Imagen URL"], ...item.person.reinados.map((row) => row?.["Imagen URL"]))}
                        alt={`imagen de ${item.name}`}
                      />

                      <div className="min-w-0 space-y-1">
                        <div className="truncate text-base font-semibold leading-5 text-emerald-200">
                          {item.name}
                        </div>
                        <div className="truncate text-sm font-medium text-slate-300" title={item.dynastyLabel}>
                          {item.dynastyLabel}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="inline-flex items-center rounded-[3px] border border-emerald-400/45 bg-slate-950/80 px-2.5 py-1 text-sm font-medium tabular-nums text-emerald-100 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)] cursor-default pointer-events-none select-none">
                        {rangeStr}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.person.reinos.length ? (
                      item.person.reinos.map((reino) => {
                        const kingdomChipColor = kingdomColor(reino);
                        const isCurrentKingdom =
                          normalizePersonSearchText(reino) === normalizePersonSearchText(item.kingdom);
                        return (
                          <span
                            key={reino}
                            className={`inline-flex max-w-full items-center truncate rounded-[3px] border px-2 py-0.5 text-xs font-medium transition-opacity ${
                              isCurrentKingdom ? "text-white" : "text-slate-300 opacity-55"
                            }`}
                            style={{
                              backgroundColor: kingdomChipColor
                                ? kingdomChipColor + (isCurrentKingdom ? "cc" : "55")
                                : isCurrentKingdom
                                  ? "rgba(2,6,23,0.3)"
                                  : "rgba(2,6,23,0.16)",
                              borderColor: kingdomChipColor
                                ? kingdomChipColor + (isCurrentKingdom ? "" : "88")
                                : "rgba(100,116,139,0.7)",
                            }}
                            title={isCurrentKingdom ? `${reino}: reino de esta tarjeta` : reino}
                          >
                            {reino}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-sm text-slate-400">sin reino</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
