
import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { ScrollArea } from "../ui/scroll-area";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Search,
  Pencil,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import {
  firstNonEmpty,
  rowDisplayName,
  normalizeUrl,
  asNumberOrNull,
  formatCenturyLabel,
  formatNumber,
} from "../../lib/data";

/** Colores heráldicos por nombre de reino (minúsculas para matching) */
const REINO_COLORS: Record<string, string> = {
  "asturias": "#00468C",
  "reino de asturias": "#00468C",
  "reino de león": "#702963",
  "reino de galicia": "#0079AF",
  "corona de aragón": "#3E2723",
  "reino de navarra": "#BE9F23",
  "corona de castilla": "#991B2F",
  "reino de castilla": "#C0392B",
  "condado de castilla": "#E74C3C",
  "monarquía hispánica": "#B12B30",
};

function reinoColor(name: string): string | undefined {
  return REINO_COLORS[name.toLowerCase().trim()];
}

/** Devuelve true si la fecha cruda es «aproximada» (no es un año exacto). */
function isApproxDate(raw: string | null): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  // Si es solo 3-4 dígitos (opcionalmente con signo), es exacto.
  if (/^-?\d{3,4}$/.test(trimmed)) return false;
  // Todo lo demás es aproximado (c., siglo, p.s., etc.).
  return true;
}

export function SafeThumb({ url, alt = "", className = "" }: any) {
  const u = normalizeUrl(url);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    setOk(true);
  }, [u]);

  if (!u || !ok) {
    return (
      <div
        className={`h-14 w-12 shrink-0 rounded-[3px] border border-slate-700/70 bg-slate-950/30 flex items-center justify-center text-[10px] font-semibold text-slate-300 ${className}`}
        aria-label="sin imagen"
      >
        —
      </div>
    );
  }

  return (
    <img
      src={u}
      alt={alt}
      className={`h-14 w-12 shrink-0 rounded-[3px] border border-slate-700/70 object-cover object-top ${className}`}
      loading="lazy"
      onError={() => setOk(false)}
    />
  );
}

export function SafeFigure({ url, alt = "imagen" }: any) {
  const u = normalizeUrl(url);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    setOk(true);
  }, [u]);

  if (!u || !ok) {
    return (
      <div className="rounded-[3px] border border-slate-700/70 bg-slate-950/25 p-4 text-sm text-slate-200">sin imagen</div>
    );
  }

  return (
    <a
      href={u}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-[3px] border border-slate-700/70 bg-slate-950/25 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      title="abrir imagen en una pestaña nueva"
    >
      <img src={u} alt={alt} className="w-full h-auto object-cover object-top" onError={() => setOk(false)} />
    </a>
  );
}

function VerifiedBadge({ verified }: any) {
  if (verified) return null;

  return (
    <div className="flex items-center justify-center" title="no verificado" aria-label="no verificado">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-red-500">
        <circle cx="12" cy="12" r="10" strokeOpacity="0.8" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
    </div>
  );
}

function Field({ label, value, fallback = "—" }: any) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-semibold text-slate-200">{label}</div>
      <div className="text-base font-medium break-words text-slate-50">{value ? value : fallback}</div>
    </div>
  );
}

