import {
  ArrowLeft,
  ArrowRight,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  CardDescription,
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
  return (
    <CardHeader>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <CardTitle className="text-2xl font-extrabold leading-tight text-emerald-200 sm:text-3xl 2xl:text-4xl">{selectedPerson?.nombrePrincipal || "sin selección"}</CardTitle>
            {selectedPerson ? <VerifiedBadge verified={selectedPerson.verifiedAll} /> : null}
          </div>
          <CardDescription className="text-base text-slate-200">
            {selectedPerson?.reinados?.[0]?.Apelativo ? (
              <span className="block text-xl font-bold text-slate-100 sm:text-2xl 2xl:text-3xl">{String(selectedPerson.reinados[0].Apelativo)}</span>
            ) : null}
          </CardDescription>
          {selectedPerson && (predecessor || successor) ? (
            <div className="flex max-w-full flex-wrap gap-2 pt-2">
              {predecessor ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-0 cursor-pointer rounded-[3px] border-slate-700/70 bg-slate-950/30 px-3 text-slate-100 hover:bg-slate-900/60 hover:text-slate-50"
                  title={`Predecesor: ${predecessor.nombrePrincipal}`}
                  onClick={() => setSelectedPersonId(String(predecessor.personId))}
                >
                  <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
                  <span className="mr-1 text-xs font-semibold text-slate-400">Predecesor</span>
                  <span className="max-w-[14rem] truncate font-bold">{predecessor.nombrePrincipal}</span>
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
                  <span className="mr-1 text-xs font-semibold text-slate-400">Sucesor</span>
                  <span className="max-w-[14rem] truncate font-bold">{successor.nombrePrincipal}</span>
                  <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
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
    </CardHeader>
  );
}
