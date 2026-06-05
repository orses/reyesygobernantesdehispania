import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Search, X, UserPlus, Scale } from "lucide-react";
import { VerifiedBadge } from "../ui/verified-badge";
import { formatNumber, normalizeUrl } from "../../lib/data";
import { getPrimaryMediaAsset } from "../../lib/media";
import { personMatchesSearch } from "../../lib/people";
import type { MediaAsset, Person } from "../../lib/types";
import { Input } from "../ui/input";

function mediaSrc(asset: MediaAsset | null, previewUrls: Record<string, string>): string {
  if (!asset) return "";
  if (asset.kind === "uploaded-file") return previewUrls[asset.id] ?? "";
  return normalizeUrl(asset.src);
}

function ComparePortrait({ asset, previewUrls, name }: { asset: MediaAsset | null; previewUrls: Record<string, string>; name: string }) {
  const imageUrl = mediaSrc(asset, previewUrls);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    setOk(true);
  }, [imageUrl]);

  if (!imageUrl || !ok) {
    return <span className="text-xl font-medium text-slate-600">{name.charAt(0)}</span>;
  }

  return (
    <img
      src={imageUrl}
      alt={`imagen de ${name}`}
      className="h-full w-full object-cover"
      loading="lazy"
      onError={() => setOk(false)}
    />
  );
}

