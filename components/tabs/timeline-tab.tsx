import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { asYearOrNull } from "../../lib/data";
import { useAppContext } from "../../context/AppContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";

// Generador de colores estables por cadena, con colores vibrantes
function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 45%)`; // HSL moderno y vibrante adaptado al tema oscuro
}

type TimelineItem = {
  personId: string | number;
  name: string;
  start: number;
  end: number;
  duration: number;
  reino: string;
  color: string;
};

// Empaqueta los items para que no colisionen verticalmente (algoritmo en carriles/lanes)
function packItems(items: TimelineItem[]) {
  const lanes: TimelineItem[][] = [];
  for (const item of items) {
    let placed = false;
    for (const lane of lanes) {
      // Check overlap (con un margen de gracia mínimo visual de 1 año)
      const overlap = lane.some(existing => !(item.end <= existing.start || item.start >= existing.end));
      if (!overlap) {
        lane.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([item]);
    }
  }
  return lanes;
}

export function TimelineTab() {
  const { people } = useAppContext();

  const timelineData = useMemo(() => {
    const rawItems: TimelineItem[] = [];

    let minYear = 9999;
    let maxYear = -9999;

    for (const p of people) {
      for (const r of p.reinados) {
        const yStart = asYearOrNull(r?.["Inicio del reinado (año)"]);
        let yEnd = asYearOrNull(r?.["Final del reinado (año)"]);
        if (yStart === null) continue;
        if (yEnd === null) yEnd = yStart + 1; // Fallback para los que siguen reinando o fecha desconocida
        if (yEnd < yStart) yEnd = yStart; // Corrigiendo discrepancias de parseo o data cruda

        if (yStart < minYear) minYear = yStart;
        if (yEnd > maxYear) maxYear = yEnd;

        const reino = String(r?.Reino || "Desconocido").trim();

        rawItems.push({
          personId: p.personId,
          name: p.nombrePrincipal,
          start: yStart,
          end: yEnd,
          duration: yEnd - yStart,
          reino,
          color: stringToColor(reino)
        });
      }
    }

    if (rawItems.length === 0) {
      return { packedByReino: {}, minYear: 0, maxYear: 0, totalYears: 0, rawItems: [] };
    }

    // Margen holgado a izquierda y derecha
    minYear -= (maxYear - minYear) * 0.05;
    maxYear += (maxYear - minYear) * 0.05;
    minYear = Math.floor(minYear);
    maxYear = Math.ceil(maxYear);
    const totalYears = maxYear - minYear;

    // Ordenamos cronológicamente
    rawItems.sort((a, b) => a.start - b.start);

    // Agrupamos por reino y calculamos los carriles (lanes) por reino
    const byReino: Record<string, TimelineItem[]> = {};
    rawItems.forEach(item => {
      if (!byReino[item.reino]) byReino[item.reino] = [];
      byReino[item.reino].push(item);
    });

    const packedByReino: Record<string, TimelineItem[][]> = {};
    for (const reino of Object.keys(byReino).sort()) {
      packedByReino[reino] = packItems(byReino[reino]);
    }

    return { packedByReino, minYear, maxYear, totalYears, rawItems };
  }, [people]);

  if (timelineData.rawItems.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-900/40 rounded-[3px] border border-slate-800">
        Sin datos cronológicos válidos para proyectar la línea temporal.
      </div>
    );
  }

  const { packedByReino, minYear, maxYear, totalYears } = timelineData;

  // Cálculo dinámico de la altura necesaria
  const TRACK_HEIGHT = 40; // Altura de cada carril dentro del reino
  const REINO_MARGIN = 50; // Margen superior para el nombre del reino
  let totalHeight = 40; // Eje de años
  
  const reinoOffsets: Record<string, number> = {};
  for (const [reino, lanesRaw] of Object.entries(packedByReino)) {
    const lanes = lanesRaw as TimelineItem[][];
    reinoOffsets[reino] = totalHeight + REINO_MARGIN;
    totalHeight += REINO_MARGIN + (lanes.length * TRACK_HEIGHT);
  }

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/30 border border-slate-800 rounded-[3px]">
        <CardHeader>
          <CardTitle className="text-xl text-slate-50 font-bold">Línea de Tiempo Dinámica</CardTitle>
          <CardDescription className="text-slate-300">
            Disposición cronológica de periodos de gobierno desde el año {minYear} al {maxYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-6 custom-scrollbar">
            {/* Lienzo virtual temporal */}
            <div className="min-w-[1200px] relative bg-slate-950/20 rounded-md border border-slate-800/60" style={{ height: `${totalHeight}px` }}>
              
              {/* Eje X (Líneas de fondo de tiempo) */}
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                {Array.from({ length: Math.ceil(totalYears / 50) + 1 }).map((_, i) => {
                  const year = Math.floor(minYear / 50) * 50 + i * 50;
                  if (year > maxYear) return null;
                  const leftPercentage = ((year - minYear) / totalYears) * 100;
                  return (
                    <div key={i} className="absolute h-full border-l border-slate-800/40" style={{ left: `${leftPercentage}%` }}>
                      <span className="absolute -top-6 -translate-x-1/2 bg-slate-950 px-2 text-xs font-semibold text-slate-400 rounded">
                        {year}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Trazado (Reinos y Carriles) */}
              {Object.entries(packedByReino).map(([reino, lanesRaw]) => {
                const lanes = lanesRaw as TimelineItem[][];
                const offsetTop = reinoOffsets[reino];
                return (
                  <div key={reino}>
                    {/* Etiqueta del reino */}
                    <div className="absolute w-full px-4 text-sm font-bold tracking-wide text-slate-100 uppercase sticky left-0 z-10" 
                         style={{ top: `${offsetTop - 30}px`, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                      {reino}
                    </div>

                    {/* Vías de Renderización (lanes) */}
                    {lanes.map((lane, laneIdx) => (
                      <div key={laneIdx} className="absolute left-0 w-full" style={{ top: `${offsetTop + laneIdx * TRACK_HEIGHT}px`, height: `${TRACK_HEIGHT}px` }}>
                        {lane.map((item, i) => {
                          const left = ((item.start - minYear) / totalYears) * 100;
                          const width = Math.max((item.duration / totalYears) * 100, 0.4); // Evitar divisores nulos invisibles

                          return (
                            <Link
                              key={`${item.personId}-${i}`}
                              to={`/fichas/${item.personId}`}
                              className="absolute top-1 bottom-1 rounded-[3px] bg-opacity-80 hover:bg-opacity-100 transition-all border border-slate-950 flex items-center shadow-sm hover:shadow-md hover:z-20 group overflow-hidden"
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                                backgroundColor: item.color,
                              }}
                            >
                              <span className="truncate w-full block text-center text-[11px] text-white font-semibold drop-shadow-md px-1 opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity">
                                {item.name}
                              </span>
                              
                              {/* Elemento superpuesto (Tooltip natural vía HTML title para hover sostenido) */}
                              <div className="absolute inset-0 z-30" title={`${item.name} (${item.start} - ${item.end})\n${reino}`} />
                            </Link>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })}
              
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
