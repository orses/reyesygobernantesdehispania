
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
import type { Person, RawRow } from "../../lib/types";

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
  people?: Person[];
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
  people = [],
}: EditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl w-[95vw] sm:w-full rounded-[3px] max-h-[90vh] overflow-y-auto bg-slate-950 text-slate-50 border border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">
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
              people={people}
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
  people,
}: {
  draft: RawRow;
  setDraft: React.Dispatch<React.SetStateAction<RawRow | null>>;
  draftPersonId: string | number | null;
  people: Person[];
}) {
  const otherPeople = people
    .filter((p) => String(p.personId) !== String(draftPersonId))
    .slice()
    .sort((a, b) => String(a.nombrePrincipal).localeCompare(String(b.nombrePrincipal), "es"));
  const successionSelectClass =
    "h-10 w-full rounded-[3px] border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100";
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

      <EditorField
        label="Nombre principal"
        value={String(draft["Nombre principal"] ?? "")}
        onChange={upd("Nombre principal")}
        colSpan2
      />

      <div className="space-y-1 md:col-span-2">
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium text-slate-300">
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

      <div className="md:col-span-2 text-xs text-slate-400">
        Sucesión — déjalo en «automático» para calcular predecesor y sucesor por cronología; elige un personaje para forzarlo.
      </div>
      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-300">Predecesor</span>
        <select
          className={successionSelectClass}
          value={String(draft["Predecesor"] ?? "")}
          onChange={(event) => upd("Predecesor")(event.target.value)}
        >
          <option value="">— automático (cronológico) —</option>
          {otherPeople.map((person) => (
            <option key={person.personId} value={String(person.personId)}>
              {person.nombrePrincipal}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-300">Sucesor</span>
        <select
          className={successionSelectClass}
          value={String(draft["Sucesor"] ?? "")}
          onChange={(event) => upd("Sucesor")(event.target.value)}
        >
          <option value="">— automático (cronológico) —</option>
          {otherPeople.map((person) => (
            <option key={person.personId} value={String(person.personId)}>
              {person.nombrePrincipal}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor de gobierno (fila)
// ---------------------------------------------------------------------------

function RowEditorContent({
  draft,
  setDraft,
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
      <EditorField label="Inicio Reinado (Fecha completa)" value={String(draft?.["Inicio Reinado (Fecha)"] ?? "")} onChange={upd("Inicio Reinado (Fecha)")} />
      <EditorField label="Fin Reinado (Fecha completa)" value={String(draft?.["Fin Reinado (Fecha)"] ?? "")} onChange={upd("Fin Reinado (Fecha)")} />

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
// Diálogo de confirmación al cargar datos (reemplaza el contenido actual)
// ---------------------------------------------------------------------------

interface LoadDataDialogProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  file: File | null;
  uploadedCount: number;
  onConfirm: () => void;
}

export function LoadDataDialog({
  open,
  setOpen,
  file,
  uploadedCount,
  onConfirm,
}: LoadDataDialogProps) {
  const name = file?.name ?? "";
  const isZip = name.toLowerCase().endsWith(".zip");
  const willLoseImages = uploadedCount > 0 && !isZip;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg rounded-[3px] bg-slate-950 text-slate-50 border border-slate-800">
        <DialogHeader>
          <DialogTitle>Cargar datos</DialogTitle>
          <DialogDescription className="text-base text-slate-300">
            Vas a importar{" "}
            <span className="font-mono text-slate-100">{name || "(archivo)"}</span>. Esto{" "}
            <span className="font-medium text-slate-100">reemplaza por completo</span> los
            datos y la galería que tienes ahora en la aplicación.
          </DialogDescription>
        </DialogHeader>

        {willLoseImages ? (
          <div className="rounded-[3px] border border-amber-600/50 bg-amber-950/30 p-3 text-sm text-amber-200">
            ⚠️ Tienes <span className="font-medium">{uploadedCount}</span> imagen(es) subida(s)
            que este archivo no contiene (solo el formato <span className="font-medium">ZIP</span> las
            incluye). Si continúas, desaparecerán de la galería. Para conservarlas, cancela y exporta
            antes un «ZIP completo».
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="secondary"
            className="rounded-[3px]"
            onClick={() => setOpen(false)}
          >
            cancelar
          </Button>
          <Button
            variant={willLoseImages ? "destructive" : "default"}
            className="rounded-[3px]"
            onClick={onConfirm}
          >
            cargar y reemplazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
