import { ChartNoAxesGantt, TrainFront } from "lucide-react";
import { Button } from "../../ui/button";
import { cn } from "../../../lib/utils";

export type TimelineDisplayMode = "railway" | "chronology";

interface TimelineDisplaySwitchProps {
  value: TimelineDisplayMode;
  onChange: (value: TimelineDisplayMode) => void;
}

export function TimelineDisplaySwitch({
  value,
  onChange,
}: TimelineDisplaySwitchProps) {
  return (
    <div
      className="inline-flex rounded-[3px] border border-slate-700 bg-slate-950/50 p-1"
      role="group"
      aria-label="Visualización cronológica"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={value === "railway"}
        onClick={() => onChange("railway")}
        className={cn(
          "h-8 rounded-[3px] px-2.5 text-xs",
          value === "railway"
            ? "bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20"
            : "text-slate-300 hover:text-slate-50"
        )}
      >
        <TrainFront className="mr-1.5 h-4 w-4" />
        Ferrocarril
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={value === "chronology"}
        onClick={() => onChange("chronology")}
        className={cn(
          "h-8 rounded-[3px] px-2.5 text-xs",
          value === "chronology"
            ? "bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20"
            : "text-slate-300 hover:text-slate-50"
        )}
      >
        <ChartNoAxesGantt className="mr-1.5 h-4 w-4" />
        Periodos
      </Button>
    </div>
  );
}
