import { Search } from "lucide-react";
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
import { kingdomBadgeStyle, personReignRangeLabel } from "../../../lib/ficha-view";
import { getPrimaryMediaAsset } from "../../../lib/media";
import type { MediaAsset, Person } from "../../../lib/types";
import { DataBadge, MediaThumb, VerifiedBadge } from "./shared";

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
  reinos,
  dinastias,
  siglos,
  mediaAssets,
  mediaPreviewUrls,
}: PersonListPanelProps) {
  return (
    <Card className="min-w-0 rounded-[3px] shadow-sm bg-slate-900/30 border border-slate-800 xl:sticky xl:top-2 xl:flex xl:h-[calc(100vh-1rem)] xl:max-h-[calc(100vh-1rem)] xl:flex-col xl:overflow-visible">
      <CardHeader className="relative z-40 shrink-0 border-b border-slate-800/70 bg-slate-900/95 p-4 pb-3">
        <CardTitle className="text-lg font-bold tracking-tight text-slate-50">Personajes</CardTitle>
        <CardDescription className="text-base text-slate-200">
          {people.length} personajes, {rowsCount} gobiernos
        </CardDescription>

        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-300" />
            <Input
              className="h-9 pl-10 pr-10 rounded-[3px] text-sm font-medium bg-slate-900/60 text-slate-50 placeholder:text-slate-400 border-slate-700/60 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              placeholder="buscar por nombre, dinastía, reino..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-[3px] text-slate-200 hover:bg-slate-800 hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                onClick={() => setQuery("")}
                aria-label="borrar búsqueda"
                title="borrar"
              >
                ×
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-200">Reino</div>
              <Select value={filterReino} onValueChange={setFilterReino}>
                <SelectTrigger className="h-9 cursor-pointer rounded-[3px] bg-slate-950/30 border-slate-700/70 text-slate-50 hover:bg-slate-900/60">
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
              <div className="text-sm font-semibold text-slate-200">Dinastía</div>
              <Select value={filterDinastia} onValueChange={setFilterDinastia}>
                <SelectTrigger className="h-9 cursor-pointer rounded-[3px] bg-slate-950/30 border-slate-700/70 text-slate-50 hover:bg-slate-900/60">
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
            <div className="text-sm font-semibold text-slate-200">Siglo</div>
            <Select value={filterSiglo} onValueChange={setFilterSiglo}>
              <SelectTrigger className="h-9 cursor-pointer rounded-[3px] bg-slate-950/30 border-slate-700/70 text-slate-50 hover:bg-slate-900/60">
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
            <div className="text-sm font-semibold text-slate-200">Orden</div>
            <Select
              value={`${sortKey}:${sortDir}`}
              onValueChange={(value: string) => {
                const [key, direction] = value.split(":");
                setSortKey(key);
                setSortDir(direction);
              }}
            >
              <SelectTrigger className="h-9 cursor-pointer rounded-[3px] bg-slate-950/30 border-slate-700/70 text-slate-50 hover:bg-slate-900/60">
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
              className="cursor-pointer rounded-[3px] bg-slate-950/30 border border-slate-700/70 text-slate-100 hover:bg-slate-900/60 hover:text-slate-100"
              title="restablecer filtros"
              onClick={() => {
                setFilterReino("__all__");
                setFilterDinastia("__all__");
                setFilterSiglo("__all__");
                setFilterDinastiaLocked(false);
                setSortKey("cronologia");
                setSortDir("asc");
              }}
            >
              restablecer filtros
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
                        <div className="flex min-w-0 flex-wrap gap-1">
                          {person.reinos.length ? (
                            person.reinos.slice(0, 3).map((reino) => (
                              <DataBadge key={reino} style={kingdomBadgeStyle(reino)} title={`Reino: ${reino}`}>
                                {reino}
                              </DataBadge>
                            ))
                          ) : (
                            <span className="text-sm text-slate-400">sin reino</span>
                          )}
                          {person.reinos.length > 3 ? (
                            <span className="text-xs font-semibold text-slate-400">+{person.reinos.length - 3}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <VerifiedBadge verified={person.verifiedAll} />
                      <span className="inline-flex items-center rounded-[3px] border border-emerald-400/45 bg-slate-950/80 px-2.5 py-1.5 text-sm font-black tabular-nums text-emerald-100 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)] cursor-default pointer-events-none select-none">
                        {rangeStr}
                      </span>
                    </div>
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
