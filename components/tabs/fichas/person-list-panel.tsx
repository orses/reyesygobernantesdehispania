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
import { firstNonEmpty, formatCenturyLabel } from "../../../lib/data";
import { kingdomColor, personReignRangeLabel } from "../../../lib/ficha-view";
import { getPrimaryMediaAsset } from "../../../lib/media";
import type { MediaAsset, Person } from "../../../lib/types";
import { MediaThumb, VerifiedBadge } from "./shared";

type StateSetter<T> = (value: T | ((prev: T) => T)) => void;

interface PersonListPanelProps {
  people: Person[];
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
  setSelectedPersonId: (value: string | null) => void;
  onSearchSubmit: (query: string) => void;
  reinos: string[];
  dinastias: string[];
  siglos: string[];
  mediaAssets: MediaAsset[];
  mediaPreviewUrls: Record<string, string>;
}

export function PersonListPanel({
  people,
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
  setSelectedPersonId,
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
  const activeFilterCount =
    (hasQuery ? 1 : 0) +
    (hasReinoFilter ? 1 : 0) +
    (hasDinastiaFilter ? 1 : 0) +
    (hasSigloFilter ? 1 : 0) +
    (hasSortFilter ? 1 : 0);
  const hasAnyFilter = activeFilterCount > 0;
  const filterLabelClass = (active: boolean) =>
    `text-sm font-semibold ${active ? "text-amber-200" : "text-slate-200"}`;
  const controlClass = (active: boolean) =>
    `h-9 cursor-pointer rounded-[3px] text-slate-50 hover:bg-slate-900/60 ${
      active
        ? "border-amber-400/70 bg-amber-950/25 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.14)]"
        : "border-slate-700/70 bg-slate-950/30"
    }`;

  return (
    <Card className="min-w-0 rounded-[3px] shadow-sm bg-slate-900/30 border border-slate-800 xl:sticky xl:top-2 xl:flex xl:h-[calc(100vh-1rem)] xl:max-h-[calc(100vh-1rem)] xl:flex-col xl:overflow-visible">
      <CardHeader className="relative z-40 shrink-0 border-b border-slate-800/70 bg-slate-900/95 p-4 pb-3">
        <CardTitle className="text-lg font-bold tracking-tight text-slate-50">Personajes</CardTitle>
        <CardDescription className="text-base text-slate-200">
          {people.length} personajes, {rowsCount} gobiernos
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
              placeholder="buscar por nombre, dinastía, reino..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                onSearchSubmit(event.currentTarget.value);
              }}
            />
            {query ? (
              <button
                type="button"
                className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[3px] text-slate-200 hover:bg-slate-800 hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                onClick={() => setQuery("")}
                aria-label="Borrar búsqueda"
                title="Borrar"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
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
          </div>

          <div className="space-y-1">
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
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400/90 px-1.5 text-xs font-black text-slate-950">
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
            {people.map((person) => {
              const active = String(person.personId) === String(selectedPersonId);
              const primaryMedia = getPrimaryMediaAsset(mediaAssets, person.personId);
              const rangeStr = personReignRangeLabel(person);

              return (
                <button
                  key={person.personId}
                  className={`w-full cursor-pointer text-left rounded-[3px] px-3 py-2 transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${active ? "bg-slate-800/70 border-emerald-400/70" : "bg-slate-900/35 border-slate-600/80 hover:bg-slate-900/55 hover:border-slate-400/90"}`}
                  onClick={() => setSelectedPersonId(String(person.personId))}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <MediaThumb
                        asset={primaryMedia}
                        previewUrls={mediaPreviewUrls}
                        fallbackUrl={firstNonEmpty(...person.reinados.map((row) => row?.["Imagen URL"]))}
                        alt={`imagen de ${person.nombrePrincipal}`}
                      />

                      <div className="min-w-0 space-y-1">
                        <div className="text-base font-extrabold leading-5 truncate text-emerald-200">{person.nombrePrincipal}</div>
                        <div className="truncate text-sm font-semibold text-slate-300">{person.dinastia || "sin dinastía"}</div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <VerifiedBadge verified={person.verifiedAll} />
                      <span className="inline-flex items-center rounded-[3px] border border-emerald-400/45 bg-slate-950/80 px-2.5 py-1 text-sm font-medium tabular-nums text-emerald-100 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)] cursor-default pointer-events-none select-none">
                        {rangeStr}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {person.reinos.length ? (
                      person.reinos.slice(0, 4).map((reino) => {
                        const color = kingdomColor(reino);
                        return (
                          <span
                            key={reino}
                            className="inline-flex max-w-full items-center truncate rounded-[3px] border px-2 py-0.5 text-xs font-medium text-white"
                            style={{
                              backgroundColor: color ? color + "cc" : "rgba(2,6,23,0.3)",
                              borderColor: color || "rgba(100,116,139,0.7)",
                            }}
                            title={`Reino: ${reino}`}
                          >
                            {reino}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-sm text-slate-400">sin reino</span>
                    )}
                    {person.reinos.length > 4 ? (
                      <span className="text-xs font-medium text-slate-400">+{person.reinos.length - 4}</span>
                    ) : null}
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
