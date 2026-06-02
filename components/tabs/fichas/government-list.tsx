import { ArrowLeft, ArrowRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "../../ui/button";
import { formatNumber } from "../../../lib/data";
import {
  durationMeta,
  personGovernmentPeriods,
  rangeMeta,
} from "../../../lib/ficha-view";
import type { GovernmentSuccession, SuccessionPersonRef, SuccessionSource } from "../../../lib/succession";
import type { Person } from "../../../lib/types";
import { DataStatusPill, SectionTitle } from "./shared";

interface GovernmentListProps {
  selectedPerson: Person;
  successionByRowId: ReadonlyMap<string, GovernmentSuccession>;
  setSelectedPersonId: (value: string | null) => void;
  openRowEditor: (rowId: string | number) => void;
  setDeleteTarget: (target: { kind: string; id: string | number | null }) => void;
  setDeleteOpen: (value: boolean) => void;
}

function successionDisplayName(person: SuccessionPersonRef): string {
  return person.nombreReinado || person.nombrePrincipal;
}

function successionTitle(
  kind: "Predecesor" | "Sucesor",
  reino: string,
  person: SuccessionPersonRef,
  source: SuccessionSource
): string {
  const sourceText = source === "manual" ? "manual" : "cronológico por reino";
  const displayName = successionDisplayName(person);
  const principalName = person.nombrePrincipal && person.nombrePrincipal !== displayName
    ? ` (${person.nombrePrincipal})`
    : "";
  return `${kind} en ${reino}: ${displayName}${principalName} · ${sourceText}`;
}

function SuccessionButton({
  kind,
  reino,
  person,
  source,
  setSelectedPersonId,
}: {
  kind: "predecessor" | "successor";
  reino: string;
  person: SuccessionPersonRef;
  source: SuccessionSource;
  setSelectedPersonId: (value: string | null) => void;
}) {
  const isPredecessor = kind === "predecessor";
  const label = isPredecessor ? "Predecesor" : "Sucesor";
  const Icon = isPredecessor ? ArrowLeft : ArrowRight;

  return (
    <Button
      type="button"
      variant="outline"
      className="h-7 min-w-0 cursor-pointer rounded-[3px] border-slate-700/70 bg-slate-950/30 px-2 text-xs text-slate-100 hover:bg-slate-900/60 hover:text-slate-50"
      title={successionTitle(label, reino, person, source)}
      onClick={() => setSelectedPersonId(person.personId)}
    >
      {isPredecessor ? <Icon className="mr-1.5 h-3.5 w-3.5 shrink-0" /> : null}
      <span className="min-w-0 truncate">
        <span className="text-slate-400">{label}</span>{" "}
        <span className="font-medium">{successionDisplayName(person)}</span>
      </span>
      {!isPredecessor ? <Icon className="ml-1.5 h-3.5 w-3.5 shrink-0" /> : null}
    </Button>
  );
}

export function GovernmentList({
  selectedPerson,
  successionByRowId,
  setSelectedPersonId,
  openRowEditor,
  setDeleteTarget,
  setDeleteOpen,
}: GovernmentListProps) {
  const periods = personGovernmentPeriods(selectedPerson);

  return (
    <div className="space-y-2">
      <SectionTitle>Gobiernos y periodos</SectionTitle>
      <div className="grid grid-cols-1 gap-2">
        {periods.map((period) => {
          const governmentRangeMeta = rangeMeta(period.inicio, period.fin);
          const governmentDurationMeta = durationMeta(period.durationSource);
          const inicioFecha = String(period.row?.["Inicio Reinado (Fecha)"] ?? "").trim();
          const finFecha = String(period.row?.["Fin Reinado (Fecha)"] ?? "").trim();
          const hasFullDates = Boolean(inicioFecha || finFecha);
          const succession = successionByRowId.get(period.rowId);
          const hasSuccession = Boolean(succession?.predecessor || succession?.successor);

          return (
            <div
              key={period.rowId}
              className="flex items-center justify-between gap-3 rounded-[3px] border border-slate-700/80 bg-slate-950/25 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-50">{period.reino}</div>
                {period.tipoGobierno ? (
                  <div className="truncate text-xs text-slate-400">{String(period.tipoGobierno)}</div>
                ) : null}
                {hasFullDates ? (
                  <div className="truncate text-xs text-slate-300">
                    {inicioFecha && finFecha ? (
                      <>{inicioFecha} <span className="text-slate-500">–</span> {finFecha}</>
                    ) : inicioFecha ? (
                      <>desde {inicioFecha}</>
                    ) : (
                      <>hasta {finFecha}</>
                    )}
                  </div>
                ) : null}
                {hasSuccession ? (
                  <div className="mt-1 flex min-w-0 flex-wrap gap-1.5">
                    {succession?.predecessor ? (
                      <SuccessionButton
                        kind="predecessor"
                        reino={period.reino}
                        person={succession.predecessor}
                        source={succession.predecessorSource}
                        setSelectedPersonId={setSelectedPersonId}
                      />
                    ) : null}
                    {succession?.successor ? (
                      <SuccessionButton
                        kind="successor"
                        reino={period.reino}
                        person={succession.successor}
                        source={succession.successorSource}
                        setSelectedPersonId={setSelectedPersonId}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                <span
                  className="inline-flex cursor-help items-center gap-1.5 rounded-[3px] border border-slate-700/70 bg-slate-950 px-2 py-1 text-sm font-medium tabular-nums text-slate-100"
                  title={governmentRangeMeta.tooltip}
                >
                  {period.inicio ? String(period.inicio) : "—"}–{period.fin ? String(period.fin) : "—"}
                  <DataStatusPill meta={governmentRangeMeta} />
                </span>
                {period.duration !== null ? (
                  <span
                    className="inline-flex cursor-help items-center gap-1.5 rounded-[3px] border border-emerald-500/30 bg-emerald-950 px-2 py-1 text-sm font-medium tabular-nums text-emerald-100"
                    title={governmentDurationMeta.tooltip}
                  >
                    {formatNumber(period.duration)} años
                    <DataStatusPill meta={governmentDurationMeta} />
                  </span>
                ) : null}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 cursor-pointer rounded-[3px] border border-slate-700/70 bg-slate-950/30 text-slate-100 hover:bg-slate-900/60 hover:text-slate-100"
                  title="editar gobierno"
                  aria-label="editar gobierno"
                  onClick={() => openRowEditor(period.rowId)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-7 w-7 cursor-pointer rounded-[3px] hover:bg-red-600"
                  title="eliminar gobierno"
                  aria-label="eliminar gobierno"
                  onClick={() => {
                    setDeleteTarget({ kind: "row", id: period.rowId });
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
