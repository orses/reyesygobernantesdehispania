import { AlertTriangle, ArrowRight, ExternalLink, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCenturyLabel, formatNumber } from "../../../lib/data";
import type { TimelineIssue, TimelinePeriod } from "../../../lib/timeline";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";

interface TimelineDetailPanelProps {
  period: TimelinePeriod | null;
  issues: TimelineIssue[];
}

function evidenceLabel(raw: string, year: number | null): string {
  if (raw) return year === null ? raw : `${raw} (${year})`;
  return year === null ? "Sin dato" : String(year);
}

function durationLabel(period: TimelinePeriod): string {
  if (period.durationYears === null) return "Sin duración fiable";
  return `${formatNumber(period.durationYears)} años`;
}

function statusBadges(period: TimelinePeriod) {
  return (
    <div className="flex flex-wrap gap-2">
      {period.verified ? (
        <Badge variant="secondary" className="rounded-[3px] border border-emerald-500/30 bg-emerald-950/35 text-emerald-100">
          <ShieldCheck className="mr-1 h-3.5 w-3.5" /> verificado
        </Badge>
      ) : (
        <Badge variant="secondary" className="rounded-[3px] border border-amber-500/30 bg-amber-950/35 text-amber-100">
          <ShieldQuestion className="mr-1 h-3.5 w-3.5" /> sin verificación completa
        </Badge>
      )}
      {(period.isInferredStart || period.isInferredEnd) && (
        <Badge variant="secondary" className="rounded-[3px] border border-sky-500/30 bg-sky-950/35 text-sky-100">
          fecha inferida
        </Badge>
      )}
      {period.isOpenEnded && (
        <Badge variant="secondary" className="rounded-[3px] border border-amber-500/30 bg-amber-950/35 text-amber-100">
          final desconocido
        </Badge>
      )}
      {period.hasInvalidRange && (
        <Badge variant="secondary" className="rounded-[3px] border border-red-500/40 bg-red-950/40 text-red-100">
          <AlertTriangle className="mr-1 h-3.5 w-3.5" /> rango anómalo
        </Badge>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-1 min-w-0 break-words text-sm text-slate-100">{value || "—"}</div>
    </div>
  );
}

function SuccessionLink({
  label,
  person,
}: {
  label: string;
  person: TimelinePeriod["predecessor"];
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-widest text-slate-500">{label}</div>
      {person ? (
        <Link
          to={`/fichas/${person.personId}`}
          className="mt-1 flex min-w-0 items-center gap-1 text-sm font-medium text-sky-200 hover:text-sky-100"
        >
          <span className="truncate">{person.nombrePrincipal}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
        </Link>
      ) : (
        <div className="mt-1 text-sm text-slate-500">—</div>
      )}
    </div>
  );
}

export function TimelineDetailPanel({ period, issues }: TimelineDetailPanelProps) {
  if (!period) {
    return (
      <div className="rounded-[3px] border border-slate-800 bg-slate-950/30 px-3 py-2 text-sm text-slate-400">
        Sin periodo cronológico seleccionado.
      </div>
    );
  }

  const periodIssues = issues.filter((issue) => issue.rowId === period.rowId);

  return (
    <div className="rounded-[3px] border border-slate-800 bg-slate-950/30 px-3 py-2">
      <div className="grid gap-3 xl:grid-cols-[minmax(240px,1.1fr)_minmax(0,2.4fr)_auto] xl:items-center">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[11px] font-medium uppercase tracking-widest text-slate-500">{period.kingdom}</div>
          <div className="flex min-w-0 items-baseline gap-2">
            <h3 className="truncate text-base font-medium text-slate-50">{period.name}</h3>
            <span className="truncate text-xs text-slate-400">{period.reignName}</span>
          </div>
          {statusBadges(period)}
        </div>

        <div className="grid min-w-0 gap-x-4 gap-y-2 sm:grid-cols-4 xl:grid-cols-[0.7fr_0.7fr_0.6fr_0.75fr_1.05fr_0.55fr_1.55fr_1.55fr]">
          <Field label="Inicio" value={evidenceLabel(period.startEvidence.raw, period.startYear)} />
          <Field
            label="Final"
            value={period.isOpenEnded ? "Sin final utilizable" : evidenceLabel(period.endEvidence.raw, period.endYear)}
          />
          <Field label="Duración" value={durationLabel(period)} />
          <Field label="Tipo" value={period.governmentType} />
          <Field label="Dinastía" value={period.dynasty} />
          <Field label="Siglos" value={period.centuries.length ? period.centuries.map(formatCenturyLabel).join(", ") : "—"} />
          <SuccessionLink label="Predecesor" person={period.predecessor} />
          <SuccessionLink label="Sucesor" person={period.successor} />
        </div>

        <Button asChild variant="outline" size="sm" className="h-9 shrink-0 rounded-[3px]">
          <Link to={`/fichas/${period.personId}`}>
            <ExternalLink className="mr-2 h-4 w-4" />
            ficha
          </Link>
        </Button>
      </div>

      {periodIssues.length > 0 && (
        <div className="mt-2 border-t border-slate-800 pt-2">
          <div className="grid gap-1">
            {periodIssues.map((issue) => (
              <div
                key={`${issue.kind}-${issue.rowId}`}
                className="rounded-[3px] border border-slate-800 bg-slate-950/35 px-2 py-1 text-xs text-slate-300"
              >
                {issue.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
