import React, { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import {
  buildTimelineModel,
  type TimelineGroupMode,
  type TimelineScope,
  type TimelineViewMode,
} from "../../lib/timeline";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { TimelineControls } from "./timeline/timeline-controls";
import { TimelineDetailPanel } from "./timeline/timeline-detail-panel";
import { TimelineView } from "./timeline/timeline-view";

function hasActiveFilters(filters: ReturnType<typeof useAppContext>["filters"]): boolean {
  return Boolean(
    filters.query ||
    filters.filterReino !== "__all__" ||
    filters.filterDinastia !== "__all__" ||
    filters.filterSiglo !== "__all__"
  );
}

export function TimelineTab() {
  const { allPeople, people, selectedPerson, filters } = useAppContext();
  const [groupMode, setGroupMode] = useState<TimelineGroupMode>("kingdom");
  const [scope, setScope] = useState<TimelineScope>("filtered");
  const [viewMode, setViewMode] = useState<TimelineViewMode>("periods");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  const activeFilters = hasActiveFilters(filters);
  const scopedPeople = useMemo(() => {
    if (scope === "global") return allPeople;
    if (scope === "selected" && selectedPerson) return [selectedPerson];
    return people;
  }, [allPeople, people, scope, selectedPerson]);

  const model = useMemo(() => buildTimelineModel(scopedPeople, {
    groupMode,
  }), [groupMode, scopedPeople]);

  useEffect(() => {
    if (
      !model.periods.length ||
      (selectedPeriodId && !model.periods.some((period) => period.id === selectedPeriodId))
    ) {
      setSelectedPeriodId(null);
    }
  }, [model.periods, selectedPeriodId]);

  const selectedPeriod = useMemo(
    () => model.periods.find((period) => period.id === selectedPeriodId) ?? null,
    [model.periods, selectedPeriodId]
  );

  return (
    <div className="h-[calc(100vh-7.5rem)] min-h-[560px]">
      <Card className="flex h-full min-h-0 flex-col rounded-[3px] border border-slate-800 bg-slate-900/30">
        <CardHeader className="shrink-0 space-y-3 border-b border-slate-800/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-xl font-medium text-slate-50">
                <Clock3 className="h-5 w-5 text-emerald-300" />
                Línea temporal
              </CardTitle>
            </div>
          </div>

          <TimelineControls
            groupMode={groupMode}
            scope={scope}
            viewMode={viewMode}
            stats={model.stats}
            hasFilters={activeFilters}
            hasSelectedPerson={Boolean(selectedPerson)}
            selectedPersonName={selectedPerson?.nombrePrincipal ?? ""}
            onGroupModeChange={setGroupMode}
            onScopeChange={setScope}
            onViewModeChange={setViewMode}
          />
        </CardHeader>

        <CardContent className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3 overflow-hidden p-3">
          {model.periods.length === 0 ? (
            <div className="rounded-[3px] border border-slate-800 bg-slate-950/30 p-6 text-center text-sm text-slate-400">
              Sin datos cronológicos válidos para proyectar la línea temporal.
            </div>
          ) : (
            <>
              <TimelineView
                model={model}
                selectedPeriodId={selectedPeriodId}
                viewMode={viewMode}
                onSelectPeriod={setSelectedPeriodId}
              />
              <div className="max-h-[132px] overflow-y-auto custom-scrollbar">
                <TimelineDetailPanel period={selectedPeriod} issues={model.issues} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
