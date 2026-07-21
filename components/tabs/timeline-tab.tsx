import React, { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import {
  buildTimelineModel,
  type TimelineGroupMode,
  type TimelineScope,
  type TimelineViewMode,
} from "../../lib/timeline";
import {
  RAILWAY_KINGDOMS,
  buildRailwayModel,
  type RailwayKingdom,
} from "../../lib/railway";
import { WESTERN_KINGDOMS_RAILWAY_TOPOLOGY } from "../../lib/railway-topology";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { RailwayControls } from "./timeline/railway-controls";
import { RailwayView } from "./timeline/railway-view";
import { TimelineControls } from "./timeline/timeline-controls";
import { TimelineDetailPanel } from "./timeline/timeline-detail-panel";
import {
  TimelineDisplaySwitch,
  type TimelineDisplayMode,
} from "./timeline/timeline-display-switch";
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
  const [displayMode, setDisplayMode] = useState<TimelineDisplayMode>("railway");
  const [groupMode, setGroupMode] = useState<TimelineGroupMode>("kingdom");
  const [scope, setScope] = useState<TimelineScope>("filtered");
  const [viewMode, setViewMode] = useState<TimelineViewMode>("periods");
  const [selectedRailwayKingdoms, setSelectedRailwayKingdoms] = useState<RailwayKingdom[]>(
    () => [...RAILWAY_KINGDOMS]
  );
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
  const railwayModel = useMemo(
    () => buildRailwayModel(allPeople, {
      selectedKingdoms: selectedRailwayKingdoms,
      transitionCatalog: WESTERN_KINGDOMS_RAILWAY_TOPOLOGY,
    }),
    [allPeople, selectedRailwayKingdoms]
  );
  const railwayStationCounts = useMemo(() => {
    const counts = Object.fromEntries(
      RAILWAY_KINGDOMS.map((kingdom) => [kingdom, 0])
    ) as Record<RailwayKingdom, number>;
    railwayModel.network.stations.forEach((station) => {
      counts[station.kingdom] += 1;
    });
    return counts;
  }, [railwayModel.network.stations]);
  const visiblePeriods = displayMode === "railway"
    ? railwayModel.projection.periods
    : model.periods;

  useEffect(() => {
    if (
      !visiblePeriods.length ||
      (selectedPeriodId && !visiblePeriods.some((period) => period.id === selectedPeriodId))
    ) {
      setSelectedPeriodId(null);
    }
  }, [selectedPeriodId, visiblePeriods]);

  const selectedPeriod = useMemo(
    () => visiblePeriods.find((period) => period.id === selectedPeriodId) ?? null,
    [selectedPeriodId, visiblePeriods]
  );
  const railwayIssueCount = railwayModel.issues.filter((issue) =>
    selectedRailwayKingdoms.includes(issue.kingdom)
  ).length;

  function toggleRailwayKingdom(kingdom: RailwayKingdom) {
    setSelectedRailwayKingdoms((current) =>
      current.includes(kingdom)
        ? current.filter((candidate) => candidate !== kingdom)
        : RAILWAY_KINGDOMS.filter(
          (candidate) => candidate === kingdom || current.includes(candidate)
        )
    );
  }

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
            <TimelineDisplaySwitch value={displayMode} onChange={setDisplayMode} />
          </div>

          {displayMode === "railway" ? (
            <RailwayControls
              selectedKingdoms={selectedRailwayKingdoms}
              stationCounts={railwayStationCounts}
              onToggleKingdom={toggleRailwayKingdom}
              onResetKingdoms={() => setSelectedRailwayKingdoms([...RAILWAY_KINGDOMS])}
            />
          ) : (
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
          )}
        </CardHeader>

        <CardContent className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3 overflow-hidden p-3">
          {displayMode === "railway" ? (
            <>
              <RailwayView
                projection={railwayModel.projection}
                issueCount={railwayIssueCount}
                selectedPeriodId={selectedPeriodId}
                onSelectPeriod={setSelectedPeriodId}
              />
              {railwayModel.projection.periods.length > 0 && (
                <div className="max-h-[132px] overflow-y-auto custom-scrollbar">
                  <TimelineDetailPanel
                    period={selectedPeriod}
                    issues={railwayModel.timelineIssues}
                  />
                </div>
              )}
            </>
          ) : model.periods.length === 0 ? (
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
