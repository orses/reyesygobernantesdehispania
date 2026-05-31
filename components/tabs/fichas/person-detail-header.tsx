import {
  ArrowLeft,
  ArrowRight,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  CardHeader,
  CardTitle,
} from "../../ui/card";
import { Button } from "../../ui/button";
import type { Person } from "../../../lib/types";
import { VerifiedBadge } from "./shared";

interface PersonDetailHeaderProps {
  selectedPerson: Person | null;
  predecessor: Person | null;
  successor: Person | null;
  setSelectedPersonId: (value: string | null) => void;
  openPersonEditor: (personId: string | number) => void;
  setDeleteTarget: (target: { kind: string; id: string | number | null }) => void;
  setDeleteOpen: (value: boolean) => void;
}

export function PersonDetailHeader({
  selectedPerson,
  predecessor,
  successor,
  setSelectedPersonId,
  openPersonEditor,
  setDeleteTarget,
  setDeleteOpen,
}: PersonDetailHeaderProps) {
  const apelativo = selectedPerson?.reinados?.[0]?.Apelativo;
  const hasNavigation = Boolean(selectedPerson && (predecessor || successor));

  return (
    <CardHeader className="gap-1.5 px-6 pt-4 pb-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <CardTitle className="text-2xl font-semibold leading-tight text-emerald-200 sm:text-3xl 2xl:text-4xl">
            {selectedPerson?.nombrePrincipal || "sin selección"}
          </CardTitle>
          {selectedPerson ? <VerifiedBadge verified={selectedPerson.verifiedAll} /> : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="icon"
            className="cursor-pointer rounded-[3px] bg-slate-950/30 border border-slate-700/70 text-slate-100 hover:bg-slate-900/60 hover:text-slate-100"
            title="editar personaje"
            aria-label="editar personaje"
            onClick={() => {
              if (selectedPerson) openPersonEditor(selectedPerson.personId);
            }}
            disabled={!selectedPerson}
          >
            <Pencil className="h-5 w-5" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="cursor-pointer rounded-[3px] hover:bg-red-600"
            title="eliminar personaje"
            aria-label="eliminar personaje"
            onClick={() => {
              if (!selectedPerson) return;
              setDeleteTarget({ kind: "person", id: selectedPerson.personId });
              setDeleteOpen(true);
            }}
            disabled={!selectedPerson}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {apelativo || hasNavigation ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {apelativo ? (
            <span className="text-xl font-medium text-slate-100 sm:text-2xl 2xl:text-3xl">{String(apelativo)}</span>
          ) : null}
          {hasNavigation ? (
            <div className="flex flex-wrap gap-2">
              {predecessor ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-0 cursor-pointer rounded-[3px] border-slate-700/70 bg-slate-950/30 px-3 text-slate-100 hover:bg-slate-900/60 hover:text-slate-50"
                  title={`Predecesor: ${predecessor.nombrePrincipal}`}
                  onClick={() => setSelectedPersonId(String(predecessor.personId))}
                >
                  <ArrowLeft className="mr-2 h-4 w-4 shrink-0 self-center" />
                  <span className="flex min-w-0 items-baseline gap-1">
                    <span className="text-xs font-medium text-slate-400">Predecesor</span>
                    <span className="max-w-[14rem] truncate font-medium">{predecessor.nombrePrincipal}</span>
                  </span>
                </Button>
              ) : null}
              {successor ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-0 cursor-pointer rounded-[3px] border-slate-700/70 bg-slate-950/30 px-3 text-slate-100 hover:bg-slate-900/60 hover:text-slate-50"
                  title={`Sucesor: ${successor.nombrePrincipal}`}
                  onClick={() => setSelectedPersonId(String(successor.personId))}
                >
                  <span className="flex min-w-0 items-baseline gap-1">
                    <span className="text-xs font-medium text-slate-400">Sucesor</span>
                    <span className="max-w-[14rem] truncate font-medium">{successor.nombrePrincipal}</span>
                  </span>
                  <ArrowRight className="ml-2 h-4 w-4 shrink-0 self-center" />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </CardHeader>
  );
}
