import * as React from "react";
import type {
  MediaImportPersonCandidate,
  MediaImportRepair,
  MediaImportReview,
  OrphanMediaImportIssue,
} from "../lib/media-import";
import { Button } from "./ui/button";
import { Combobox, type ComboboxOption } from "./ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export interface ImportReviewDialogProps {
  open: boolean;
  fileName: string;
  review: MediaImportReview;
  resolutionError?: string;
  isApplying?: boolean;
  onApply: (repairs: readonly MediaImportRepair[]) => Promise<boolean | void> | boolean | void;
  onCancel: () => void;
}

type IssueResolution =
  | { action: "omit" }
  | { action: "reassign"; personId: string };

export type ImportReviewPlan = Record<string, IssueResolution>;

interface CandidateOption extends ComboboxOption {
  name: string;
  context: string;
}

export interface ImportReviewPlanValidation {
  ok: boolean;
  unresolvedIssueIds: string[];
  invalidReassignmentIssueIds: string[];
}

/** Comprueba que cada incidencia tenga una decisión explícita y válida. */
export function validateImportReviewPlan(
  issues: readonly OrphanMediaImportIssue[],
  candidates: readonly MediaImportPersonCandidate[],
  plan: Readonly<ImportReviewPlan>
): ImportReviewPlanValidation {
  const candidateIds = new Set(candidates.map((candidate) => candidate.personId));
  const unresolvedIssueIds: string[] = [];
  const invalidReassignmentIssueIds: string[] = [];

  for (const issue of issues) {
    const resolution = plan[issue.issueId];
    if (!resolution) {
      unresolvedIssueIds.push(issue.issueId);
    } else if (
      resolution.action === "reassign" &&
      !candidateIds.has(resolution.personId.trim())
    ) {
      invalidReassignmentIssueIds.push(issue.issueId);
    }
  }

  return {
    ok: unresolvedIssueIds.length === 0 && invalidReassignmentIssueIds.length === 0,
    unresolvedIssueIds,
    invalidReassignmentIssueIds,
  };
}

/** Convierte el plan visible en el contrato inmutable de la capa de importación. */
export function createMediaImportRepairs(
  issues: readonly OrphanMediaImportIssue[],
  plan: Readonly<ImportReviewPlan>
): MediaImportRepair[] {
  const repairs: MediaImportRepair[] = [];
  for (const issue of issues) {
    const resolution = plan[issue.issueId];
    if (!resolution) continue;
    repairs.push(resolution.action === "omit"
      ? { issueId: issue.issueId, action: "omit" }
      : {
          issueId: issue.issueId,
          action: "reassign",
          personId: resolution.personId.trim(),
        });
  }
  return repairs;
}

export function buildImportReviewCandidateOptions(
  candidates: readonly MediaImportPersonCandidate[]
): CandidateOption[] {
  return candidates.map((candidate) => {
    const context = candidate.contexts.join("; ") || "sin contexto de gobierno";
    return {
      value: candidate.personId,
      name: candidate.name,
      context,
      label: `${candidate.name} · PersonID «${candidate.personId}» · ${context}`,
      keywords: [candidate.personId, candidate.name, ...candidate.contexts],
    };
  });
}

function mediaKindLabel(issue: OrphanMediaImportIssue): string {
  return issue.kind === "uploaded-file" ? "archivo subido" : "URL externa";
}

function issueSource(issue: OrphanMediaImportIssue): string {
  return issue.url ?? issue.sourceUrl ?? issue.packagePath ?? issue.fileName ?? "(sin fuente)";
}

