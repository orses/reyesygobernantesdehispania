import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { computeDerivedRow } from "../../../lib/data";
import { derivePeopleFromRows } from "../../../lib/people";
import { buildRailwayModel, type RailwayTransitionCatalog } from "../../../lib/railway";
import { WESTERN_KINGDOMS_RAILWAY_TOPOLOGY } from "../../../lib/railway-topology";
import type { RawRow } from "../../../lib/types";
import {
  findRailwayNavigationTarget,
  railwayCanvasWidth,
  railwayLabelPlacements,
  RailwayView,
} from "./railway-view";

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

const catalog: RailwayTransitionCatalog = {
  schemaVersion: 1,
  version: "prueba",
  transitions: [
    {
      id: "division-alfonso-iii-910",
      kind: "split",
      year: 910,
      from: "Asturias",
      to: ["León", "Galicia"],
      label: "División tras Alfonso III",
    },
    {
      id: "ordono-ii-leon-914",
      kind: "merge",
      year: 914,
      from: ["Galicia", "León"],
      to: "León",
      label: "Ordoño II accede a León",
    },
  ],
  mainlineSegments: [
    {
      id: "asturias-hasta-914",
      kingdom: "Asturias",
      startYear: null,
      endYear: 914,
    },
    {
      id: "leon-desde-914",
      kingdom: "León",
      startYear: 914,
      endYear: null,
    },
  ],
};

function transitionPathCoordinates(html: string, year: number): number[] {
  const tag = html.match(new RegExp(
    `<path[^>]*data-transition-year="${year}"[^>]*>`
  ))?.[0];
  const path = tag?.match(/\sd="([^"]+)"/)?.[1];
  return path?.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
}

