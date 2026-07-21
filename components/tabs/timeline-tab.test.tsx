import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useAppContext } from "../../context/AppContext";
import { computeDerivedRow } from "../../lib/data";
import { derivePeopleFromRows } from "../../lib/people";
import { buildRailwayModel } from "../../lib/railway";
import { WESTERN_KINGDOMS_RAILWAY_TOPOLOGY } from "../../lib/railway-topology";
import type { FilterState, RawRow } from "../../lib/types";
import { TimelineTab } from "./timeline-tab";

vi.mock("../../context/AppContext", () => ({
  useAppContext: vi.fn(),
}));

const filters: FilterState = {
  query: "",
  filterReino: "__all__",
  filterDinastia: "__all__",
  filterSiglo: "__all__",
  filterDinastiaLocked: false,
  sortKey: "cronologia",
  sortDir: "asc",
};

function row(
  rowId: string,
  personId: string,
  name: string,
  kingdom: string,
  startYear: number,
  endYear: number
): RawRow {
  return computeDerivedRow({
    _rowId: rowId,
    PersonID: personId,
    "Nombre principal": name,
    Nombre: name,
    Reino: kingdom,
    "Inicio del reinado (año)": startYear,
    "Final del reinado (año)": endYear,
  });
}

describe("TimelineTab", () => {
  it("cuenta las incidencias seleccionadas aunque su reino no tenga estaciones", () => {
    const people = derivePeopleFromRows([
      row("alfonso-iii", "alfonso-iii", "Alfonso III", "Reino de Asturias", 866, 910),
      row("fruela-ii", "fruela-ii", "Fruela II", "Reino de Asturias", 910, 924),
      row("garcia-i", "garcia-i", "García I", "Reino de León", 910, 914),
    ]).allPeople;
    const railwayModel = buildRailwayModel(people, {
      transitionCatalog: WESTERN_KINGDOMS_RAILWAY_TOPOLOGY,
    });

    vi.mocked(useAppContext).mockReturnValue({
      allPeople: people,
      people,
      selectedPerson: null,
      filters,
    } as ReturnType<typeof useAppContext>);

    const html = renderToStaticMarkup(<TimelineTab />);

    expect(railwayModel.network.tracks.map((track) => track.kingdom)).not.toContain("Galicia");
    expect(railwayModel.issues.some((issue) => issue.kingdom === "Galicia")).toBe(true);
    expect(html).toContain(
      `${railwayModel.issues.length} ${railwayModel.issues.length === 1
        ? "anclaje incompleto"
        : "anclajes incompletos"}`
    );
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*Ferrocarril/s);
    expect(html).toContain("Periodos");
  });
});
