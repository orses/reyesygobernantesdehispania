import { Button } from "../../ui/button";
import { colorBadgeStyle, kingdomColor } from "../../../lib/ficha-view";
import { RAILWAY_KINGDOMS, type RailwayKingdom } from "../../../lib/railway";
import { cn } from "../../../lib/utils";

export interface RailwayControlsProps {
  selectedKingdoms: readonly RailwayKingdom[];
  stationCounts: Readonly<Record<RailwayKingdom, number>>;
  onToggleKingdom: (kingdom: RailwayKingdom) => void;
  onResetKingdoms: () => void;
}

function markerLabel(count: number): string {
  return count === 1 ? "marcador" : "marcadores";
}

export function RailwayControls({
  selectedKingdoms,
  stationCounts,
  onToggleKingdom,
  onResetKingdoms,
}: RailwayControlsProps) {
  const selected = new Set(selectedKingdoms);
  const allSelected = RAILWAY_KINGDOMS.every((kingdom) => selected.has(kingdom));

  return (
    <fieldset className="min-w-0 space-y-1.5 border-0 p-0">
      <legend className="text-xs font-medium uppercase tracking-widest text-slate-400">
        Reinos visibles
      </legend>
      <p className="text-xs text-slate-400">
        Este selector solo poda la vista: no recalcula la historia ni sus relaciones.
      </p>
      <div className="flex min-w-0 flex-wrap gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={allSelected}
          onClick={onResetKingdoms}
          className={cn(
            "h-8 rounded-[3px] border px-2.5 text-xs",
            allSelected
              ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
              : "border-slate-700 bg-slate-950/40 text-slate-300 hover:bg-slate-800 hover:text-slate-50"
          )}
        >
          Todos
        </Button>

        {RAILWAY_KINGDOMS.map((kingdom) => {
          const isSelected = selected.has(kingdom);
          const count = stationCounts[kingdom];
          const color = kingdomColor(`Reino de ${kingdom}`) ?? "#64748b";

          return (
            <Button
              key={kingdom}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={isSelected}
              onClick={() => onToggleKingdom(kingdom)}
              className="h-8 rounded-[3px] border px-2.5 text-xs hover:brightness-110"
              style={colorBadgeStyle(color, isSelected)}
            >
              <span
                className="mr-1.5 h-2 w-2 shrink-0 rounded-full border border-white/40"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span>{kingdom}</span>
              <span className="ml-1.5 text-[11px] opacity-80">
                {count} {markerLabel(count)}
              </span>
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}
