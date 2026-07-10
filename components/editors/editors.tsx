
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
import { Combobox, type ComboboxOption } from "../ui/combobox";
import { EditorField } from "./editor-field";
import { boolFromVerified, verifiedToText, safeJsonParse } from "../../lib/data";
import {
  buildSuccessionOptions,
  formatSuccessionOptionLabel,
  resolveSuccessionSelectValue,
  successionOptionSearchTerms,
  type SuccessionOption,
} from "../../lib/succession";
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
  draftRowId: string | number | null;
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
  draftRowId,
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
            />
          ) : (
            <RowEditorContent
              draft={draft}
              setDraft={setDraft}
              draftRowId={draftRowId}
              error={error}
              setError={setError}
              people={people}
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

function EditorSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-slate-800 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-medium text-slate-100">{title}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

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
    <div className="space-y-5">
      <EditorSection title="Identidad">
        <EditorField
          label="Nombre principal"
          value={String(draft["Nombre principal"] ?? "")}
          onChange={upd("Nombre principal")}
        />
        <EditorField
          label="Apelativo"
          value={String(draft.Apelativo ?? "")}
          onChange={upd("Apelativo")}
        />
        <EditorField
          label="Dinastía"
          value={String(draft.Dinastía ?? "")}
          onChange={upd("Dinastía")}
        />

        <EditorField
          label="PersonID (solo lectura)"
          value={String(draftPersonId ?? "")}
          readOnly
        />

        <div className="space-y-1">
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium text-slate-300">
              Información verificada
            </Label>
            <button
              type="button"
              className="flex h-10 cursor-pointer items-center gap-2 rounded-[3px] border border-slate-700/60 bg-slate-900/40 px-3"
              onClick={toggleVerified}
            >
              <Checkbox
                checked={boolFromVerified(draft["Información verificada"])}
                className="pointer-events-none"
              />
              <span className="select-none text-sm text-slate-200">
                {verifiedToText(
                  boolFromVerified(draft["Información verificada"])
                )}
              </span>
            </button>
          </div>
        </div>
      </EditorSection>

      <EditorSection title="Nacimiento">
        <EditorField label="Fecha" value={String(draft["Nacimiento (Fecha)"] ?? "")} onChange={upd("Nacimiento (Fecha)")} />
        <EditorField label="Lugar" value={String(draft["Nacimiento (lugar)"] ?? "")} onChange={upd("Nacimiento (lugar)")} />
        <EditorField label="Ciudad" value={String(draft["Nacimiento (ciudad)"] ?? "")} onChange={upd("Nacimiento (ciudad)")} />
        <EditorField label="Provincia" value={String(draft["Nacimiento (provincia)"] ?? "")} onChange={upd("Nacimiento (provincia)")} />
        <EditorField label="País" value={String(draft["Nacimiento (País)"] ?? "")} onChange={upd("Nacimiento (País)")} />
      </EditorSection>

      <EditorSection title="Fallecimiento y enterramiento">
        <EditorField label="Fecha" value={String(draft["Fallecimiento (Fecha)"] ?? "")} onChange={upd("Fallecimiento (Fecha)")} />
        <EditorField label="Lugar" value={String(draft["Fallecimiento (lugar)"] ?? "")} onChange={upd("Fallecimiento (lugar)")} />
        <EditorField label="Ciudad" value={String(draft["Fallecimiento (ciudad)"] ?? "")} onChange={upd("Fallecimiento (ciudad)")} />
        <EditorField label="Provincia" value={String(draft["Fallecimiento (provincia)"] ?? "")} onChange={upd("Fallecimiento (provincia)")} />
        <EditorField label="País" value={String(draft["Fallecimiento (País)"] ?? "")} onChange={upd("Fallecimiento (País)")} />
        <EditorField label="Enterramiento" value={String(draft["Enterramiento"] ?? "")} onChange={upd("Enterramiento")} />
      </EditorSection>

      <EditorSection title="Descripción y enlaces">
        <EditorField label="Descripción" value={String(draft["Descripción"] ?? "")} onChange={upd("Descripción")} multiline colSpan2 />
        <EditorField label="Ficha RAH URL" value={String(draft["Ficha RAH URL"] ?? "")} onChange={upd("Ficha RAH URL")} />
      </EditorSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor de gobierno (fila)
// ---------------------------------------------------------------------------

const AUTOMATIC_SUCCESSION_VALUE = "";

function buildSuccessionComboboxOptions(
  successionOptions: SuccessionOption[]
): ComboboxOption[] {
  return [
    {
      value: AUTOMATIC_SUCCESSION_VALUE,
      label: "— automático (por reino) —",
      keywords: ["automatico", "cronologia", "reino"],
    },
    ...successionOptions.map((option) => ({
      value: option.value,
      label: formatSuccessionOptionLabel(option),
      keywords: successionOptionSearchTerms(option),
    })),
  ];
}

function RowEditorContent({
  draft,
  setDraft,
  draftRowId,
  setError,
  people,
}: {
  draft: RawRow;
  setDraft: React.Dispatch<React.SetStateAction<RawRow | null>>;
  draftRowId: string | number | null;
  error: string | null;
  setError: (v: string | null) => void;
  people: Person[];
}) {
  const currentRowId = String(draftRowId ?? draft?._rowId ?? draft?.ID ?? "").trim();
  const successionOptions = React.useMemo(
    () => buildSuccessionOptions(people, currentRowId),
    [currentRowId, people]
  );
  const successionComboboxOptions = React.useMemo(
    () => buildSuccessionComboboxOptions(successionOptions),
    [successionOptions]
  );
  const successionSelectValue = (key: "Predecesor" | "Sucesor") =>
    resolveSuccessionSelectValue(draft[key], successionOptions, draft.Reino);
  const upd = (key: string) => (value: string) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <EditorField label="PersonID" value={String(draft?.PersonID ?? "")} onChange={upd("PersonID")} />
      <EditorField label="ID (automático)" value={String(draft?.ID || draft?._rowId || "")} readOnly />
      <EditorField label="N.º Reinado" value={String(draft?.["Nº Reinado"] ?? "")} onChange={upd("Nº Reinado")} />
      <EditorField label="Nombre (Regnal)" value={String(draft?.Nombre ?? "")} onChange={upd("Nombre")} />
      <EditorField label="Apelativo" value={String(draft?.Apelativo ?? "")} onChange={upd("Apelativo")} />
      <EditorField label="Reino" value={String(draft?.Reino ?? "")} onChange={upd("Reino")} />
      <EditorField label="Dinastía del reinado" value={String(draft?.Dinastía ?? "")} onChange={upd("Dinastía")} />
      <EditorField label="Tipo de gobierno" value={String(draft?.["Tipo de gobierno"] ?? "")} onChange={upd("Tipo de gobierno")} />
      <EditorField label="Información Verificada" value={String(draft?.["Información verificada"] ?? "")} onChange={upd("Información verificada")} />
      <EditorField label="Inicio del Reinado (Año)" value={String(draft?.["Inicio del reinado (año)"] ?? "")} onChange={upd("Inicio del reinado (año)")} />
      <EditorField label="Final del Reinado (Año)" value={String(draft?.["Final del reinado (año)"] ?? "")} onChange={upd("Final del reinado (año)")} />
      <EditorField label="Inicio Reinado (Fecha completa)" value={String(draft?.["Inicio Reinado (Fecha)"] ?? "")} onChange={upd("Inicio Reinado (Fecha)")} />
      <EditorField label="Fin Reinado (Fecha completa)" value={String(draft?.["Fin Reinado (Fecha)"] ?? "")} onChange={upd("Fin Reinado (Fecha)")} />

      <div className="md:col-span-2 text-xs text-slate-400">
        Sucesión del gobierno: déjalo en «automático» para calcularla por cronología dentro del mismo reino.
      </div>
      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-300">Predecesor</span>
        <Combobox
          value={successionSelectValue("Predecesor")}
          onValueChange={upd("Predecesor")}
          options={successionComboboxOptions}
          placeholder="— automático (por reino) —"
          searchPlaceholder="Buscar por nombre, reino o año"
          emptyMessage="Sin coincidencias"
          clearValue={AUTOMATIC_SUCCESSION_VALUE}
          clearLabel="Usar sucesión automática"
          className="rounded-[3px] border-slate-700/60 bg-slate-900/60 text-base font-medium text-slate-50 focus-visible:ring-offset-slate-950"
        />
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium text-slate-300">Sucesor</span>
        <Combobox
          value={successionSelectValue("Sucesor")}
          onValueChange={upd("Sucesor")}
          options={successionComboboxOptions}
          placeholder="— automático (por reino) —"
          searchPlaceholder="Buscar por nombre, reino o año"
          emptyMessage="Sin coincidencias"
          clearValue={AUTOMATIC_SUCCESSION_VALUE}
          clearLabel="Usar sucesión automática"
          className="rounded-[3px] border-slate-700/60 bg-slate-900/60 text-base font-medium text-slate-50 focus-visible:ring-offset-slate-950"
        />
      </label>

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
