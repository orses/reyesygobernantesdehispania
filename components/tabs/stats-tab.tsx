
import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { BarChart3, FilterX, Filter } from "lucide-react";
import { Button } from "../ui/button";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  LabelList,
} from "recharts";
import { formatNumber, formatCenturyLabel } from "../../lib/data";
import { useAppContext } from "../../context/AppContext";
import type { AgeEntry, CenturyEntry, CountEntry, DurationByEntityEntry, DurationEntry, Stats } from "../../lib/types";

type FilterKind = "reino" | "tipo" | "dinastia" | "siglo";
type ChartClickValue = string | number;
type DurationChartEntry = DurationEntry & { months?: number };
type ChartEntry = Partial<CountEntry & DurationByEntityEntry & DurationEntry & AgeEntry & CenturyEntry & { months: number }>;

interface AxisPayload {
  value?: unknown;
}

interface ClickableAxisTickProps {
  x?: string | number;
  y?: string | number;
  payload?: AxisPayload;
  data?: ChartEntry[];
  onClick?: (value: ChartClickValue) => void;
  maxLen?: number;
}

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  unit?: string;
}

interface StatsTabProps {
  globalStats: Stats;
  filteredStats: Stats;
  hasFilters: boolean;
  onPersonClick?: (personId: string) => void;
  onTabChange?: (tab: string) => void;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function getName(value: unknown): string {
  const record = asRecord(value);
  return typeof record?.name === "string" ? record.name : "";
}

function getPersonIdFromEntry(value: unknown): string | null {
  const record = asRecord(value);
  return typeof record?.personId === "string" ? record.personId : null;
}

function getCenturyFromEntry(value: unknown): number | null {
  const record = asRecord(value);
  return typeof record?.c === "number" ? record.c : null;
}

function getIsApproxFromTooltipPayload(value: unknown): boolean {
  const record = asRecord(value);
  const payload = asRecord(record?.payload);
  return payload?.isApprox === true;
}

function formatChartNumber(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? formatNumber(value) : String(value ?? "");
}

function ClickableAxisTick({ x, y, payload, data, onClick, maxLen = 25 }: ClickableAxisTickProps) {
  const raw = String(payload?.value ?? "");
  // Buscamos la entrada correspondiente. En el caso de siglos, comparamos con el label formateado.
  const entry = data?.find?.((d) => {
    if (d.label === raw || d.name === raw) return true;
    if (typeof d.c === 'number' && formatCenturyLabel(d.c) === raw) return true;
    return false;
  });

  const display = raw.length > maxLen ? raw.slice(0, maxLen - 1) + "…" : raw;
  const clickable = !!onClick;

  return (
    <text
      x={x} y={y}
      textAnchor="end"
      fill={clickable ? "#93c5fd" : "#e2e8f0"}
      fontSize={11}
      style={clickable ? { cursor: "pointer" } : undefined}
      onClick={() => {
        if (clickable) {
          // Si es un siglo, pasamos d.c (el número). Si no, personId o nombre.
          const val = entry?.c ?? entry?.personId ?? entry?.name ?? entry?.label ?? raw;
          onClick(val);
        }
      }}
    >
      {display}
    </text>
  );
}

function StatCard({ title, value, unit }: StatCardProps) {
  return (
    <Card className="rounded-[3px] shadow-sm bg-slate-900/30 border border-slate-800 flex flex-col justify-center min-h-[120px]">
      <CardContent className="p-6 flex flex-col justify-center h-full">
        <div className="text-sm font-semibold tracking-widest text-slate-400 uppercase mb-2">{title}</div>
        <div className="text-4xl md:text-5xl font-bold text-slate-50 leading-none">
          {value}
          {unit && <span className="text-lg md:text-xl font-normal text-slate-400 ml-2">{unit}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsTab({ globalStats, filteredStats, hasFilters, onPersonClick, onTabChange }: StatsTabProps) {
  const { setFilters, setSelectedPersonId } = useAppContext();
  const [viewMode, setViewMode] = useState<"filtered" | "global">("filtered");

  const handleFilterClick = (type: FilterKind, value: ChartClickValue) => {
    // Para que la ficha muestre el primer personaje de la categoría pulsada,
    // reseteamos la selección. El auto-selector de AppContext elegirá el más antiguo.
    setSelectedPersonId(null);
    setFilters(prev => ({
      ...prev,
      [type === 'reino' ? 'filterReino' : type === 'tipo' ? 'filterTipo' : type === 'dinastia' ? 'filterDinastia' : 'filterSiglo']: String(value),
    }));
    if (onTabChange) onTabChange("fichas");
  };

  const activeStats = hasFilters && viewMode === "filtered" ? filteredStats : globalStats;

  const shortestChart = useMemo(() => {
    const arr: DurationEntry[] = activeStats.topShortestReign || [];
    const maxYears = arr.length ? Math.max(...arr.map((d) => d.years)) : 0;
    const monthsMode = maxYears > 0 && maxYears < 1.25;
    const data: DurationChartEntry[] = monthsMode ? arr.map((d) => ({ ...d, months: d.years * 12 })) : arr;
    const maxMonths = monthsMode && data.length ? Math.max(...data.map((d) => d.months ?? 0)) : 0;
    return { monthsMode, data, maxYears, maxMonths };
  }, [activeStats.topShortestReign]);

  return (
    <div className="space-y-4">
      {hasFilters && (
        <div className="flex items-center justify-between rounded-[3px] border border-emerald-500/30 bg-emerald-950/20 p-3">
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-emerald-400" />
            <div className="text-sm text-slate-200">
              Hay filtros aplicados en la pestaña "Fichas".
              <span className="ml-1 font-semibold text-emerald-200">
                {viewMode === "filtered" ? "Mostrando datos filtrados." : "Mostrando datos globales."}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === "filtered" ? "global" : "filtered")}
            className="h-8 rounded-[3px] border-emerald-500/40 hover:bg-emerald-950/40 text-emerald-100"
          >
            {viewMode === "filtered" ? (
              <>
                <FilterX className="mr-2 h-4 w-4" /> ver globales
              </>
            ) : (
              <>
                <Filter className="mr-2 h-4 w-4" /> ver filtrados
              </>
            )}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="personajes" value={activeStats.totalMonarcas} />
        <StatCard title="gobiernos" value={activeStats.totalFilas} />
        <StatCard title="verificados" value={activeStats.verifiedMonarcas} />
        <StatCard
          title="duración media"
          value={activeStats.mean === null ? "—" : formatNumber(activeStats.mean)}
          unit="años"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">

        {/* Entidades - Ahora en la misma fila */}
        <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="rounded-[3px] shadow-sm bg-slate-900/30 border border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-50">
                <BarChart3 className="h-4 w-4" />entidades de gobierno (frecuencia)
              </CardTitle>
              <CardDescription className="text-base text-slate-200">frecuencia global de entidades políticas (reinos, condados...)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4" style={{ height: Math.max(400, (activeStats.byEntity || []).length * 35) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeStats.byEntity || []} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      domain={[0, "dataMax"]}
                      tick={{ fill: "#e2e8f0", fontSize: 11 }}
                      axisLine={{ stroke: "#475569" }}
                      tickLine={{ stroke: "#475569" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={180}
                      interval={0}
                      tick={<ClickableAxisTick data={activeStats.byEntity || []} onClick={(value) => handleFilterClick('reino', value)} />}
                      axisLine={{ stroke: "#475569" }}
                      tickLine={{ stroke: "#475569" }}
                    />
                    <Tooltip
                      formatter={(value) => [value, "frecuencia"]}
                      contentStyle={{
                        backgroundColor: "rgba(2, 6, 23, 0.96)",
                        border: "1px solid rgba(148, 163, 184, 0.35)",
                        borderRadius: "3px",
                        color: "#e2e8f0",
                      }}
                      labelStyle={{ color: "#e2e8f0" }}
                      itemStyle={{ color: "#e2e8f0" }}
                    />
                    <Bar dataKey="count" fill="#93c5fd" radius={3} style={{ cursor: "pointer" }} onClick={(entry: unknown) => handleFilterClick('reino', getName(entry))}>
                      <LabelList dataKey="count" position="insideRight" fill="#0f172a" fontSize={10} fontWeight={700} />
                    </Bar>

                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Entidades por Duración (Global) - Alto - Full Width */}
          <Card className="rounded-[3px] shadow-sm bg-slate-900/30 border border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-50">
                <BarChart3 className="h-4 w-4" />entidades de gobierno (duración acumulada)
              </CardTitle>
              <CardDescription className="text-base text-slate-200">suma total de años gobernados por entidad</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4" style={{ height: Math.max(400, (activeStats.byEntityDuration || []).length * 35) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeStats.byEntityDuration || []} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      domain={[0, "dataMax"]}
                      tick={{ fill: "#e2e8f0", fontSize: 11 }}
                      axisLine={{ stroke: "#475569" }}
                      tickLine={{ stroke: "#475569" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={180}
                      interval={0}
                      tick={<ClickableAxisTick data={activeStats.byEntityDuration || []} onClick={(value) => handleFilterClick('reino', value)} />}
                      axisLine={{ stroke: "#475569" }}
                      tickLine={{ stroke: "#475569" }}
                    />
                    <Tooltip
                      formatter={(value: unknown) => [`${formatChartNumber(value)} años`, "duración total"]}
                      contentStyle={{
                        backgroundColor: "rgba(2, 6, 23, 0.96)",
                        border: "1px solid rgba(148, 163, 184, 0.35)",
                        borderRadius: "3px",
                        color: "#e2e8f0",
                      }}
                      labelStyle={{ color: "#e2e8f0" }}
                      itemStyle={{ color: "#e2e8f0" }}
                    />
                    <Bar dataKey="years" fill="#a5b4fc" radius={3} style={{ cursor: "pointer" }} onClick={(entry: unknown) => handleFilterClick('reino', getName(entry))}>
                      <LabelList dataKey="years" position="insideRight" fill="#0f172a" fontSize={10} fontWeight={700} formatter={(value: unknown) => formatChartNumber(value)} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gobiernos por Tipo y Dinastías */}
        <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-4 mt-0">
          <Card className="rounded-[3px] shadow-sm bg-slate-900/30 border border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-50">
                <BarChart3 className="h-4 w-4" />gobiernos por tipo
              </CardTitle>
              <CardDescription className="text-base text-slate-200">conteo por tipo de gobierno</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4" style={{ height: Math.max(300, (activeStats.byTipoGobierno || []).length * 30) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeStats.byTipoGobierno || []} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      domain={[0, "dataMax"]}
                      tick={{ fill: "#e2e8f0", fontSize: 11 }}
                      axisLine={{ stroke: "#475569" }}
                      tickLine={{ stroke: "#475569" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      interval={0}
                      tick={<ClickableAxisTick data={activeStats.byTipoGobierno || []} onClick={(value) => handleFilterClick('tipo', value)} maxLen={15} />}
                      axisLine={{ stroke: "#475569" }}
                      tickLine={{ stroke: "#475569" }}
                    />
                    <Tooltip
                      formatter={(value) => [value, "gobiernos"]}
                      contentStyle={{
                        backgroundColor: "rgba(2, 6, 23, 0.96)",
                        border: "1px solid rgba(148, 163, 184, 0.35)",
                        borderRadius: "3px",
                        color: "#e2e8f0",
                      }}
                      labelStyle={{ color: "#e2e8f0" }}
                      itemStyle={{ color: "#e2e8f0" }}
                    />
                    <Bar dataKey="count" fill="#6ee7b7" radius={3} style={{ cursor: "pointer" }} onClick={(entry: unknown) => handleFilterClick('tipo', getName(entry))}>
                      <LabelList dataKey="count" position="insideRight" fill="#0f172a" fontSize={10} fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[3px] shadow-sm bg-slate-900/30 border border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-50">
                <BarChart3 className="h-4 w-4" />dinastías
              </CardTitle>
              <CardDescription className="text-base text-slate-200">gobernantes por dinastía</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4" style={{ height: Math.max(300, (activeStats.byDinastia || []).length * 30) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeStats.byDinastia || []} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      domain={[0, "dataMax"]}
                      tick={{ fill: "#e2e8f0", fontSize: 11 }}
                      axisLine={{ stroke: "#475569" }}
                      tickLine={{ stroke: "#475569" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={180}
                      interval={0}
                      tick={<ClickableAxisTick data={activeStats.byDinastia || []} onClick={(value) => handleFilterClick('dinastia', value)} />}
                      axisLine={{ stroke: "#475569" }}
                      tickLine={{ stroke: "#475569" }}
                    />
                    <Tooltip
                      formatter={(value) => [value, "gobernantes"]}
                      contentStyle={{
                        backgroundColor: "rgba(2, 6, 23, 0.96)",
                        border: "1px solid rgba(148, 163, 184, 0.35)",
                        borderRadius: "3px",
                        color: "#e2e8f0",
                      }}
                      labelStyle={{ color: "#000000" }}
                      itemStyle={{ color: "#e2e8f0" }}
                    />
                    <Bar dataKey="count" fill="#fcd34d" radius={3} style={{ cursor: "pointer" }} onClick={(entry: unknown) => handleFilterClick('dinastia', getName(entry))}>
                      <LabelList dataKey="count" position="insideRight" fill="#0f172a" fontSize={10} fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pareja: Duración Gobierno (Longevos vs Breves) */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-[3px] shadow-sm bg-slate-900/30 border border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-50">
                <BarChart3 className="h-4 w-4" />más longevos (gobierno)
              </CardTitle>
              <CardDescription className="text-base text-slate-200">top 10 por duración de reinado</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeStats.topLongestReign || []} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" allowDecimals={false} domain={[0, "dataMax"]} tick={{ fill: "#e2e8f0", fontSize: 11 }} axisLine={{ stroke: "#475569" }} tickLine={{ stroke: "#475569" }} />
                    <YAxis type="category" dataKey="label" width={180} tick={<ClickableAxisTick data={activeStats.topLongestReign || []} onClick={onPersonClick ? (value) => onPersonClick(String(value)) : undefined} />} axisLine={{ stroke: "#475569" }} tickLine={{ stroke: "#475569" }} />
                    <Tooltip
                      formatter={(value: unknown) => [typeof value === "number" ? `${formatNumber(value)} años` : String(value ?? ""), "duración"]}
                      contentStyle={{ backgroundColor: "rgba(2, 6, 23, 0.96)", border: "1px solid rgba(148, 163, 184, 0.35)", borderRadius: "3px", color: "#e2e8f0" }}
                      labelStyle={{ color: "#e2e8f0" }} itemStyle={{ color: "#e2e8f0" }}
                    />
                    <Bar dataKey="years" fill="#6ee7b7" radius={3} style={{ cursor: onPersonClick ? "pointer" : undefined }} onClick={(entry: unknown) => { const personId = getPersonIdFromEntry(entry); if (onPersonClick && personId) onPersonClick(personId); }}>
                      <LabelList dataKey="years" position="insideRight" fill="#0f172a" fontSize={10} fontWeight={700} formatter={(value: unknown) => formatChartNumber(value)} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[3px] shadow-sm bg-slate-900/30 border border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-50">
                <BarChart3 className="h-4 w-4" />menos longevos (gobierno)
              </CardTitle>
              <CardDescription className="text-base text-slate-200">
                {shortestChart.monthsMode ? "top 10 por duración (meses)" : "top 10 por duración (años)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shortestChart.data || []} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" allowDecimals={shortestChart.monthsMode} domain={shortestChart.monthsMode ? [0, Math.max(14, Math.ceil(shortestChart.maxMonths))] : [0, "dataMax"]} tick={{ fill: "#e2e8f0", fontSize: 11 }} axisLine={{ stroke: "#475569" }} tickLine={{ stroke: "#475569" }} />
                    <YAxis type="category" dataKey="label" width={180} tick={<ClickableAxisTick data={shortestChart.data || []} onClick={onPersonClick ? (value) => onPersonClick(String(value)) : undefined} />} axisLine={{ stroke: "#475569" }} tickLine={{ stroke: "#475569" }} />
                    <Tooltip
                      formatter={(value: unknown) => {
                        const n = typeof value === "number" && Number.isFinite(value) ? value : null;
                        if (n === null) return [String(value ?? ""), "duración"];
                        return shortestChart.monthsMode ? [`${formatNumber(n)} meses`, "duración"] : [`${formatNumber(n)} años`, "duración"];
                      }}
                      contentStyle={{ backgroundColor: "rgba(2, 6, 23, 0.96)", border: "1px solid rgba(148, 163, 184, 0.35)", borderRadius: "3px", color: "#e2e8f0" }}
                      labelStyle={{ color: "#e2e8f0" }} itemStyle={{ color: "#e2e8f0" }}
                    />
                    <Bar dataKey={shortestChart.monthsMode ? "months" : "years"} fill="#6ee7b7" radius={3} style={{ cursor: onPersonClick ? "pointer" : undefined }} onClick={(entry: unknown) => { const personId = getPersonIdFromEntry(entry); if (onPersonClick && personId) onPersonClick(personId); }}>
                      <LabelList dataKey={shortestChart.monthsMode ? "months" : "years"} position="insideRight" fill="#0f172a" fontSize={10} fontWeight={700} formatter={(value: unknown) => shortestChart.monthsMode ? `${formatChartNumber(value)} m` : formatChartNumber(value)} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pareja: Edad (Más edad vs Menos edad) */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-[3px] shadow-sm bg-slate-900/30 border border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-50">
                <BarChart3 className="h-4 w-4" />más longevos (edad al morir)
              </CardTitle>
              <CardDescription className="text-base text-slate-200">top 10 por edad (nacimiento - fallecimiento)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeStats.topOldestMonarch || []} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" allowDecimals={false} domain={[0, "dataMax"]} tick={{ fill: "#e2e8f0", fontSize: 11 }} axisLine={{ stroke: "#475569" }} tickLine={{ stroke: "#475569" }} />
                    <YAxis type="category" dataKey="label" width={180} tick={<ClickableAxisTick data={activeStats.topOldestMonarch || []} onClick={onPersonClick ? (value) => onPersonClick(String(value)) : undefined} />} axisLine={{ stroke: "#475569" }} tickLine={{ stroke: "#475569" }} />
                    <Tooltip
                      formatter={(value: unknown, _name: unknown, props: unknown) => [
                        `${getIsApproxFromTooltipPayload(props) ? "~" : ""}${value} años`,
                        "edad"
                      ]}
                      contentStyle={{ backgroundColor: "rgba(2, 6, 23, 0.96)", border: "1px solid rgba(148, 163, 184, 0.35)", borderRadius: "3px", color: "#e2e8f0" }}
                      labelStyle={{ color: "#e2e8f0" }} itemStyle={{ color: "#e2e8f0" }}
                    />
                    <Bar dataKey="age" fill="#f9a8d4" radius={3} style={{ cursor: onPersonClick ? "pointer" : undefined }} onClick={(entry: unknown) => { const personId = getPersonIdFromEntry(entry); if (onPersonClick && personId) onPersonClick(personId); }}>
                      <LabelList dataKey="age" position="insideRight" fill="#0f172a" fontSize={10} fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[3px] shadow-sm bg-slate-900/30 border border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-50">
                <BarChart3 className="h-4 w-4" />más jóvenes (edad al morir)
              </CardTitle>
              <CardDescription className="text-base text-slate-200">top 10 por edad (nacimiento - fallecimiento)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeStats.topYoungestMonarch || []} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" allowDecimals={false} domain={[0, "dataMax"]} tick={{ fill: "#e2e8f0", fontSize: 11 }} axisLine={{ stroke: "#475569" }} tickLine={{ stroke: "#475569" }} />
                    <YAxis type="category" dataKey="label" width={180} tick={<ClickableAxisTick data={activeStats.topYoungestMonarch || []} onClick={onPersonClick ? (value) => onPersonClick(String(value)) : undefined} />} axisLine={{ stroke: "#475569" }} tickLine={{ stroke: "#475569" }} />
                    <Tooltip
                      formatter={(value: unknown, _name: unknown, props: unknown) => [
                        `${getIsApproxFromTooltipPayload(props) ? "~" : ""}${value} años`,
                        "edad"
                      ]}
                      contentStyle={{ backgroundColor: "rgba(2, 6, 23, 0.96)", border: "1px solid rgba(148, 163, 184, 0.35)", borderRadius: "3px", color: "#e2e8f0" }}
                      labelStyle={{ color: "#e2e8f0" }} itemStyle={{ color: "#e2e8f0" }}
                    />
                    <Bar dataKey="age" fill="#f9a8d4" radius={3} style={{ cursor: onPersonClick ? "pointer" : undefined }} onClick={(entry: unknown) => { const personId = getPersonIdFromEntry(entry); if (onPersonClick && personId) onPersonClick(personId); }}>
                      <LabelList dataKey="age" position="insideRight" fill="#0f172a" fontSize={10} fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* personajes por siglo */}
        <Card className="rounded-[3px] shadow-sm lg:col-span-12 bg-slate-900/30 border border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-50">
              <BarChart3 className="h-4 w-4" />personajes por siglo
            </CardTitle>
            <CardDescription className="text-base text-slate-200">inicio de gobierno (año) — desde el siglo VIII</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activeStats.perCentury || []} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="c"
                  type="number"
                  allowDecimals={false}
                  domain={[8, 21]}
                  allowDataOverflow
                  tickFormatter={(v) => formatCenturyLabel(v)}
                  tick={<ClickableAxisTick data={activeStats.perCentury || []} onClick={(value) => handleFilterClick('siglo', value)} />}
                  axisLine={{ stroke: "#475569" }}
                  tickLine={{ stroke: "#475569" }}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, "dataMax"]}
                  tick={{ fill: "#e2e8f0", fontSize: 11 }}
                  axisLine={{ stroke: "#475569" }}
                  tickLine={{ stroke: "#475569" }}
                />
                <Tooltip
                  formatter={(value) => [value, "personajes"]}
                  labelFormatter={(label) => formatCenturyLabel(label)}
                  contentStyle={{
                    backgroundColor: "rgba(2, 6, 23, 0.96)",
                    border: "1px solid rgba(148, 163, 184, 0.35)",
                    borderRadius: "3px",
                    color: "#e2e8f0",
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                  itemStyle={{ color: "#e2e8f0" }}
                />
                <Line type="monotone" dataKey="count" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4, fill: "#60a5fa" }} style={{ cursor: "pointer" }} onClick={(entry: unknown) => { const century = getCenturyFromEntry(entry); if (century !== null) handleFilterClick('siglo', century); }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
