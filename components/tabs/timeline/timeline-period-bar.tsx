import { AlertTriangle, CornerDownRight } from "lucide-react";
import { formatNumber } from "../../../lib/data";
import { getTimelinePeriodPosition, type TimelinePeriod, type TimelineScale } from "../../../lib/timeline";
import { cn } from "../../../lib/utils";

interface TimelinePeriodBarProps {
  period: TimelinePeriod;
  scale: TimelineScale;
  selected: boolean;
  dimmed: boolean;
  related: boolean;
  onSelect: (periodId: string) => void;
}

function periodAriaLabel(period: TimelinePeriod): string {
  const endLabel = period.endYear === null ? "sin final cronológico" : String(period.endYear);
  return `${period.name}, ${period.kingdom}, ${period.startYear}-${endLabel}`;
}

function periodRangeLabel(period: TimelinePeriod): string {
  return period.endYear === null ? `${period.startYear}-sin final` : `${period.startYear}-${period.endYear}`;
}

function periodDurationLabel(period: TimelinePeriod): string {
  return period.durationYears === null ? "duración no fiable" : `${formatNumber(period.durationYears)} años`;
}

export function TimelinePeriodBar({
  period,
  scale,
  selected,
  dimmed,
  related,
  onSelect,
}: TimelinePeriodBarProps) {
  const position = getTimelinePeriodPosition(period, scale);
  const inferred = period.isInferredStart || period.isInferredEnd;
  const backgroundColor = period.hasInvalidRange ? "#dc2626" : period.color;
  const backgroundImage = inferred
    ? "repeating-linear-gradient(135deg, rgba(255,255,255,0.24) 0 4px, transparent 4px 8px)"
    : undefined;

  return (
    <div
      className={cn(
        "group absolute top-1 bottom-1 min-w-[18px]",
        selected && "z-40",
        !selected && "hover:z-30",
        dimmed && "opacity-25 grayscale hover:opacity-90 focus-within:opacity-90"
      )}
      style={{
        left: `${position.left}%`,
        width: `${position.width}%`,
      }}
    >
      <button
        type="button"
        aria-label={periodAriaLabel(period)}
        aria-pressed={selected}
        onClick={() => onSelect(period.id)}
        className={cn(
          "flex h-full w-full items-center overflow-hidden rounded-[3px] border px-1 text-left text-[11px] font-medium text-white shadow-sm outline-none transition",
          "focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
          selected && "border-emerald-200 shadow-lg shadow-emerald-950/40",
          !selected && "border-slate-950/80 hover:border-slate-100/70",
          related && !selected && "ring-1 ring-sky-200/80",
          period.isOpenEnded && "border-dashed border-amber-200/80",
          period.hasInvalidRange && "border-red-200"
        )}
        style={{
          backgroundColor,
          backgroundImage,
        }}
      >
        <span className="min-w-0 flex-1 truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
          {period.name}
        </span>
        {period.isOpenEnded && (
          <CornerDownRight className="ml-1 h-3.5 w-3.5 shrink-0 text-amber-100" aria-hidden="true" />
        )}
        {period.hasInvalidRange && (
          <AlertTriangle className="ml-1 h-3.5 w-3.5 shrink-0 text-red-100" aria-hidden="true" />
        )}
      </button>

      <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 hidden w-max max-w-[22rem] -translate-x-1/2 rounded-[3px] border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-left text-xs font-medium text-slate-50 shadow-xl shadow-slate-950/50 group-hover:block group-focus-within:block">
        {period.name} ({periodRangeLabel(period)}, {periodDurationLabel(period)})
      </div>
    </div>
  );
}