export function ComparativaTab({
  mediaAssets = [],
  mediaPreviewUrls = {},
}: {
  mediaAssets?: MediaAsset[];
  mediaPreviewUrls?: Record<string, string>;
}) {
  const { allPeople } = useAppContext();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement | null>(null);
  
  const sortedNames = useMemo(
    () => [...allPeople].sort((a, b) => a.nombrePrincipal.localeCompare(b.nombrePrincipal, 'es')),
    [allPeople]
  );

  const searchablePeople = useMemo(() => {
    return sortedNames
      .filter((person) => !selectedIds.includes(String(person.personId)))
      .filter((person) => personMatchesSearch(person, searchText))
      .slice(0, 30);
  }, [searchText, selectedIds, sortedNames]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchText, selectedIds]);

  const handleSelect = (val: string) => {
    if (!val || selectedIds.includes(val)) return;
    setSelectedIds(prev => [...prev, val]);
    setSearchText("");
    setSearchOpen(false);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSearchOpen(true);
      setHighlightedIndex((current) => Math.min(current + 1, Math.max(0, searchablePeople.length - 1)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(0, current - 1));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const person = searchablePeople[highlightedIndex];
      if (person) handleSelect(String(person.personId));
      return;
    }

    if (event.key === "Escape") {
      setSearchOpen(false);
    }
  };

  const removeId = (id: string) => {
    setSelectedIds(prev => prev.filter(x => x !== id));
  };

  const clearAll = () => {
    setSelectedIds([]);
  };

  const selectedPeople = useMemo(
    () => selectedIds
      .map(id => allPeople.find(p => String(p.personId) === String(id)))
      .filter((p): p is Person => p !== undefined),
    [allPeople, selectedIds]
  );

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/30 border border-slate-800 rounded-[3px]">
        <CardHeader className="border-b border-slate-800 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-xl text-slate-50 flex items-center gap-2">
                <Scale className="h-6 w-6 text-emerald-300" /> Análisis comparativo
              </CardTitle>
              <CardDescription className="text-slate-300 mt-1">
                Seleccione múltiples figuras históricas para contrastar su esperanza de vida, tiempo en el poder y soporte documental.
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <div ref={searchRef} className="relative w-full sm:w-[360px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={searchText}
                  onChange={(event) => {
                    setSearchText(event.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                  className="h-10 rounded-[3px] border-slate-700 bg-slate-950 pl-9 text-slate-100 placeholder:text-slate-500"
                  placeholder="Buscar monarca para comparar..."
                  role="combobox"
                  aria-expanded={searchOpen}
                  aria-controls="compare-person-search-results"
                  aria-autocomplete="list"
                />
                {searchOpen && (
                  <div
                    id="compare-person-search-results"
                    className="absolute z-50 mt-1 max-h-[320px] w-full overflow-auto rounded-[3px] border border-slate-700 bg-slate-950 p-1 text-slate-50 shadow-xl custom-scrollbar"
                    role="listbox"
                  >
                    {searchablePeople.length > 0 ? (
                      searchablePeople.map((person, index) => (
                        <button
                          key={String(person.personId)}
                          type="button"
                          role="option"
                          aria-selected={index === highlightedIndex}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          onClick={() => handleSelect(String(person.personId))}
                          className={`block w-full rounded-[3px] px-3 py-2 text-left text-sm ${
                            index === highlightedIndex
                              ? "bg-slate-800 text-slate-50"
                              : "text-slate-100 hover:bg-slate-800 hover:text-slate-50"
                          }`}
                        >
                          <span className="block truncate">{person.nombrePrincipal}</span>
                          {person.apelativos.length > 0 && (
                            <span className="mt-0.5 block truncate text-xs text-slate-400">
                              {person.apelativos.join(", ")}
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-slate-400">
                        Sin resultados disponibles.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button 
                variant="outline" 
                onClick={clearAll} 
                disabled={selectedIds.length === 0}
                className="w-full bg-slate-950 border-slate-700/70 text-slate-300 hover:text-white sm:w-auto"
              >
                Limpiar visualización
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {selectedPeople.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-md bg-slate-900/10">
              <UserPlus className="h-10 w-10 text-slate-600 mb-3" />
              <p className="text-slate-400 font-medium text-lg">Inicie la comparativa</p>
              <p className="text-slate-500 text-sm mt-1">Utilice el selector superior para añadir perfiles.</p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-4 custom-scrollbar">
              <div className="flex min-w-max gap-4">
                {selectedPeople.map(p => {
                  
                  const durationGobierno = p.reinados.reduce((s, r) => s + (typeof r._duracionCalc === 'number' ? r._duracionCalc : 0), 0);
                  const activeYears = p.reinados.map(r => r["Inicio del reinado (año)"]).filter(Boolean).join(", ");
                  
                  return (
                    <div key={p.personId} className="w-[min(82vw,340px)] flex-shrink-0 flex flex-col bg-slate-950/60 border border-slate-800 rounded-md overflow-hidden relative">
                      <Button 
                        title="Quitar de comparativa"
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-1 top-1 h-6 w-6 rounded-full text-slate-400 hover:text-rose-400 hover:bg-slate-800 z-10"
                        onClick={() => removeId(String(p.personId))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      
                      {/* Portada mini */}
                      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                          <ComparePortrait asset={getPrimaryMediaAsset(mediaAssets, p.personId)} previewUrls={mediaPreviewUrls} name={p.nombrePrincipal} />
                        </div>
                        <div className="min-w-0 flex-1 pr-6">
                          <div className="flex min-w-0 items-start gap-2">
                            <h3 className="min-w-0 font-medium leading-tight text-slate-100">{p.nombrePrincipal}</h3>
                            <VerifiedBadge verified={p.verifiedAll} />
                          </div>
                          {p.apelativos.length > 0 && <p className="text-xs text-slate-400 mt-1 italic pr-6">{p.apelativos.join(', ')}</p>}
                        </div>
                      </div>

                      {/* Estadísticas */}
                      <div className="p-4 space-y-4 flex-grow text-sm">
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="bg-slate-900 p-2 rounded border border-slate-800/60">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Edad de Vida</p>
                            <p className="font-medium text-lg text-rose-300">{p.age !== null ? `${p.age} años` : '?'}</p>
                          </div>
                          <div className="bg-slate-900 p-2 rounded border border-slate-800/60">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Años en el Poder</p>
                            <p className="font-medium text-lg text-emerald-300">{formatNumber(durationGobierno)}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[11px] text-slate-500 tracking-wider uppercase border-b border-slate-800 pb-1 mb-2">Cronología</p>
                          <p className="text-slate-300"><span className="text-slate-400">Nacimiento:</span> {p.birthRaw || 'Desconocido'}</p>
                          <p className="text-slate-300 mt-1"><span className="text-slate-400">Fallecimiento:</span> {p.deathRaw || 'Desconocido'}</p>
                        </div>
                        
                        <div>
                          <p className="text-[11px] text-slate-500 tracking-wider uppercase border-b border-slate-800 pb-1 mb-2">Gobierno ({p.reinados.length})</p>
                          <p className="text-slate-300"><span className="text-slate-400">Dinastía:</span> {p.dinastia || 'Ninguna'}</p>
                          <p className="text-slate-300 mt-1"><span className="text-slate-400">Reinos:</span> {p.reinos.join(', ')}</p>
                          <p className="text-slate-300 mt-1"><span className="text-slate-400">Inicio mandatos:</span> {activeYears || '-'}</p>
                        </div>

                        {p.reinados[0]?.["Ficha RAH URL"] && (
                          <div>
                            <p className="text-[11px] text-slate-500 tracking-wider uppercase border-b border-slate-800 pb-1 mb-2">Soporte biográfico</p>
                            <p className="text-slate-300 mt-1"><a href={String(p.reinados[0]["Ficha RAH URL"])} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Ficha Real Academia</a></p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
