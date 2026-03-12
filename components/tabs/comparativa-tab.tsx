import React, { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";
import { X, UserPlus, Scale } from "lucide-react";
import { formatNumber } from "../../lib/data";
import { Person } from "../../lib/types";

export function ComparativaTab() {
  const { allPeople } = useAppContext();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const handleSelect = (val: string) => {
    if (val && !selectedIds.includes(val)) {
      setSelectedIds(prev => [...prev, val]);
    }
  };

  const removeId = (id: string) => {
    setSelectedIds(prev => prev.filter(x => x !== id));
  };

  const clearAll = () => {
    setSelectedIds([]);
  };

  // Nombres ordenados para el dropdown
  const sortedNames = [...allPeople].sort((a, b) => a.nombrePrincipal.localeCompare(b.nombrePrincipal, 'es'));
  
  const selectedPeople = selectedIds
    .map(id => allPeople.find(p => String(p.personId) === String(id)))
    .filter((p): p is Person => p !== undefined);

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/30 border border-slate-800 rounded-[3px]">
        <CardHeader className="pb-4 border-b border-slate-800">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl text-slate-50 flex items-center gap-2">
                <Scale className="h-5 w-5" /> Análisis Comparativo (Cara a Cara)
              </CardTitle>
              <CardDescription className="text-slate-300 mt-1">
                Seleccione múltiples figuras históricas para contrastar su esperanza de vida, tiempo en el poder y verificabilidad.
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="w-[280px]">
                <Select onValueChange={handleSelect} value="">
                  <SelectTrigger className="w-full bg-slate-950 border-slate-700 text-slate-200">
                    <SelectValue placeholder=" Añadir monarca a comparar..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {sortedNames.map(p => (
                      <SelectItem 
                        key={String(p.personId)} 
                        value={String(p.personId)}
                        disabled={selectedIds.includes(String(p.personId))}
                      >
                        {p.nombrePrincipal} {p.apelativos.length > 0 ? `(${p.apelativos.join(', ')})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                variant="outline" 
                onClick={clearAll} 
                disabled={selectedIds.length === 0}
                className="bg-slate-950 border-slate-700/70 text-slate-300 hover:text-white"
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
              <div className="flex gap-4 min-w-max">
                {selectedPeople.map(p => {
                  
                  const durationGobierno = p.reinados.reduce((s, r) => s + (typeof r._duracionCalc === 'number' ? r._duracionCalc : 0), 0);
                  const activeYears = p.reinados.map(r => r["Inicio del reinado (año)"]).filter(Boolean).join(", ");
                  
                  return (
                    <div key={p.personId} className="w-[300px] flex-shrink-0 flex flex-col bg-slate-950/60 border border-slate-800 rounded-md overflow-hidden relative">
                      <Button 
                        title="Quitar de comparativa"
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-1 top-1 h-6 w-6 rounded-full text-slate-400 hover:text-rose-400 hover:bg-slate-800 z-10"
                        onClick={() => removeId(String(p.personId))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      
                      {/* Portada Mini */}
                      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {p.reinados[0]?.["Imagen URL"] ? (
                            <img src={String(p.reinados[0]["Imagen URL"])} alt={p.nombrePrincipal} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xl font-bold text-slate-600">{p.nombrePrincipal.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-100 leading-tight pr-6">{p.nombrePrincipal}</h3>
                          {p.apelativos.length > 0 && <p className="text-xs text-slate-400 mt-1 italic pr-6">{p.apelativos.join(', ')}</p>}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="p-4 space-y-4 flex-grow text-sm">
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="bg-slate-900 p-2 rounded border border-slate-800/60">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Edad de Vida</p>
                            <p className="font-bold text-lg text-rose-300">{p.age !== null ? `${p.age} años` : '?'}</p>
                          </div>
                          <div className="bg-slate-900 p-2 rounded border border-slate-800/60">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Años en el Poder</p>
                            <p className="font-bold text-lg text-emerald-300">{formatNumber(durationGobierno)}</p>
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

                        <div>
                          <p className="text-[11px] text-slate-500 tracking-wider uppercase border-b border-slate-800 pb-1 mb-2">Soporte Biográfico</p>
                           <p className="text-slate-300 flex justify-between">
                            <span className="text-slate-400">Verificado Wikipedia:</span> 
                            {p.verifiedAll ? <span className="text-emerald-400">Sí</span> : <span className="text-rose-400">No</span>}
                           </p>
                           {p.reinados[0]?.["Ficha RAH URL"] && (
                             <p className="text-slate-300 mt-1"><a href={String(p.reinados[0]["Ficha RAH URL"])} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Ficha Real Academia</a></p>
                           )}
                        </div>
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
