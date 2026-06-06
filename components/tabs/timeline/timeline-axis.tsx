import type { TimelineScale } from "../../../lib/timeline";

interface TimelineAxisProps {
  scale: TimelineScale;
}

/** Un inicio de siglo (…700, 800, 900…) se resalta para situar de un vistazo
 * los grandes hitos cronológicos sobre la línea temporal. */
function isCenturyStart(year: number): boolean {
  return year % 100 === 0;
}

export function TimelineAxis({ scale }: TimelineAxisProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {scale.ticks.map((tick) => {
        const left = ((tick.year - scale.minYear) / scale.totalYears) * 100;
        const centuryStart = isCenturyStart(tick.year);

        return (
          <div
            key={tick.year}
            className="absolute top-0 h-full border-l border-slate-800/60"
            style={{ left: `${left}%` }}
          >
            <span
              className={`absolute left-0 top-2 -translate-x-1/2 px-2 py-0.5 text-[11px] ${
                centuryStart
                  ? "font-semibold text-amber-300"
                  : "font-medium text-slate-400"
              }`}
            >
              {tick.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
