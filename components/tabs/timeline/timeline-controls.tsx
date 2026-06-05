import { AlertTriangle, Filter, GitBranch, Globe2, Landmark, Layers3, UserRound, Users } from "lucide-react";
import { Button } from "../../ui/button";
import { cn } from "../../../lib/utils";
import type { TimelineGroupMode, TimelineScope, TimelineStats, TimelineViewMode } from "../../../lib/timeline";

interface TimelineControlsProps {
  groupMode: TimelineGroupMode;
  scope: TimelineScope;
  viewMode: TimelineViewMode;
  stats: TimelineStats;
  hasFilters: boolean;
  hasSelectedPerson: boolean;
  selectedPersonName: string;
  onGroupModeChange: (value: TimelineGroupMode) => void;
  onScopeChange: (value: TimelineScope) => void;
  onViewModeChange: (value: TimelineViewMode) => void;
}

interface SegmentedButtonProps<T extends string> {
  active: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  value: T;
  onChange: (value: T) => void;
}

function SegmentedButton<T extends string>({
  active,
  disabled,
  icon,
  label,
  value,
  onChange,
}: SegmentedButtonProps<T>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={() => onChange(value)}
      className={cn(
        "h-8 min-w-0 flex-1 rounded-[3px] border px-2 text-xs sm:flex-none sm:px-2.5",
        active
          ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
          : "border-slate-700 bg-slate-950/40 text-slate-300 hover:bg-slate-800 hover:text-slate-50"
      )}
      aria-pressed={active}
    >
      <span className="mr-1.5 shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </Button>
  );
}

export function TimelineControls({
  groupMode,
  scope,
  viewMode,
  stats,
  hasFilters,
  hasSelectedPerson,
  selectedPersonName,
  onGroupModeChange,
  onScopeChange,
  onViewModeChange,
}: TimelineControlsProps) {
  return (
    <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
      <div className="flex min-w-0 flex-wrap gap-4">
        <div className="space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-widest text-slate-400">Agrupación</div>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            <SegmentedButton
              active={groupMode === "kingdom"}
              icon={<Landmark className="h-4 w-4" />}
              label="Reino"
              value="kingdom"
              onChange={onGroupModeChange}
            />
            <SegmentedButton
              active={groupMode === "dynasty"}
              icon={<Layers3 className="h-4 w-4" />}
              label="Dinastía"
              value="dynasty"
              onChange={onGroupModeChange}
            />
            <SegmentedButton
              active={groupMode === "century"}
              icon={<Globe2 className="h-4 w-4" />}
              label="Siglo"
              value="century"
              onChange={onGroupModeChange}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-widest text-slate-400">Alcance</div>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            <SegmentedButton
              active={scope === "filtered"}
              icon={<Filter className="h-4 w-4" />}
              label={hasFilters ? "Filtros activos" : "Filtros de fichas"}
              value="filtered"
              onChange={onScopeChange}
            />
            <SegmentedButton
              active={scope === "global"}
              icon={<Globe2 className="h-4 w-4" />}
              label="Global"
              value="global"
              onChange={onScopeChange}
            />
            <SegmentedButton
              active={scope === "selected"}
              disabled={!hasSelectedPerson}
              icon={<UserRound className="h-4 w-4" />}
              label="Selección"
              value="selected"
              onChange={onScopeChange}
            />
          </div>
          {scope === "selected" && selectedPersonName && (
            <div className="truncate text-xs text-slate-400">{selectedPersonName}</div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-widest text-slate-400">Lectura</div>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            <SegmentedButton
              active={viewMode === "periods"}
              icon={<Landmark className="h-4 w-4" />}
              label="Periodos"
              value="periods"
              onChange={onViewModeChange}
            />
            <SegmentedButton
              active={viewMode === "succession"}
              icon={<GitBranch className="h-4 w-4" />}
              label="Sucesión dinástica"
              value="succession"
              onChange={onViewModeChange}
            />
            <SegmentedButton
              active={viewMode === "contemporaries"}
              icon={<Users className="h-4 w-4" />}
              label="Contemporáneos"
              value="contemporaries"
              onChange={onViewModeChange}
            />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-1.5 text-xs text-slate-300 xl:justify-end">
        <div className="rounded-[3px] border border-slate-800 bg-slate-950/35 px-2.5 py-1.5">
          <span className="text-slate-500">Periodos</span>
          <span className="ml-2 font-medium text-slate-100">{stats.totalPeriods}</span>
        </div>
        <div className="rounded-[3px] border border-slate-800 bg-slate-950/35 px-2.5 py-1.5">
          <span className="text-slate-500">Inferidos</span>
          <span className="ml-2 font-medium text-slate-100">{stats.inferredPeriods}</span>
        </div>
        <div className="rounded-[3px] border border-slate-800 bg-slate-950/35 px-2.5 py-1.5">
          <span className="text-slate-500">Sin final</span>
          <span className="ml-2 font-medium text-slate-100">{stats.openEndedPeriods}</span>
        </div>
        <div className="rounded-[3px] border border-slate-800 bg-slate-950/35 px-2.5 py-1.5">
          <span className="text-slate-500">Omitidos</span>
          <span className="ml-2 font-medium text-slate-100">{stats.skippedPeriods}</span>
        </div>
        <div
          className={cn(
            "rounded-[3px] border px-2.5 py-1.5",
            stats.invalidPeriods > 0
              ? "border-red-500/40 bg-red-950/25 text-red-100"
              : "border-slate-800 bg-slate-950/35 text-slate-300"
          )}
        >
          <AlertTriangle className="mr-1.5 inline h-4 w-4 align-[-3px]" />
          <span className="text-slate-400">Anomalías</span>
          <span className="ml-2 font-medium text-slate-100">{stats.invalidPeriods}</span>
        </div>
      </div>
    </div>
  );
}
