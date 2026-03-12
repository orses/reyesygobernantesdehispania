
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { EditorField } from "./editor-field";
import { boolFromVerified, verifiedToText, safeJsonParse } from "../../lib/data";
import type { RawRow } from "../../lib/types";

// ---------------------------------------------------------------------------
// Editor Dialog (persona o gobierno)
// ---------------------------------------------------------------------------

interface EditorDialogProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  mode: "person" | "row";
  draft: RawRow | null;
  setDraft: React.Dispatch<React.SetStateAction<RawRow | null>>;
  draftPersonId: string | number | null;
  commitDraft: () => void;
  error: string | null;
  setError: (v: string | null) => void;
}

export function EditorDialog({
  open,
  setOpen,
  mode,
  draft,
  setDraft,
  draftPersonId,
  commitDraft,
  error,
  setError,
}: EditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl w-[95vw] sm:w-full rounded-[3px] max-h-[90vh] overflow-y-auto bg-slate-950 text-slate-50 border border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {mode === "person" ? "Editar Personaje" : "Editar Gobierno (Fila)"}
          </DialogTitle>
          <DialogDescription className="text-base text-slate-300">
            {mode === "person"
              ? "La edición de personaje aplica a todas las filas con el mismo PersonID."
              : "La edición de gobierno modifica solo una fila específica."}
          </DialogDescription>
        </DialogHeader>

        {draft ? (
          mode === "person" ? (
            <PersonEditorContent
              draft={draft}
              setDraft={setDraft}
              draftPersonId={draftPersonId}
            />
          ) : (
            <RowEditorContent
              draft={draft}
              setDraft={setDraft}
              error={error}
              setError={setError}
            />
          )
        ) : null}

        <DialogFooter>
          <Button
            variant="secondary"
            className="rounded-[3px]"
            onClick={() => setOpen(false)}
          >
            cancelar
          </Button>
          <Button className="rounded-[3px]" onClick={commitDraft}>
            guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Editor de persona
// ---------------------------------------------------------------------------

function PersonEditorContent({
  draft,
  setDraft,
  draftPersonId,
}: {
  draft: RawRow;
  setDraft: React.Dispatch<React.SetStateAction<RawRow | null>>;
  draftPersonId: string | number | null;
}) {
  const toggleVerified = () => {
    const currentBool = boolFromVerified(
      draft["Información verificada"]
    );
    const nextBool = !currentBool;
    setDraft((d) =>
      d ? { ...d, "Información verificada": verifiedToText(nextBool) } : d
    );
  };

  const upd = (key: string) => (value: string) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <EditorField
        label="PersonID (solo lectura)"
        value={String(draftPersonId ?? "")}
        readOnly
        colSpan2
      />

      <div className="space-y-1 md:col-span-2">
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-semibold text-slate-300">
            Información Verificada
          </Label>
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={toggleVerified}
          >
            <Checkbox
              checked={boolFromVerified(draft["Información verificada"])}
              className="pointer-events-none"
            />
            <span className="text-sm text-slate-300 select-none">
              {verifiedToText(
                boolFromVerified(draft["Información verificada"])
              )}
            </span>
          </div>
        </div>
      </div>

      <EditorField label="Nacimiento (Fecha)" value={String(draft["Nacimiento (Fecha)"] ?? "")} onChange={upd("Nacimiento (Fecha)")} />
      <EditorField label="Nacimiento (Lugar)" value={String(draft["Nacimiento (lugar)"] ?? "")} onChange={upd("Nacimiento (lugar)")} />
      <EditorField label="Nacimiento (Ciudad)" value={String(draft["Nacimiento (ciudad)"] ?? "")} onChange={upd("Nacimiento (ciudad)")} />
      <EditorField label="Nacimiento (Provincia)" value={String(draft["Nacimiento (provincia)"] ?? "")} onChange={upd("Nacimiento (provincia)")} />
      <EditorField label="Nacimiento (País)" value={String(draft["Nacimiento (País)"] ?? "")} onChange={upd("Nacimiento (País)")} />

      <EditorField label="Fallecimiento (Fecha)" value={String(draft["Fallecimiento (Fecha)"] ?? "")} onChange={upd("Fallecimiento (Fecha)")} />
      <EditorField label="Fallecimiento (Lugar)" value={String(draft["Fallecimiento (lugar)"] ?? "")} onChange={upd("Fallecimiento (lugar)")} />
      <EditorField label="Fallecimiento (Ciudad)" value={String(draft["Fallecimiento (ciudad)"] ?? "")} onChange={upd("Fallecimiento (ciudad)")} />
      <EditorField label="Fallecimiento (Provincia)" value={String(draft["Fallecimiento (provincia)"] ?? "")} onChange={upd("Fallecimiento (provincia)")} />
      <EditorField label="Fallecimiento (País)" value={String(draft["Fallecimiento (País)"] ?? "")} onChange={upd("Fallecimiento (País)")} />

      <EditorField label="Enterramiento" value={String(draft["Enterramiento"] ?? "")} onChange={upd("Enterramiento")} colSpan2 />
      <EditorField label="Descripción" value={String(draft["Descripción"] ?? "")} onChange={upd("Descripción")} multiline colSpan2 />
      <EditorField label="Imagen URL" value={String(draft["Imagen URL"] ?? "")} onChange={upd("Imagen URL")} />
      <EditorField label="Ficha RAH URL" value={String(draft["Ficha RAH URL"] ?? "")} onChange={upd("Ficha RAH URL")} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor de gobierno (fila)
// ---------------------------------------------------------------------------

function RowEditorContent({
  draft,
  setDraft,
  error,
  setError,
}: {
  draft: RawRow;
  setDraft: React.Dispatch<React.SetStateAction<RawRow | null>>;
  error: string | null;
  setError: (v: string | null) => void;
}) {
  const upd = (key: string) => (value: string) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <EditorField label="PersonID" value={String(draft?.PersonID ?? "")} onChange={upd("PersonID")} />
      <EditorField label="ID" value={String(draft?.ID ?? "")} onChange={upd("ID")} />
      <EditorField label="N.º Reinado" value={String(draft?.["Nº Reinado"] ?? "")} onChange={upd("Nº Reinado")} />
      <EditorField label="Nombre (Regnal)" value={String(draft?.Nombre ?? "")} onChange={upd("Nombre")} />
      <EditorField label="Apelativo" value={String(draft?.Apelativo ?? "")} onChange={upd("Apelativo")} />
      <EditorField label="Reino" value={String(draft?.Reino ?? "")} onChange={upd("Reino")} />
      <EditorField label="Dinastía" value={String(draft?.Dinastía ?? "")} onChange={upd("Dinastía")} />
      <EditorField label="Tipo de gobierno" value={String(draft?.["Tipo de gobierno"] ?? "")} onChange={upd("Tipo de gobierno")} />
      <EditorField label="Información Verificada" value={String(draft?.["Información verificada"] ?? "")} onChange={upd("Información verificada")} />
      <EditorField label="Inicio del Reinado (Año)" value={String(draft?.["Inicio del reinado (año)"] ?? "")} onChange={upd("Inicio del reinado (año)")} />
      <EditorField label="Final del Reinado (Año)" value={String(draft?.["Final del reinado (año)"] ?? "")} onChange={upd("Final del reinado (año)")} />

      <details className="md:col-span-2">
        <summary className="cursor-pointer text-sm text-slate-300">
          Fila Completa (Edición JSON)
        </summary>
        <div className="mt-2 space-y-2">
          <div className="text-sm text-slate-300">
            Edite el objeto completo. Si el JSON no es válido, no se guardará.
          </div>
          <Textarea
            className="rounded-[3px] min-h-[160px] font-mono text-sm bg-slate-900/60 text-slate-50 placeholder:text-slate-400 border border-slate-700/60 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            value={JSON.stringify(draft, null, 2)}
            onChange={(e) => {
              const parsed = safeJsonParse(e.target.value);
              if (!parsed.ok) {
                setError(
                  `JSON inválido en editor avanzado: ${parsed.error}`
                );
                return;
              }
              setError(null);
              setDraft(parsed.value as RawRow);
            }}
          />
        </div>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diálogo de eliminación
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  target: { kind: string; id: string | number | null };
  removeTarget: () => void;
}

export function DeleteDialog({
  open,
  setOpen,
  target,
  removeTarget,
}: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg rounded-[3px] bg-slate-950 text-slate-50 border border-slate-800">
        <DialogHeader>
          <DialogTitle>Eliminar</DialogTitle>
          <DialogDescription>
            Esta acción elimina registros del estado en memoria. Para persistir,
            exporte después el JSON.
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm">
          {target.kind === "person" ? (
            <>
              ¿Eliminar el personaje PersonID{" "}
              <span className="font-mono">
                {String(target.id ?? "")}
              </span>{" "}
              (todas sus filas)?
            </>
          ) : (
            <>
              ¿Eliminar la fila{" "}
              <span className="font-mono">
                {String(target.id ?? "")}
              </span>
              ?
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            className="rounded-[3px]"
            onClick={() => setOpen(false)}
          >
            cancelar
          </Button>
          <Button
            variant="destructive"
            className="rounded-[3px]"
            onClick={removeTarget}
          >
            eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
