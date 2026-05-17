import { Pencil, Trash2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { formatNumber } from "../../../lib/data";
import {
  durationMeta,
  personGovernmentPeriods,
  rangeMeta,
} from "../../../lib/ficha-view";
import type { Person } from "../../../lib/types";
import {
  DataStatusPill,
  Field,
  SectionTitle,
} from "./shared";

interface GovernmentListProps {
  selectedPerson: Person;
  openRowEditor: (rowId: string | number) => void;
  setDeleteTarget: (target: { kind: string; id: string | number | null }) => void;
  setDeleteOpen: (value: boolean) => void;
}

export function GovernmentList({
  selectedPerson,
  openRowEditor,
  setDeleteTarget,
  setDeleteOpen,
}: GovernmentListProps) {
  const periods = personGovernmentPeriods(selectedPerson);

  return (
    <div className="space-y-3">
      <SectionTitle>Gobiernos y periodos</SectionTitle>
      <div className="grid grid-cols-1 gap-2 2xl:grid-cols-2">
        {periods.map((period) => {
          const governmentRangeMeta = rangeMeta(period.inicio, period.fin);
          const governmentDurationMeta = durationMeta(period.durationSource);

          return (
            <Card key={period.rowId} className="rounded-[3px] shadow-sm bg-slate-950/25 border border-slate-700/80">
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate text-slate-50">{period.reino}</div>
                    <div className="text-sm font-bold text-emerald-200 truncate">{period.nombre}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex cursor-help items-center gap-2 rounded-[3px] border border-slate-700/70 bg-slate-950 px-2 py-1 text-sm font-semibold text-slate-100 select-none" title={governmentRangeMeta.tooltip}>
                      {period.inicio ? String(period.inicio) : "—"}–{period.fin ? String(period.fin) : "—"}
                      <DataStatusPill meta={governmentRangeMeta} />
                    </span>
                    {period.duration !== null ? (
                      <span className="inline-flex cursor-help items-center gap-2 rounded-[3px] border border-emerald-500/30 bg-emerald-950 px-2 py-1 text-sm font-semibold text-emerald-100 select-none" title={governmentDurationMeta.tooltip}>
                        {formatNumber(period.duration)} años
                        <DataStatusPill meta={governmentDurationMeta} />
                      </span>
                    ) : null}

                    <Button
                      variant="outline"
                      size="icon"
                      className="cursor-pointer rounded-[3px] bg-slate-950/30 border border-slate-700/70 text-slate-100 hover:bg-slate-900/60 hover:text-slate-100"
                      title="editar gobierno"
                      aria-label="editar gobierno"
                      onClick={() => openRowEditor(period.rowId)}
                    >
                      <Pencil className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="cursor-pointer rounded-[3px] hover:bg-red-600"
                      title="eliminar gobierno"
                      aria-label="eliminar gobierno"
                      onClick={() => {
                        setDeleteTarget({ kind: "row", id: period.rowId });
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  <Field label="Tipo de gobierno" value={period.tipoGobierno} />
                  {period.nroReinado ? <Field label="N.º reinado" value={period.nroReinado} /> : null}
                  <Field label="Dinastía" value={period.dinastia} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
