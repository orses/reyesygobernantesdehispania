import { useEffect, useMemo, useRef } from "react";
import {
  getTimelineContemporaryPeriodIds,
  getTimelineSuccessionPeriodIds,
  type TimelineModel,
  type TimelineViewMode,
} from "../../../lib/timeline";
import { cn } from "../../../lib/utils";
import { TimelineAxis } from "./timeline-axis";
import { TimelinePeriodBar } from "./timeline-period-bar";

interface TimelineViewProps {
  model: TimelineModel;
  selectedPeriodId: string | null;
  viewMode: TimelineViewMode;
  onSelectPeriod: (periodId: string) => void;
}

interface GroupLayout {
  key: string;
  top: number;
  height: number;
}

const AXIS_HEIGHT = 48;
const GROUP_HEADER_HEIGHT = 34;
const LANE_HEIGHT = 38;
const GROUP_GAP = 22;

function timelineWidth(totalYears: number): number {
  if (totalYears <= 120) return 1120;
  if (totalYears <= 350) return 1500;
  if (totalYears <= 900) return 2200;
  if (totalYears <= 1800) return 3200;
  return 4200;
}

export function TimelineView({
  model,
  selectedPeriodId,
  viewMode,
  onSelectPeriod,
}: TimelineViewProps) {
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);
  const selectedPeriod = model.periods.find((period) => period.id === selectedPeriodId) ?? null;
  const successionPeriodIds = getTimelineSuccessionPeriodIds(model.periods, selectedPeriod);
  const contemporaryPeriodIds = getTimelineContemporaryPeriodIds(model.periods, selectedPeriod);

  const groupLayouts = useMemo(() => {
    let top = AXIS_HEIGHT;
    const layouts: GroupLayout[] = [];

    for (const group of model.groups) {
      const laneCount = Math.max(1, group.lanes.length);
      const height = GROUP_HEADER_HEIGHT + laneCount * LANE_HEIGHT + GROUP_GAP;
      layouts.push({ key: group.key, top, height });
      top += height;
    }

    return {
      layouts,
      totalHeight: Math.max(180, top + 8),
    };
  }, [model.groups]);

  const layoutByGroup = new Map(groupLayouts.layouts.map((layout) => [layout.key, layout]));
  const width = timelineWidth(model.scale.totalYears);

  useEffect(() => {
    if (topScrollRef.current && viewportRef.current) {
      topScrollRef.current.scrollLeft = viewportRef.current.scrollLeft;
    }
  }, [width, model.groups]);

  function syncHorizontalScroll(source: HTMLDivElement, target: HTMLDivElement | null) {
    if (!target || syncingScrollRef.current) return;

    syncingScrollRef.current = true;
    target.scrollLeft = source.scrollLeft;
    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }

  function isRelated(periodId: string): boolean {
    if (periodId === selectedPeriodId) return true;
    if (viewMode === "succession") return successionPeriodIds.has(periodId);
    if (viewMode === "contemporaries") return contemporaryPeriodIds.has(periodId);
    return false;
  }

  function isDimmed(periodId: string): boolean {
    if (viewMode === "periods") return false;
    if (viewMode === "succession") return selectedPeriod !== null && !isRelated(periodId);
    if (viewMode === "contemporaries") return selectedPeriod !== null && !isRelated(periodId);
    return false;
  }

  return (
    <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-[3px] border border-slate-800/70 bg-slate-950/35">
      <div
        ref={topScrollRef}
        className="overflow-x-auto overflow-y-hidden border-b border-slate-800 bg-slate-950/80 custom-scrollbar"
        onScroll={(event) => syncHorizontalScroll(event.currentTarget, viewportRef.current)}
        aria-label="Desplazamiento horizontal de la línea temporal"
      >
        <div style={{ width, height: 14 }} />
      </div>
      <div
        ref={viewportRef}
        className="min-h-0 overflow-auto custom-scrollbar"
        onScroll={(event) => syncHorizontalScroll(event.currentTarget, topScrollRef.current)}
      >
        <div
          className="relative min-w-[960px]"
          style={{ width, height: groupLayouts.totalHeight }}
        >
          <div className="sticky top-0 z-40 h-[48px] border-b border-slate-800 bg-slate-950/95 shadow-sm">
            <TimelineAxis scale={model.scale} />
          </div>

          {model.groups.map((group) => {
            const layout = layoutByGroup.get(group.key);
            if (!layout) return null;

            return (
              <div
                key={group.key}
                className="absolute left-0 right-0 border-t border-slate-800/70"
                style={{ top: layout.top, height: layout.height }}
              >
                <div className="sticky left-0 z-20 inline-flex max-w-[360px] items-center gap-2 rounded-br-[3px] bg-slate-950/95 px-3 py-2 text-sm font-medium text-slate-100 shadow-sm">
                  <span
                    className="h-3 w-3 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: group.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{group.label}</span>
                  <span className="shrink-0 text-xs font-normal text-slate-500">{group.periods.length}</span>
                </div>

                {group.lanes.map((lane, laneIndex) => (
                  <div
                    key={lane.id}
                    className={cn(
                      "absolute left-0 right-0 border-t border-slate-900/80",
                      laneIndex === 0 && "border-t-0"
                    )}
                    style={{
                      top: GROUP_HEADER_HEIGHT + laneIndex * LANE_HEIGHT,
                      height: LANE_HEIGHT,
                    }}
                  >
                    {lane.periods.map((period) => (
                      <TimelinePeriodBar
                        key={`${group.key}-${period.id}`}
                        period={period}
                        scale={model.scale}
                        selected={period.id === selectedPeriodId}
                        related={isRelated(period.id)}
                        dimmed={isDimmed(period.id)}
                        onSelect={onSelectPeriod}
                      />
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