describe("RailwayView", () => {
  it("representa vías, estaciones y conectores sin marcadores ni enlaces externos", () => {
    const people = derivePeopleFromRows([
      row("pelayo", "pelayo", "Pelayo", "Reino de Asturias", 718, 737),
      row("alfonso", "alfonso", "Alfonso III", "Reino de Asturias", 866, 910),
      row("garcia", "garcia", "García I", "Reino de León", 910, 914),
      row("ordono", "ordono", "Ordoño II", "Reino de Galicia", 910, 914),
      row("ordono-leon", "ordono", "Ordoño II", "Reino de León", 914, 924),
    ]).allPeople;
    const model = buildRailwayModel(people, { transitionCatalog: catalog });
    const html = renderToStaticMarkup(
      <RailwayView
        projection={model.projection}
        issueCount={model.issues.length}
        selectedPeriodId={null}
        onSelectPeriod={vi.fn()}
      />
    );

    expect(html).toContain("Ferrocarril histórico: 5 gobiernos en 3 entidades");
    expect(html).toContain("Reino de Asturias");
    expect(html).toContain("Pelayo");
    expect(html).toContain("García I");
    expect(html).not.toContain("transición histórica curada");
    expect(html).not.toContain("División tras Alfonso III");
    expect(html).not.toContain("Ordoño II accede a León");
    expect(html).not.toContain("historia-hispanica.rah.es");
    expect(html).not.toContain("target=\"_blank\"");
    expect(html).not.toMatch(/<a\b/i);
    expect(html).not.toContain("href=");
    expect(html).toContain("vía principal de cada etapa");
    expect(html).toContain('data-railway-mainline="true"');
    expect(html).toContain("mismo monarca; los reinos siguen separados");
    expect(html).toContain('data-railway-station="true"');
    expect(html).toContain("Desplazamiento horizontal del ferrocarril histórico");
    expect(html).toContain("Comprimir la escala horizontal");
    expect(html).toContain("Estirar la escala horizontal");
    expect(html).toContain("Ajustar toda la cronología al ancho visible");
    expect(html).toContain("Ampliar el gráfico");
    expect(html).toContain("Ir a una vía concreta");
  });

  it("conecta en el año exacto y hace regresar la vía gallega a León en 914", () => {
    const people = derivePeopleFromRows([
      row("alfonso", "alfonso", "Alfonso III", "Reino de Asturias", 866, 910),
      row("garcia", "garcia", "García I", "Reino de León", 910, 914),
      row("ordono", "ordono", "Ordoño II", "Reino de Galicia", 910, 914),
      row("ordono-leon", "ordono", "Ordoño II", "Reino de León", 914, 924),
    ]).allPeople;
    const model = buildRailwayModel(people, { transitionCatalog: catalog });
    const html = renderToStaticMarkup(
      <RailwayView
        projection={model.projection}
        issueCount={model.issues.length}
        selectedPeriodId={null}
        onSelectPeriod={vi.fn()}
      />
    );

    const splitCoordinates = transitionPathCoordinates(html, 910);
    const mergeCoordinates = transitionPathCoordinates(html, 914);

    expect(splitCoordinates).toHaveLength(8);
    expect(splitCoordinates[0]).toBe(splitCoordinates[6]);
    expect(splitCoordinates[2]).toBeLessThan(splitCoordinates[0]);
    expect(mergeCoordinates).toHaveLength(8);
    expect(mergeCoordinates[0]).toBe(mergeCoordinates[6]);
    expect(mergeCoordinates[2]).toBeGreaterThan(mergeCoordinates[0]);
    expect(mergeCoordinates[1]).toBe(508);
    expect(mergeCoordinates[7]).toBe(324);
    expect(html).toContain('data-source-kingdom="Galicia"');
    expect(html).toContain('data-target-kingdom="León"');
    expect(html).toContain('data-mainline-kingdom="León"');
    expect(html).toContain('data-mainline-start-year="914"');
    expect(html).toContain('aria-label="Ordoño II, Reino de León, 914-924"');
  });

  it("explica el estado vacío cuando se ocultan todos los reinos", () => {
    const people = derivePeopleFromRows([
      row("pelayo", "pelayo", "Pelayo", "Reino de Asturias", 718, 737),
    ]).allPeople;
    const model = buildRailwayModel(people, { selectedKingdoms: [] });
    const html = renderToStaticMarkup(
      <RailwayView
        projection={model.projection}
        issueCount={0}
        selectedPeriodId={null}
        onSelectPeriod={vi.fn()}
      />
    );

    expect(html).toContain("Seleccione al menos una entidad");
  });

  it("explica por qué la unión de 1230 queda sin anclaje castellano", () => {
    const people = derivePeopleFromRows([
      row("berenguela", "berenguela", "Berenguela", "Reino de Castilla", 1217, 1217),
      row("alfonso-ix", "alfonso-ix", "Alfonso IX", "Reino de León", 1188, 1230),
    ]).allPeople;
    const finalUnionCatalog: RailwayTransitionCatalog = {
      schemaVersion: 1,
      version: "prueba-1230",
      transitions: [{
        id: "union-definitiva-1230",
        kind: "dynastic-union",
        year: 1230,
        kingdoms: ["León", "Castilla"],
        label: "Unión dinástica definitiva",
      }],
    };
    const model = buildRailwayModel(people, { transitionCatalog: finalUnionCatalog });
    const html = renderToStaticMarkup(
      <RailwayView
        projection={model.projection}
        issueCount={model.issues.length}
        selectedPeriodId={null}
        onSelectPeriod={vi.fn()}
      />
    );

    expect(html).toContain(
      "No hay un ancla castellana disponible para la transición de 1230 dentro del alcance"
    );
    expect(html).not.toContain("Corona de Castilla");
  });

  it("omite las transiciones que carecen por completo de anclas reales", () => {
    const people = derivePeopleFromRows([
      row("asturias", "asturias", "Gobernante asturiano", "Reino de Asturias", 800, 810),
      row("leon", "leon", "Gobernante leonés", "Reino de León", 1100, 1110),
    ]).allPeople;
    const unanchoredCatalog: RailwayTransitionCatalog = {
      schemaVersion: 1,
      version: "sin-anclas",
      transitions: [{
        id: "transicion-sin-anclas",
        kind: "transformation",
        year: 950,
        from: "Asturias",
        to: "León",
        label: "Esta transición no debe mostrarse",
      }],
    };
    const model = buildRailwayModel(people, { transitionCatalog: unanchoredCatalog });
    const html = renderToStaticMarkup(
      <RailwayView
        projection={model.projection}
        issueCount={model.issues.length}
        selectedPeriodId={null}
        onSelectPeriod={vi.fn()}
      />
    );

    expect(model.network.transitions[0].anchors.every(
      (anchor) => anchor.stationId === null
    )).toBe(true);
    expect(model.projection.transitions).toEqual([]);
    expect(html).not.toContain("Esta transición no debe mostrarse");
  });

  it("navega horizontalmente por la misma vía y verticalmente por proximidad temporal", () => {
    const people = derivePeopleFromRows([
      row("asturias-700", "asturias-700", "Asturiano I", "Reino de Asturias", 700, 710),
      row("asturias-800", "asturias-800", "Asturiano II", "Reino de Asturias", 800, 810),
      row("leon-710", "leon-710", "Leonés I", "Reino de León", 710, 720),
      row("leon-900", "leon-900", "Leonés II", "Reino de León", 900, 910),
      row("galicia-880", "galicia-880", "Gallego I", "Reino de Galicia", 880, 890),
    ]).allPeople;
    const projection = buildRailwayModel(people).projection;
    const kingdoms = projection.tracks.map((track) => track.kingdom);
    const periodId = (rowId: string) =>
      projection.stations.find((station) => station.rowId === rowId)?.periodId ?? "";

    expect(findRailwayNavigationTarget(
      projection.stations,
      kingdoms,
      periodId("asturias-700"),
      "ArrowRight"
    )?.rowId).toBe("asturias-800");
    expect(findRailwayNavigationTarget(
      projection.stations,
      kingdoms,
      periodId("asturias-800"),
      "ArrowDown"
    )?.rowId).toBe("leon-710");
    expect(findRailwayNavigationTarget(
      projection.stations,
      kingdoms,
      periodId("galicia-880"),
      "ArrowUp"
    )?.rowId).toBe("leon-900");
  });

  it("muestra las denominaciones castellanas e hispánicas sin prefijos artificiales", () => {
    const people = derivePeopleFromRows([
      row("castilla", "castilla", "Fernando III", "Reino de Castilla", 1217, 1252),
      row("corona", "corona", "Alfonso X", "Corona de Castilla", 1252, 1284),
      row(
        "monarquia",
        "monarquia",
        "Carlos I",
        "Monarquía Hispánica / España",
        1516,
        1556
      ),
    ]).allPeople;
    const projection = buildRailwayModel(people).projection;
    const html = renderToStaticMarkup(
      <RailwayView
        projection={projection}
        issueCount={0}
        selectedPeriodId={null}
        onSelectPeriod={vi.fn()}
      />
    );

    expect(html).toContain("Reino de Castilla");
    expect(html).toContain("Corona de Castilla");
    expect(html).toContain("Monarquía Hispánica / España");
    expect(html).not.toContain("Reino de Corona de Castilla");
    expect(html).not.toContain("Reino de Monarquía Hispánica");
  });

  it("enlaza el relevo troncal de 1516 sin truncar la Corona de Castilla", () => {
    const people = derivePeopleFromRows([
      row("juana", "juana", "Juana I", "Corona de Castilla", 1504, 1555),
      row(
        "carlos",
        "carlos",
        "Carlos I",
        "Monarquía Hispánica / España",
        1516,
        1556
      ),
    ]).allPeople;
    const model = buildRailwayModel(people, {
      transitionCatalog: WESTERN_KINGDOMS_RAILWAY_TOPOLOGY,
    });
    const html = renderToStaticMarkup(
      <RailwayView
        projection={model.projection}
        issueCount={model.issues.length}
        selectedPeriodId={null}
        onSelectPeriod={vi.fn()}
      />
    );

    expect(model.network.services.find(
      (service) => service.kingdom === "Corona de Castilla"
    )).toMatchObject({ endYear: 1555 });
    expect(html).toContain('data-railway-transition-connector="true"');
    expect(html).toContain('data-transition-kind="integration"');
    expect(html).toContain('data-transition-year="1516"');
    expect(html).toContain('data-source-kingdom="Corona de Castilla"');
    expect(html).toContain('data-target-kingdom="Monarquía Hispánica / España"');
    expect(html).toContain("la etapa anterior puede continuar");
  });

  it("distribuye los rótulos densos en seis franjas y oculta solo el exceso", () => {
    const people = derivePeopleFromRows(
      Array.from({ length: 7 }, (_, index) => row(
        `gobierno-${index}`,
        `persona-${index}`,
        `Gobierno ${index + 1}`,
        "Monarquía Hispánica / España",
        1873,
        1874
      ))
    ).allPeople;
    const projection = buildRailwayModel(people).projection;
    const width = railwayCanvasWidth(projection);
    const placements = [...railwayLabelPlacements(projection, width).values()];

    expect(placements.filter((placement) => placement.isVisible)).toHaveLength(6);
    expect(placements.filter((placement) => !placement.isVisible)).toHaveLength(1);
    expect(new Set(
      placements.filter((placement) => placement.isVisible).map((placement) => placement.level)
    ).size).toBe(6);
    expect(railwayCanvasWidth(projection, 0.25)).toBe(Math.round(width * 0.25));
    expect(railwayCanvasWidth(projection, 4)).toBe(width * 4);
    expect(railwayCanvasWidth(projection, 1, 100)).toBe(271);
  });
});
