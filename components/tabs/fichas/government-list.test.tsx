import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { computeDerivedRow } from "../../../lib/data";
import { derivePeopleFromRows } from "../../../lib/people";
import { GovernmentList } from "./government-list";

describe("GovernmentList", () => {
  it("destaca moderadamente el reino y las cifras sin aumentar su altura de línea", () => {
    const selectedPerson = derivePeopleFromRows([
      computeDerivedRow({
        ID: "castilla-1",
        _rowId: "castilla-1",
        PersonID: "fernando",
        "Nombre principal": "Fernando Ansúrez",
        Nombre: "Fernando Ansúrez",
        Reino: "Condado de Castilla",
        "Inicio del reinado (año)": 915,
        "Final del reinado (año)": 920,
      }),
    ]).allPeople[0];

    const html = renderToStaticMarkup(
      <GovernmentList
        selectedPerson={selectedPerson}
        successionByRowId={new Map()}
        setSelectedPersonId={vi.fn()}
        openRowEditor={vi.fn()}
        setDeleteTarget={vi.fn()}
        setDeleteOpen={vi.fn()}
      />
    );

    expect(html).toContain("truncate text-[18px] font-medium leading-6 text-slate-50");
    expect(html).toContain("text-[17px] font-medium leading-5");
    expect(html).toContain("text-[15px] font-medium leading-5");
    expect(html).toContain("Condado de Castilla");
    expect(html).toContain("915 - 920");
    expect(html).toContain("5 años");
  });
});
