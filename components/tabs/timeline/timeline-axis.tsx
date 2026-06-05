import type { TimelineScale } from "../../../lib/timeline";

interface TimelineAxisProps {
  scale: TimelineScale;
}

export function TimelineAxis({ scale }: TimelineAxisProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {scale.ticks.map((tick) => {
        const left = ((tick.year - scale.minYear) / scale.totalYears) * 100;

        return (
          <div
            key={tick.year}
            className="absolute top-0 h-full border-l border-slate-800/60"
            style={{ left: `${left}%` }}
          >
            <span className="absolute left-0 top-2 -translate-x-1/2 rounded-[3px] bg-slate-950 px-2 py-0.5 text-[11px] font-medium text-slate-400">
              {tick.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
