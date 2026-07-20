import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EditorDialog } from "./editors";
import type { RawRow } from "../../lib/types";

const personalDraft: RawRow = {
  PersonID: "alfonso",
  "Nombre principal": "Alfonso X",
  Descripción: "**El Sabio**",
  "Información verificada": "sí",
};

const governmentRows: RawRow[] = [
  {
    _rowId: "alfonso-leon",
    ID: "alfonso-leon",
    PersonID: "alfonso",
    Reino: "Reino de León",
  },
  {
    _rowId: "alfonso-castilla",
    ID: "alfonso-castilla",
    PersonID: "alfonso",
    Reino: "Reino de Castilla",
  },
];

const commonProps = {
  open: true,
  setOpen: vi.fn(),
  setDraft: vi.fn(),
  setDraftPersonRows: vi.fn(),
  commitDraft: vi.fn(),
  setError: vi.fn(),
};

describe("EditorDialog", () => {
  it("integra Markdown y todos los gobiernos en el editor de personaje", () => {
    const html = renderToStaticMarkup(
      <EditorDialog
        {...commonProps}
        mode="person"
        draft={personalDraft}
        draftPersonRows={governmentRows}
        draftPersonId="alfonso"
        draftRowId={null}
      />
    );

    expect(html).toContain("Admite Markdown por sintaxis");
    expect(html).toContain("Copiar contenido");
    expect(html).toContain("Datos completos del personaje (Edición JSON)");
    expect(html).toContain("Reino de León");
    expect(html).toContain("Reino de Castilla");
    expect(html).toContain("Esc: cancelar · Ctrl+G: guardar sin cerrar");
  });

  it("conserva el editor JSON completo del gobierno", () => {
    const html = renderToStaticMarkup(
      <EditorDialog
        {...commonProps}
        mode="row"
        draft={governmentRows[0]}
        draftPersonRows={[]}
        draftPersonId="alfonso"
        draftRowId="alfonso-leon"
      />
    );

    expect(html).toContain("Fila completa (Edición JSON)");
    expect(html).toContain("Copiar JSON");
    expect(html).toContain("Reino de León");
    expect(html).toContain("Esc: cancelar · Ctrl+G: guardar sin cerrar");
  });

  it("señala los años incoherentes y ofrece corregirlos con confirmación", () => {
    const html = renderToStaticMarkup(
      <EditorDialog
        {...commonProps}
        mode="row"
        draft={{
          ...governmentRows[0],
          "Inicio del reinado (año)": 900,
          "Final del reinado (año)": "",
          "Inicio Reinado (Fecha)": "agosto de 925",
          "Fin Reinado (Fecha)": "18 de junio de 930",
        }}
        draftPersonRows={[]}
        draftPersonId="alfonso"
        draftRowId="alfonso-leon"
      />
    );

    expect(html).toContain("value=\"900\"");
    expect(html).toContain("La fecha de inicio contiene el año 925");
    expect(html).toContain("La fecha de final contiene el año 930");
    expect(html).toContain("usar 925");
    expect(html).toContain("usar 930");
    expect(html.match(/aria-invalid="true"/g)).toHaveLength(2);
    expect(html).toContain("Corrija el año o acepte expresamente la propuesta antes de guardar.");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>guardar<\/button>/);
  });
});