function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function ImportReviewDialog({
  open,
  fileName,
  review,
  resolutionError,
  isApplying = false,
  onApply,
  onCancel,
}: ImportReviewDialogProps) {
  const baseId = React.useId();
  const issueSignature = review.issues.map((issue) => issue.issueId).join("|");
  const [plan, setPlan] = React.useState<ImportReviewPlan>({});
  const options = React.useMemo(
    () => buildImportReviewCandidateOptions(review.candidates),
    [review.candidates]
  );
  const validation = React.useMemo(
    () => validateImportReviewPlan(review.issues, review.candidates, plan),
    [plan, review.candidates, review.issues]
  );

  React.useEffect(() => {
    setPlan({});
  }, [issueSignature]);

  const updateResolution = (issueId: string, resolution: IssueResolution) => {
    setPlan((current) => ({ ...current, [issueId]: resolution }));
  };

  const pendingCount =
    validation.unresolvedIssueIds.length +
    validation.invalidReassignmentIssueIds.length;

  const apply = async () => {
    if (!validation.ok || isApplying) return;
    await onApply(createMediaImportRepairs(review.issues, plan));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isApplying) onCancel();
      }}
    >
      <DialogContent
        aria-busy={isApplying}
        className="max-h-[92vh] w-[min(960px,96vw)] max-w-none overflow-y-auto rounded-[3px] border-slate-800 bg-slate-950 text-slate-50"
      >
        <DialogHeader>
          <DialogTitle>Revisar incidencias de la importación</DialogTitle>
          <DialogDescription className="pr-8 text-base text-slate-300">
            {review.summary} El conjunto actual no se sustituirá hasta resolver todas
            las incidencias y validar de nuevo el archivo.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-[3px] border border-slate-800 bg-slate-900/40 p-4 text-sm">
          <div className="text-slate-400">Archivo seleccionado</div>
          <div className="break-all font-mono text-slate-100">{fileName}</div>
          <p className="mt-2 text-slate-300">
            Puede omitir cada medio o reasignarlo expresamente a una ficha del propio
            paquete. También puede cancelar y restaurar la fila ausente en el archivo
            de origen. No se elegirá ningún personaje automáticamente.
          </p>
        </div>

        <fieldset disabled={isApplying} aria-disabled={isApplying} className="contents">
          <div className="space-y-4">
            {review.issues.map((issue, index) => {
              const resolution = plan[issue.issueId];
              const source = issueSource(issue);
              const externalUrl = safeExternalUrl(source);
              const actionName = `${baseId}-issue-${index}`;
              const invalid = validation.invalidReassignmentIssueIds.includes(issue.issueId);

              return (
                <section
                  key={issue.issueId}
                  className="rounded-[3px] border border-red-400/30 bg-slate-900/50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium text-slate-100">
                      Incidencia {index + 1}: PersonID inexistente
                    </h3>
                    <span className="rounded-[3px] border border-red-400/30 px-2 py-0.5 text-xs text-red-200">
                      bloqueante
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    El medio {issue.mediaIndex + 1} hace referencia al PersonID «{issue.personId}»,
                    pero no existe ninguna fila importada con ese identificador.
                  </p>
                  <dl className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-slate-400">Archivo interno</dt><dd className="font-mono">datos.json</dd></div>
                    <div><dt className="text-slate-400">Ruta JSON</dt><dd className="break-all font-mono">{issue.jsonPath}</dd></div>
                    <div><dt className="text-slate-400">Identificador del medio</dt><dd className="break-all font-mono">{issue.mediaId}</dd></div>
                    <div><dt className="text-slate-400">Tipo</dt><dd>{mediaKindLabel(issue)}</dd></div>
                    {issue.title ? <div><dt className="text-slate-400">Título</dt><dd>{issue.title}</dd></div> : null}
                    <div className="sm:col-span-2">
                      <dt className="text-slate-400">Fuente</dt>
                      <dd className="break-all">
                        {externalUrl ? (
                          <a className="text-emerald-300 underline" href={externalUrl} target="_blank" rel="noopener noreferrer">{source}</a>
                        ) : source}
                      </dd>
                    </div>
                  </dl>

                  <fieldset className="mt-4 space-y-3 border-t border-slate-800 pt-4">
                    <legend className="mb-2 text-sm font-medium text-slate-200">
                      Decisión para esta incidencia
                    </legend>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name={actionName}
                        checked={resolution?.action === "omit"}
                        onChange={() => updateResolution(issue.issueId, { action: "omit" })}
                      />
                      <span><span className="block font-medium">Omitir este medio</span><span className="text-slate-400">No formará parte del conjunto importado.</span></span>
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name={actionName}
                        checked={resolution?.action === "reassign"}
                        onChange={() => updateResolution(issue.issueId, { action: "reassign", personId: "" })}
                      />
                      <span><span className="block font-medium">Reasignar a un personaje importado</span><span className="text-slate-400">Seleccione conscientemente la ficha correcta.</span></span>
                    </label>
                    {resolution?.action === "reassign" ? (
                      <div className="space-y-1 sm:pl-6">
                        <span className="text-sm font-medium text-slate-300">Personaje de destino</span>
                        <Combobox<CandidateOption>
                          value={resolution.personId}
                          onValueChange={(personId) => updateResolution(issue.issueId, { action: "reassign", personId })}
                          options={options}
                          placeholder="Seleccione un personaje"
                          searchPlaceholder="Buscar por nombre, PersonID, reino o año"
                          emptyMessage="No hay personajes coincidentes"
                          renderOption={(option) => (
                            <span><span className="block font-medium">{option.name} · PersonID «{option.value}»</span><span className="block text-xs text-slate-400">{option.context}</span></span>
                          )}
                        />
                        {invalid ? <span role="alert" className="block text-sm text-red-200">Seleccione un personaje del paquete.</span> : null}
                      </div>
                    ) : null}
                  </fieldset>
                </section>
              );
            })}
          </div>

          <p role="status" aria-live="polite" className="rounded-[3px] border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-200">
            {validation.ok
              ? "Todas las incidencias tienen una decisión válida."
              : `${pendingCount} ${pendingCount === 1 ? "incidencia pendiente" : "incidencias pendientes"} de resolver.`}
          </p>
          {resolutionError ? (
            <p role="alert" className="rounded-[3px] border border-red-500/60 bg-red-950/30 p-3 text-sm text-red-200">
              {resolutionError} Revise las decisiones o cancele para corregir el archivo de origen.
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="secondary" disabled={isApplying} onClick={onCancel}>
              Cancelar importación
            </Button>
            <Button type="button" disabled={!validation.ok || isApplying} onClick={() => void apply()}>
              {isApplying ? "Importando…" : "Importar con correcciones"}
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}