export function FichasTab({
  people,
  rows,
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
  selectedPersonId,
  setSelectedPersonId,
  selectedPerson,
  reinos,
  dinastias,
  siglos,
  selectedCenturies,
  selectedCenturiesText,
  openPersonEditor,
  openRowEditor,
  setDeleteTarget,
  setDeleteOpen
}: any) {
  const sortOptions: any = {
    "cronologia:asc": "cronología: más antiguos a más recientes",
    "cronologia:desc": "cronología: más recientes a más antiguos",
    "nombre:asc": "nombre: A-Z",
    "nombre:desc": "nombre: Z-A",
    "dinastia:asc": "dinastía: A-Z",
    "dinastia:desc": "dinastía: Z-A",
    "reinos:asc": "reinos: A-Z",
    "reinos:desc": "reinos: Z-A",
    "duracion:desc": "duración: mayor a menor",
    "duracion:asc": "duración: menor a mayor",
    "edad:desc": "edad: mayor a menor",
    "edad:asc": "edad: menor a mayor",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <Card className="rounded-[3px] shadow-sm lg:col-span-4 bg-slate-900/30 border border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold tracking-tight text-slate-50">Personajes</CardTitle>
          <CardDescription className="text-base text-slate-200">
            {people.length} personajes, {rows.length} gobiernos
          </CardDescription>

          <div className="mt-3 space-y-2">
            <div className="relative">
              <Search className="h-5 w-5 absolute left-3 top-3 text-slate-300" />
              <Input
                className="pl-10 pr-10 rounded-[3px] text-base font-medium bg-slate-900/60 text-slate-50 placeholder:text-slate-400 border-slate-700/60 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                placeholder="buscar por nombre, dinastía, reino…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
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

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-200">reino</div>
                <Select value={filterReino} onValueChange={setFilterReino}>
                  <SelectTrigger className="cursor-pointer rounded-[3px] bg-slate-950/30 border-slate-700/70 text-slate-50 hover:bg-slate-900/60">
                    <SelectValue>{filterReino === "__all__" ? "todos" : filterReino}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 text-slate-50 border-slate-800">
                    <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="__all__">todos</SelectItem>
                    {reinos.map((c: any) => (
                      <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-200">dinastía</div>
                <Select value={filterDinastia} onValueChange={setFilterDinastia}>
                  <SelectTrigger className="cursor-pointer rounded-[3px] bg-slate-950/30 border-slate-700/70 text-slate-50 hover:bg-slate-900/60">
                    <SelectValue>{filterDinastia === "__all__" ? "todas" : filterDinastia}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 text-slate-50 border-slate-800">
                    <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="__all__">todas</SelectItem>
                    {dinastias.map((c: any) => (
                      <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-200">siglo</div>
              <Select value={filterSiglo} onValueChange={setFilterSiglo}>
                <SelectTrigger className="cursor-pointer rounded-[3px] bg-slate-950/30 border-slate-700/70 text-slate-50 hover:bg-slate-900/60">
                  <SelectValue>{filterSiglo === "__all__" ? "todos" : formatCenturyLabel(filterSiglo)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-slate-950 text-slate-50 border-slate-800">
                  <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" value="__all__">todos</SelectItem>
                  {siglos.map((c: any) => (
                    <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-50" key={c} value={String(c)}>
                      {formatCenturyLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-200">orden</div>
              <Select
                value={`${sortKey}:${sortDir}`}
                onValueChange={(v: string) => {
                  const [k, d] = v.split(":");
                  setSortKey(k);
                  setSortDir(d);
                }}
              >
                <SelectTrigger className="cursor-pointer rounded-[3px] bg-slate-950/30 border-slate-700/70 text-slate-50 hover:bg-slate-900/60">
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

        <CardContent className="pt-0">
          <ScrollArea className="h-[520px] pr-4">
            <div className="space-y-2">
              {people.map((p: any) => {
                const active = String(p.personId) === String(selectedPersonId);
                const years = p.reinados
                  .flatMap((r: any) => [r?.["Inicio del reinado (año)"], r?.["Final del reinado (año)"]])
                  .filter((y: any) => y != null)
                  .map((y: any) => Number(y));

                const minYear = years.length ? Math.min(...years) : null;
                const maxYear = years.length ? Math.max(...years) : null;
                const rangeStr = minYear !== null ? `${minYear} - ${maxYear ?? '?'}` : "—";

                return (
                  <button
                    key={p.personId}
                    className={`w-full cursor-pointer text-left rounded-[3px] px-3 py-2 transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${active ? "bg-slate-800/70 border-emerald-400/70" : "bg-slate-900/35 border-slate-600/80 hover:bg-slate-900/55 hover:border-slate-400/90"}`}
                    onClick={() => setSelectedPersonId(p.personId)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <SafeThumb url={firstNonEmpty(...p.reinados.map((r: any) => r?.["Imagen URL"]))} alt={`imagen de ${p.nombrePrincipal}`} />

                        <div className="min-w-0">
                          <div className="text-base font-extrabold leading-5 truncate text-emerald-200">{p.nombrePrincipal}</div>
                          <div className="text-sm text-slate-100/90 truncate">{p.dinastia || "—"}</div>
                          <div className="text-sm text-slate-100/90 truncate">{p.reinos.join(" · ") || "—"}</div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <VerifiedBadge verified={p.verifiedAll} />
                        <span className="inline-flex items-center rounded-[3px] px-2 py-1 text-sm font-semibold bg-slate-950 text-slate-100 border border-slate-700/70 cursor-default pointer-events-none select-none">
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

      <Card className="rounded-[3px] shadow-sm lg:col-span-8 bg-slate-900/30 border border-slate-800">
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <CardTitle className="text-3xl md:text-4xl font-extrabold leading-tight text-emerald-200">{selectedPerson?.reinados?.[0]?.Nombre ? String(selectedPerson.reinados[0].Nombre) : (selectedPerson?.nombrePrincipal || "sin selección")}</CardTitle>
                {selectedPerson ? <VerifiedBadge verified={selectedPerson.verifiedAll} showLabel={false} /> : null}
              </div>
              <CardDescription className="text-base text-slate-200">
                {selectedPerson?.reinados?.[0]?.Apelativo ? (
                  <span className="block text-2xl md:text-3xl font-bold text-slate-100">{String(selectedPerson.reinados[0].Apelativo)}</span>
                ) : null}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="icon"
                className="cursor-pointer rounded-[3px] bg-slate-950/30 border border-slate-700/70 text-slate-100 hover:bg-slate-900/60 hover:text-slate-100"
                title="editar personaje"
                aria-label="editar personaje"
                onClick={() => openPersonEditor(selectedPerson.personId)}
                disabled={!selectedPerson}
              >
                <Pencil className="h-5 w-5" />
              </Button>
              <Button
                variant="destructive"
                size="icon"
                className="cursor-pointer rounded-[3px] hover:bg-red-600"
                title="eliminar personaje"
                aria-label="eliminar personaje"
                onClick={() => {
                  setDeleteTarget({ kind: "person", id: selectedPerson.personId });
                  setDeleteOpen(true);
                }}
                disabled={!selectedPerson}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {!selectedPerson ? (
            <div className="text-sm text-slate-300">Seleccione un personaje en el listado.</div>
          ) : (
            <>
              {/* Ficha principal: imagen a la izquierda, datos a la derecha */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                <div className="md:col-span-5 space-y-3">
                  <SafeFigure url={selectedPerson.reinados[0]?.["Imagen URL"]} alt="imagen del personaje" />
                </div>

                <div className="md:col-span-7 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const rahUrl = normalizeUrl(selectedPerson.reinados[0]?.["Ficha RAH URL"]);
                      if (!rahUrl) return null;
                      return (
                        <a
                          className="inline-flex cursor-pointer items-center rounded-[3px] px-4 py-2 text-sm font-semibold bg-slate-950/30 border border-emerald-400/40 text-slate-50 hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                          title="abrir ficha en la real academia de la historia"
                          href={rahUrl}
                          target="_blank"
                          rel="noopener noreferrer">
                          <ShieldCheck className="h-4 w-4 mr-2" />
                          Ficha RAH
                        </a>
                      );
                    })()}

                    {selectedPerson.dinastia ? (
                      <Button
                        type="button"
                        variant={filterDinastia === String(selectedPerson.dinastia) ? "secondary" : "outline"}
                        className={
                          filterDinastia === String(selectedPerson.dinastia)
                            ? "cursor-pointer rounded-[3px] bg-emerald-400 text-slate-950 hover:bg-emerald-300 hover:text-slate-950"
                            : "cursor-pointer rounded-[3px] bg-slate-950/30 border border-slate-700/70 text-slate-100 hover:bg-slate-900/60 hover:text-slate-100"
                        }
                        title="conmutar filtro por dinastía"
                        onClick={() => {
                          const d = String(selectedPerson.dinastia);
                          if (filterDinastia === d) {
                            setFilterDinastia("__all__");
                            setFilterDinastiaLocked(false);
                          } else {
                            setFilterDinastia(d);
                            setFilterDinastiaLocked(true);
                          }
                        }}
                      >
                        {String(selectedPerson.dinastia)}
                      </Button>
                    ) : null}

                    {selectedCenturies.length ? (
                      <Button
                        type="button"
                        variant={selectedCenturies.includes(asNumberOrNull(filterSiglo)) ? "secondary" : "outline"}
                        className={
                          selectedCenturies.includes(asNumberOrNull(filterSiglo))
                            ? "cursor-pointer rounded-[3px] bg-emerald-400 text-slate-950 hover:bg-emerald-300 hover:text-slate-950"
                            : "cursor-pointer rounded-[3px] bg-slate-950/30 border border-slate-700/70 text-slate-100 hover:bg-slate-900/60 hover:text-slate-100"
                        }
                        title="conmutar filtro por siglo"
                        onClick={() => {
                          const active = selectedCenturies.includes(asNumberOrNull(filterSiglo));
                          if (active) {
                            setFilterSiglo("__all__");
                          } else {
                            setFilterSiglo(String(selectedCenturies[0]));
                          }
                        }}
                      >
                        {selectedCenturiesText}
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field
                      label="Nacimiento"
                      value={firstNonEmpty(
                        selectedPerson.reinados[0]?.["Nacimiento (Fecha)"],
                        selectedPerson.reinados[0]?.["Nacimiento (lugar)"],
                        selectedPerson.reinados[0]?.["Nacimiento (ciudad)"]
                      )}
                    />
                    <Field
                      label="Fallecimiento"
                      value={firstNonEmpty(
                        selectedPerson.reinados[0]?.["Fallecimiento (Fecha)"],
                        selectedPerson.reinados[0]?.["Fallecimiento (lugar)"],
                        selectedPerson.reinados[0]?.["Fallecimiento (ciudad)"]
                      )}
                    />

                    <Field label="Enterramiento" value={selectedPerson.reinados[0]?.Enterramiento} />
                    <Field label="Siglos" value={selectedCenturiesText} />

                    {selectedPerson.age !== null && (
                      <Field
                        label="Edad"
                        value={
                          (isApproxDate(selectedPerson.birthRaw) || isApproxDate(selectedPerson.deathRaw)
                            ? "~"
                            : "") + `${selectedPerson.age} años`
                        }
                      />
                    )}

                    <div className="space-y-1 md:col-span-2">
                      <div className="text-sm font-semibold text-slate-200">Reinos</div>
                      {selectedPerson.reinos?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedPerson.reinos.map((rk: string) => {
                            const color = reinoColor(rk);
                            const isActive = filterReino === rk;
                            return (
                              <Button
                                key={rk}
                                type="button"
                                variant={isActive ? "secondary" : "outline"}
                                className="cursor-pointer rounded-[3px] text-white hover:opacity-80"
                                style={{
                                  backgroundColor: isActive ? (color || "#34d399") : (color ? color + "cc" : "rgba(2,6,23,0.3)"),
                                  borderColor: color || "rgba(100,116,139,0.7)",
                                }}
                                title="conmutar filtro por reino"
                                onClick={() => setFilterReino((prev: any) => (prev === rk ? "__all__" : rk))}
                              >
                                {rk}
                              </Button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-base font-medium text-slate-50">—</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-lg font-bold text-slate-100">denominaciones por reino</div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(
                    new Map(
                      selectedPerson.reinados.map((r: any) => [
                        `${String(r?.Reino ?? "").trim()}::${rowDisplayName(r)}`,
                        { reino: String(r?.Reino ?? "").trim(), nombre: rowDisplayName(r) },
                      ])
                    ).values()
                  ).map((x: any, i) => (
                    <Badge key={`${x.reino}-${i}`} variant="secondary" className="rounded-[3px]">
                      {x.reino ? `${x.reino}: ${x.nombre}` : x.nombre}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-base font-semibold text-slate-200">descripción</div>
                <div className="text-base whitespace-pre-wrap text-slate-100">{selectedPerson.reinados[0]?.Descripción || "—"}</div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-base font-bold text-slate-100">gobiernos y periodos</div>
                </div>
                <div className="space-y-2">
                  {selectedPerson.reinados.map((r: any) => {
                    const inicioA = r?.["Inicio del reinado (año)"];
                    const finA = r?.["Final del reinado (año)"];
                    const duration = r?._duracionCalc;
                    const nroReinado = String(r?.["Nº Reinado"] ?? "").trim();
                    return (
                      <Card key={r._rowId} className="rounded-[3px] shadow-sm bg-slate-950/25 border border-slate-700/80">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium truncate text-slate-50">{String(r?.Reino || "(sin reino)")}</div>
                              <div className="text-sm font-bold text-emerald-200 truncate">{rowDisplayName(r)}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="inline-flex items-center rounded-[3px] px-2 py-1 text-sm font-semibold bg-slate-950 text-slate-100 border border-slate-700/70 cursor-default pointer-events-none select-none">
                                {inicioA || "—"}–{finA || "—"}
                              </span>
                              {typeof duration === "number" && Number.isFinite(duration) ? (
                                <span className="inline-flex items-center rounded-[3px] px-2 py-1 text-sm font-semibold bg-emerald-950 text-emerald-100 border border-emerald-500/30 cursor-default pointer-events-none select-none">
                                  {formatNumber(duration)} años
                                </span>
                              ) : null}

                              <Button
                                variant="outline"
                                size="icon"
                                className="cursor-pointer rounded-[3px] bg-slate-950/30 border border-slate-700/70 text-slate-100 hover:bg-slate-900/60 hover:text-slate-100"
                                title="editar gobierno"
                                aria-label="editar gobierno"
                                onClick={() => openRowEditor(r._rowId)}
                              >
                                <Pencil className="h-5 w-5" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                className="cursor-pointer rounded-[3px] hover:bg-red-600"
                                title="eliminar gobierno"
                                aria-label="eliminar gobierno"
                                onClick={() => {
                                  setDeleteTarget({ kind: "row", id: r._rowId });
                                  setDeleteOpen(true);
                                }}
                              >
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Field label="tipo de gobierno" value={r?.["Tipo de gobierno"]} />
                            {nroReinado ? <Field label="n.º reinado" value={nroReinado} /> : null}
                            <Field label="dinastía" value={r?.Dinastía} />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
