import { describe, expect, it } from "vitest";
import { computeDerivedRow } from "./data";
import { derivePeopleFromRows } from "./people";
import {
  RAILWAY_KINGDOMS,
  buildRailwayModel,
  normalizeRailwayKingdom,
  projectRailwayNetwork,
  type RailwayTransitionCatalog,
  type RailwayTransitionDefinition,
} from "./railway";
import type { Person, RawRow } from "./types";

function makeRow(values: RawRow, index: number): RawRow {
  return computeDerivedRow({
    _rowId: values._rowId ?? `row-${index + 1}`,
    "Información verificada": "sí",
    ...values,
  }) as RawRow;
}

function peopleFromRows(rows: RawRow[]): Person[] {
  return derivePeopleFromRows(rows.map((row, index) => makeRow(row, index))).allPeople;
}

function government(
  rowId: string,
  personId: string,
  kingdom: string,
  startYear: number,
  endYear: number | ""
): RawRow {
  return {
    _rowId: rowId,
    PersonID: personId,
    "Nombre principal": personId,
    Nombre: personId,
    Reino: kingdom,
    "Inicio del reinado (año)": startYear,
    "Final del reinado (año)": endYear,
  };
}

function catalog(
  transitions: readonly RailwayTransitionDefinition[],
  version = "2026-07-21"
): RailwayTransitionCatalog {
  return { schemaVersion: 1, version, transitions };
}

function mainlineCatalog(): RailwayTransitionCatalog {
  return {
    schemaVersion: 1,
    version: "troncal-de-prueba",
    transitions: [],
    mainlineSegments: [
      {
        id: "asturias-hasta-914",
        kingdom: "Asturias",
        startYear: null,
        endYear: 914,
      },
      {
        id: "leon-914-1066",
        kingdom: "León",
        startYear: 914,
        endYear: 1066,
        label: "León conduce el relato",
      },
      {
        id: "castilla-desde-1066",
        kingdom: "Castilla",
        startYear: 1066,
        endYear: null,
      },
    ],
  };
}

describe("normalización de los reinos ferroviarios", () => {
  it("mantiene exactamente los cuatro reinos canónicos de la primera versión", () => {
    expect(RAILWAY_KINGDOMS).toEqual(["Asturias", "León", "Galicia", "Castilla"]);
  });

  it("admite alias completos normalizados, pero no condados, coronas ni coincidencias parciales", () => {
    expect(normalizeRailwayKingdom("  REINO   DE LEÓN ")).toBe("León");
    expect(normalizeRailwayKingdom("Reino de Leo\u0301n")).toBe("León");
    expect(normalizeRailwayKingdom("galicia")).toBe("Galicia");
    expect(normalizeRailwayKingdom("Reino de CASTILLA")).toBe("Castilla");
    expect(normalizeRailwayKingdom("Condado de Castilla")).toBeNull();
    expect(normalizeRailwayKingdom("Corona de Castilla")).toBeNull();
    expect(normalizeRailwayKingdom("Reino de Castilla y León")).toBeNull();

    const people = peopleFromRows([
      government("leon", "leon", " REINO  DE LEÓN ", 900, 910),
      government("galicia", "galicia", "Galicia", 910, 920),
      government("castilla", "castilla", "reino de castilla", 920, 930),
      government("condado", "conde", "Condado de Castilla", 930, 940),
      government("corona", "reina", "Corona de Castilla", 940, 950),
    ]);

    const model = buildRailwayModel(people);

    expect(model.network.stations.map((station) => station.rowId)).toEqual([
      "leon",
      "galicia",
      "castilla",
    ]);
  });
});

describe("estaciones, vías y servicios", () => {
  it("representa a Pelayo como una sola estación sobre un único raíl de Asturias", () => {
    const people = peopleFromRows([
      government("ast-pelayo", "pelayo", "Reino de Asturias", 718, 737),
    ]);

    const model = buildRailwayModel(people);

    expect(model.network.tracks).toEqual([{
      id: "track:asturias",
      kingdom: "Asturias",
      stationIds: ["station:ast-pelayo"],
      serviceIds: ["service:asturias:ast-pelayo--ast-pelayo"],
    }]);
    expect(model.network.services).toHaveLength(1);
    expect(model.network.stations[0]).toMatchObject({
      rowId: "ast-pelayo",
      personId: "pelayo",
      kingdom: "Asturias",
      startYear: 718,
      endYear: 737,
    });
    expect(model.network.scale.minYear).toBeLessThan(718);
    expect(model.network.scale.maxYear).toBeGreaterThan(737);
  });

  it("con solo Pelayo no prolonga el raíl ni proyecta sucesos de siglos posteriores", () => {
    const people = peopleFromRows([
      government("ast-pelayo", "pelayo", "Reino de Asturias", 718, 737),
    ]);
    const model = buildRailwayModel(people, {
      transitionCatalog: catalog([{
        id: "division-910",
        kind: "split",
        year: 910,
        from: "Asturias",
        to: ["León", "Galicia"],
      }]),
    });

    expect(model.network.transitions).toHaveLength(1);
    expect(model.network.transitions[0].isAnchored).toBe(false);
    expect(model.network.services).toEqual([
      expect.objectContaining({ startYear: 718, endYear: 737 }),
    ]);
    expect(model.projection.transitions).toEqual([]);
    expect(model.issues).toEqual([]);
    expect(model.unrepresentedIssues).toHaveLength(3);
    expect(model.projection.scale).toBe(model.network.scale);
  });

  it("usa cada gobierno y su rowId como estación, aunque la persona sea la misma", () => {
    const people = peopleFromRows([
      government("alfonso-leon-1", "alfonso", "Reino de León", 1065, 1072),
      government("alfonso-leon-2", "alfonso", "León", 1072, 1073),
    ]);

    const model = buildRailwayModel(people);

    expect(model.network.stations.map((station) => station.id)).toEqual([
      "station:alfonso-leon-1",
      "station:alfonso-leon-2",
    ]);
    expect(new Set(model.network.stations.map((station) => station.personId))).toEqual(
      new Set(["alfonso"])
    );
  });

  it("une gobiernos contiguos con un año de tolerancia y conserva los huecos de Galicia", () => {
    const people = peopleFromRows([
      government("gal-1", "ordono", "Reino de Galicia", 910, 914),
      government("gal-2", "fruela", "Galicia", 915, 916),
      government("gal-3", "sancho", "Reino de Galicia", 920, 924),
      government("gal-4", "garcia", "Reino de Galicia", 924, 930),
    ]);

    const model = buildRailwayModel(people);
    const track = model.network.tracks[0];

    expect(track.kingdom).toBe("Galicia");
    expect(track.stationIds).toHaveLength(4);
    expect(model.network.services.map((service) => service.stationIds)).toEqual([
      ["station:gal-1", "station:gal-2"],
      ["station:gal-3", "station:gal-4"],
    ]);
    expect(model.network.services.map((service) => [service.startYear, service.endYear])).toEqual([
      [910, 916],
      [920, 930],
    ]);
  });

  it("no prolonga un final desconocido hasta el siguiente gobierno", () => {
    const people = peopleFromRows([
      government("gal-open", "abierto", "Galicia", 930, ""),
      government("gal-late", "posterior", "Galicia", 940, 945),
    ]);

    const model = buildRailwayModel(people);

    expect(model.network.services).toHaveLength(2);
    expect(model.network.services[0]).toMatchObject({ startYear: 930, endYear: 930 });
    expect(model.timelineIssues).toContainEqual(expect.objectContaining({
      kind: "missing-end",
      rowId: "gal-open",
    }));
  });
});

describe("transiciones políticas explícitas", () => {
  it("no infiere una bifurcación 1:N y solo la crea al recibir el catálogo versionado", () => {
    const people = peopleFromRows([
      government("ast-last", "alfonso-ast", "Asturias", 900, 910),
      government("leon-first", "garcia-leon", "León", 910, 920),
      government("gal-first", "ordono-gal", "Galicia", 910, 920),
    ]);
    const withoutCatalog = buildRailwayModel(people);
    const withCatalog = buildRailwayModel(people, {
      transitionCatalog: catalog([{
        id: "division-910",
        kind: "split",
        year: 910,
        from: "Asturias",
        to: ["Galicia", "León"],
        label: "División política de 910",
      }]),
    });

    expect(withoutCatalog.network.transitions).toEqual([]);
    expect(withCatalog.network.catalogVersion).toBe("2026-07-21");
    expect(withCatalog.network.transitions[0]).toMatchObject({
      id: "transition:2026-07-21:division-910",
      kind: "split",
      year: 910,
      isAnchored: true,
    });
    expect(withCatalog.network.transitions[0].anchors).toEqual([
      {
        role: "source",
        kingdom: "Asturias",
        stationId: "station:ast-last",
        anchorYear: 910,
        distanceYears: 0,
      },
      {
        role: "target",
        kingdom: "León",
        stationId: "station:leon-first",
        anchorYear: 910,
        distanceYears: 0,
      },
      {
        role: "target",
        kingdom: "Galicia",
        stationId: "station:gal-first",
        anchorYear: 910,
        distanceYears: 0,
      },
    ]);
    expect(withCatalog.issues).toEqual([]);
  });

  it("resuelve una unificación N:1 sin fusionar las estaciones de origen", () => {
    const people = peopleFromRows([
      government("leon-last", "alfonso-leon", "León", 1065, 1072),
      government("gal-last", "alfonso-gal", "Galicia", 1065, 1072),
      government("cast-first", "sancho-cast", "Castilla", 1072, 1080),
    ]);
    const model = buildRailwayModel(people, {
      transitionCatalog: catalog([{
        id: "union-1072",
        kind: "merge",
        year: 1072,
        from: ["Galicia", "León"],
        to: "Castilla",
      }]),
    });

    expect(model.network.transitions[0].anchors.map((anchor) => [
      anchor.role,
      anchor.kingdom,
      anchor.stationId,
    ])).toEqual([
      ["source", "León", "station:leon-last"],
      ["source", "Galicia", "station:gal-last"],
      ["target", "Castilla", "station:cast-first"],
    ]);
    expect(model.network.tracks.map((track) => track.kingdom)).toEqual([
      "León",
      "Galicia",
      "Castilla",
    ]);
  });

  it("acepta transformación, restauración y unión dinástica sin deducirlas de la cronología", () => {
    const people = peopleFromRows([
      government("ast-last", "astur", "Asturias", 900, 910),
      government("leon-first", "leones", "León", 910, 940),
      government("gal-old", "gallego-antiguo", "Galicia", 910, 920),
      government("gal-new", "gallego-restaurado", "Galicia", 930, 940),
      government("cast", "castellano", "Castilla", 920, 940),
    ]);
    const model = buildRailwayModel(people, {
      transitionAnchorToleranceYears: 5,
      transitionCatalog: catalog([
        {
          id: "transformacion-910",
          kind: "transformation",
          year: 910,
          from: "Asturias",
          to: "León",
        },
        {
          id: "restauracion-gallega-925",
          kind: "restoration",
          year: 925,
          kingdom: "Galicia",
        },
        {
          id: "union-dinastica-935",
          kind: "dynastic-union",
          year: 935,
          kingdoms: ["Castilla", "Galicia"],
        },
      ]),
    });

    expect(model.network.transitions.map((transition) => transition.kind)).toEqual([
      "transformation",
      "restoration",
      "dynastic-union",
    ]);
    expect(model.network.transitions.every((transition) => transition.isAnchored)).toBe(true);
    expect(model.network.transitions[1].anchors).toEqual([
      {
        role: "source",
        kingdom: "Galicia",
        stationId: "station:gal-old",
        anchorYear: 920,
        distanceYears: 5,
      },
      {
        role: "target",
        kingdom: "Galicia",
        stationId: "station:gal-new",
        anchorYear: 930,
        distanceYears: 5,
      },
    ]);
    expect(model.network.transitions[2].anchors.map((anchor) => anchor.role)).toEqual([
      "participant",
      "participant",
    ]);
  });

  it("registra una incidencia cuando falta un ancla próxima", () => {
    const people = peopleFromRows([
      government("ast-last", "astur", "Asturias", 900, 910),
      government("leon-first", "leones", "León", 910, 920),
      government("cast-far", "castellano", "Castilla", 1000, 1010),
    ]);
    const model = buildRailwayModel(people, {
      transitionAnchorToleranceYears: 2,
      transitionCatalog: catalog([{
        id: "division-incompleta",
        kind: "split",
        year: 910,
        from: "Asturias",
        to: ["León", "Castilla"],
      }]),
    });

    expect(model.network.transitions[0].isAnchored).toBe(false);
    expect(model.network.transitions[0].anchors).toContainEqual({
      role: "target",
      kingdom: "Castilla",
      stationId: null,
      anchorYear: null,
      distanceYears: null,
    });
    expect(model.issues).toEqual([expect.objectContaining({
      kind: "missing-transition-anchor",
      severity: "warning",
      transitionDefinitionId: "division-incompleta",
      role: "target",
      kingdom: "Castilla",
    })]);
    expect(model.issues[0].message).toContain("2 años o menos de 910");
  });

  it("incluye en el dominio el año de una transición representable por tolerancia", () => {
    const people = peopleFromRows([
      government("ast-last", "astur", "Asturias", 900, 910),
    ]);
    const model = buildRailwayModel(people, {
      transitionAnchorToleranceYears: 5,
      transitionCatalog: catalog([{
        id: "division-915",
        kind: "split",
        year: 915,
        from: "Asturias",
        to: ["León"],
      }]),
    });

    expect(model.network.transitions[0].anchors[0]).toMatchObject({
      stationId: "station:ast-last",
      distanceYears: 5,
    });
    expect(model.network.scale.maxYear).toBeGreaterThan(915);
    expect(model.projection.scale).toBe(model.network.scale);
  });
});

describe("topología de los servicios", () => {
  it("corta una vía continua en el año de una bifurcación explícita", () => {
    const people = peopleFromRows([
      government("ast-before", "astur-anterior", "Asturias", 900, 910),
      government("ast-after", "astur-posterior", "Asturias", 910, 920),
      government("leon-first", "leones", "León", 910, 920),
    ]);
    const model = buildRailwayModel(people, {
      transitionCatalog: catalog([{
        id: "division-910",
        kind: "split",
        year: 910,
        from: "Asturias",
        to: ["Asturias", "León"],
      }]),
    });
    const asturiasServices = model.network.services
      .filter((service) => service.kingdom === "Asturias");

    expect(asturiasServices.map((service) => [service.startYear, service.endYear])).toEqual([
      [900, 910],
      [910, 920],
    ]);
    expect(asturiasServices[0].endsAtTransitions).toEqual([
      expect.objectContaining({
        transitionId: "transition:2026-07-21:division-910",
        kind: "split",
        role: "source",
        year: 910,
      }),
    ]);
    expect(asturiasServices[1].startsAtTransitions).toEqual([
      expect.objectContaining({
        transitionId: "transition:2026-07-21:division-910",
        kind: "split",
        role: "target",
        year: 910,
      }),
    ]);
    expect(model.network.services.find((service) => service.kingdom === "León")
      ?.startsAtTransitions).toEqual([
      expect.objectContaining({ kind: "split", role: "target", year: 910 }),
    ]);
  });

  it("descarta el lado posterior de una fuente y el anterior de un destino", () => {
    const people = peopleFromRows([
      government("ast-crossing", "astur", "Asturias", 900, 911),
      government("leon-crossing", "leones", "León", 909, 920),
    ]);
    const model = buildRailwayModel(people, {
      transitionCatalog: catalog([{
        id: "transformacion-910",
        kind: "transformation",
        year: 910,
        from: "Asturias",
        to: "León",
      }]),
    });
    const asturiasServices = model.network.services
      .filter((service) => service.kingdom === "Asturias");
    const leonServices = model.network.services
      .filter((service) => service.kingdom === "León");

    expect(asturiasServices.map((service) => [service.startYear, service.endYear])).toEqual([
      [900, 910],
    ]);
    expect(asturiasServices.some((service) => service.startYear === 910)).toBe(false);
    expect(asturiasServices[0].endsAtTransitions).toEqual([
      expect.objectContaining({ role: "source", year: 910 }),
    ]);
    expect(leonServices.map((service) => [service.startYear, service.endYear])).toEqual([
      [910, 920],
    ]);
    expect(leonServices.some((service) => service.endYear === 910)).toBe(false);
    expect(leonServices[0].startsAtTransitions).toEqual([
      expect.objectContaining({ role: "target", year: 910 }),
    ]);
  });

  it("ajusta como máximo la tolerancia permitida alrededor de una transición", () => {
    const people = peopleFromRows([
      government("ast-last", "astur", "Asturias", 900, 909),
      government("leon-first", "leones", "León", 911, 920),
    ]);
    const model = buildRailwayModel(people, {
      transitionAnchorToleranceYears: 1,
      transitionCatalog: catalog([{
        id: "transformacion-910",
        kind: "transformation",
        year: 910,
        from: "Asturias",
        to: "León",
      }]),
    });

    expect(model.network.services.find((service) => service.kingdom === "Asturias"))
      .toMatchObject({
        startYear: 900,
        endYear: 910,
        endsAtTransitions: [expect.objectContaining({
          kind: "transformation",
          role: "source",
          year: 910,
        })],
      });
    expect(model.network.services.find((service) => service.kingdom === "León"))
      .toMatchObject({
        startYear: 910,
        endYear: 920,
        startsAtTransitions: [expect.objectContaining({
          kind: "transformation",
          role: "target",
          year: 910,
        })],
      });
  });

  it("enlaza una restauración sin rellenar el hiato entre servicios", () => {
    const people = peopleFromRows([
      government("gal-old", "gallego-antiguo", "Galicia", 900, 920),
      government("gal-new", "gallego-restaurado", "Galicia", 930, 940),
    ]);
    const model = buildRailwayModel(people, {
      transitionAnchorToleranceYears: 5,
      transitionCatalog: catalog([{
        id: "restauracion-925",
        kind: "restoration",
        year: 925,
        kingdom: "Galicia",
      }]),
    });
    const services = model.network.services.filter((service) => service.kingdom === "Galicia");

    expect(services.map((service) => [service.startYear, service.endYear])).toEqual([
      [900, 920],
      [930, 940],
    ]);
    expect(services[0].endsAtTransitions).toEqual([
      expect.objectContaining({ kind: "restoration", role: "source", year: 925 }),
    ]);
    expect(services[1].startsAtTransitions).toEqual([
      expect.objectContaining({ kind: "restoration", role: "target", year: 925 }),
    ]);
    expect(services.some((service) => service.startYear <= 925 && service.endYear >= 925)).toBe(false);
  });

  it("segmenta uniones y separaciones dinásticas como participación, no como fusión", () => {
    const people = peopleFromRows([
      government("leon", "rey-leones", "León", 1100, 1160),
      government("castilla", "rey-castellano", "Castilla", 1100, 1160),
    ]);
    const model = buildRailwayModel(people, {
      transitionCatalog: catalog([
        {
          id: "union-1130",
          kind: "dynastic-union",
          year: 1130,
          kingdoms: ["León", "Castilla"],
        },
        {
          id: "separacion-1157",
          kind: "dynastic-separation",
          year: 1157,
          kingdoms: ["León", "Castilla"],
        },
      ]),
    });

    for (const kingdom of ["León", "Castilla"] as const) {
      const services = model.network.services.filter((service) => service.kingdom === kingdom);
      expect(services.map((service) => [service.startYear, service.endYear])).toEqual([
        [1100, 1130],
        [1130, 1157],
        [1157, 1160],
      ]);
      expect(services[0].endsAtTransitions[0]).toMatchObject({
        kind: "dynastic-union",
        role: "participant",
      });
      expect(services[1].startsAtTransitions[0]).toMatchObject({
        kind: "dynastic-union",
        role: "participant",
      });
      expect(services[1].endsAtTransitions[0]).toMatchObject({
        kind: "dynastic-separation",
        role: "participant",
      });
      expect(services[2].startsAtTransitions[0]).toMatchObject({
        kind: "dynastic-separation",
        role: "participant",
      });
    }
    expect(model.network.tracks).toHaveLength(2);
    expect(model.network.transitions.map((transition) => transition.kind)).toEqual([
      "dynastic-union",
      "dynastic-separation",
    ]);
  });

  it("aplica los extremos declarados de una fusión sin unir sus vías de origen", () => {
    const people = peopleFromRows([
      government("leon-last", "leones", "León", 900, 920),
      government("gal-last", "gallego", "Galicia", 900, 920),
      government("cast-first", "castellano", "Castilla", 920, 940),
    ]);
    const model = buildRailwayModel(people, {
      transitionCatalog: catalog([{
        id: "fusion-920",
        kind: "merge",
        year: 920,
        from: ["León", "Galicia"],
        to: "Castilla",
      }]),
    });

    expect(model.network.services
      .filter((service) => service.kingdom !== "Castilla")
      .every((service) => service.endsAtTransitions.some((boundary) =>
        boundary.kind === "merge" && boundary.role === "source"
      ))).toBe(true);
    expect(model.network.services.find((service) => service.kingdom === "Castilla")
      ?.startsAtTransitions).toEqual([
      expect.objectContaining({ kind: "merge", role: "target", year: 920 }),
    ]);
    expect(model.network.tracks).toHaveLength(3);
  });
});

describe("vía troncal narrativa", () => {
  it("no crea un tramo ficticio de duración cero en el año del relevo", () => {
    const people = peopleFromRows([
      government("leon-anterior", "garcia", "León", 910, 914),
    ]);
    const model = buildRailwayModel(people, {
      transitionCatalog: mainlineCatalog(),
    });

    expect(model.network.mainlineSegments).toEqual([]);
  });

  it("recorta cada intervalo contra los servicios sin cubrir los hiatos", () => {
    const people = peopleFromRows([
      government("ast-1", "pelayo", "Asturias", 718, 737),
      government("ast-2", "fruela", "Asturias", 900, 920),
      government("leon-1", "ordono", "León", 910, 1000),
      government("leon-2", "fernando", "León", 1005, 1070),
      government("galicia", "garcia", "Galicia", 910, 930),
      government("castilla", "sancho", "Castilla", 1065, 1080),
    ]);

    const model = buildRailwayModel(people, {
      transitionCatalog: mainlineCatalog(),
    });
    const summary = model.network.mainlineSegments?.map((segment) => ({
      definitionId: segment.definitionId,
      serviceId: segment.serviceId,
      kingdom: segment.kingdom,
      range: [segment.startYear, segment.endYear],
      label: segment.label,
    }));

    expect(summary).toEqual([
      {
        definitionId: "asturias-hasta-914",
        serviceId: "service:asturias:ast-1--ast-1",
        kingdom: "Asturias",
        range: [718, 737],
        label: "Vía troncal de Asturias",
      },
      {
        definitionId: "asturias-hasta-914",
        serviceId: "service:asturias:ast-2--ast-2",
        kingdom: "Asturias",
        range: [900, 914],
        label: "Vía troncal de Asturias",
      },
      {
        definitionId: "leon-914-1066",
        serviceId: "service:leon:leon-1--leon-1",
        kingdom: "León",
        range: [914, 1000],
        label: "León conduce el relato",
      },
      {
        definitionId: "leon-914-1066",
        serviceId: "service:leon:leon-2--leon-2",
        kingdom: "León",
        range: [1005, 1066],
        label: "León conduce el relato",
      },
      {
        definitionId: "castilla-desde-1066",
        serviceId: "service:castilla:castilla--castilla",
        kingdom: "Castilla",
        range: [1066, 1080],
        label: "Vía troncal de Castilla",
      },
    ]);
    expect(model.network.services.map((service) => [
      service.kingdom,
      service.startYear,
      service.endYear,
    ])).toEqual([
      ["Asturias", 718, 737],
      ["Asturias", 900, 920],
      ["León", 910, 1000],
      ["León", 1005, 1070],
      ["Galicia", 910, 930],
      ["Castilla", 1065, 1080],
    ]);
  });

  it("poda la vía troncal por selección sin promover otro reino", () => {
    const people = peopleFromRows([
      government("asturias", "astur", "Asturias", 900, 920),
      government("leon", "leones", "León", 910, 1070),
      government("galicia", "gallego", "Galicia", 910, 1070),
      government("castilla", "castellano", "Castilla", 1065, 1080),
    ]);
    const model = buildRailwayModel(people, {
      selectedKingdoms: ["León"],
      transitionCatalog: mainlineCatalog(),
    });

    expect(model.network.mainlineSegments?.map((segment) => segment.kingdom)).toEqual([
      "Asturias",
      "León",
      "Castilla",
    ]);
    expect(model.projection.mainlineSegments?.map((segment) => segment.kingdom)).toEqual([
      "León",
    ]);

    const galicianProjection = projectRailwayNetwork(model.network, ["Galicia"]);
    expect(galicianProjection.mainlineSegments).toEqual([]);
    expect(model.network.mainlineSegments?.map((segment) => segment.kingdom)).toEqual([
      "Asturias",
      "León",
      "Castilla",
    ]);
  });

  it("mantiene opcional la vía troncal cuando el catálogo no la declara", () => {
    const people = peopleFromRows([
      government("leon", "leones", "León", 914, 924),
    ]);
    const model = buildRailwayModel(people, {
      transitionCatalog: catalog([]),
    });

    expect(model.network.mainlineSegments).toBeUndefined();
    expect(model.projection.mainlineSegments).toBeUndefined();
  });
});

describe("uniones personales y proyección", () => {
  it("etiqueta gobiernos solapados del mismo PersonID como unión personal y nunca como fusión", () => {
    const people = peopleFromRows([
      government("alfonso-leon", "alfonso-vi", "León", 1065, 1072),
      government("alfonso-galicia", "alfonso-vi", "Galicia", 1068, 1071),
    ]);

    const model = buildRailwayModel(people);

    expect(model.network.personalUnions).toEqual([{
      id: "personal-union:station:alfonso-leon--station:alfonso-galicia",
      kind: "personal-union",
      personId: "alfonso-vi",
      stationIds: ["station:alfonso-leon", "station:alfonso-galicia"],
      kingdoms: ["León", "Galicia"],
      startYear: 1068,
      endYear: 1071,
    }]);
    expect(model.network.transitions).toEqual([]);
    expect(model.network.tracks).toHaveLength(2);
    expect(model.network.services).toHaveLength(2);
  });

  it("el selector poda solo la proyección y conserva intacta la red política completa", () => {
    const people = peopleFromRows([
      government("ast-last", "astur", "Asturias", 900, 910),
      government("leon-first", "leones", "León", 910, 920),
      government("gal-first", "gallego", "Galicia", 910, 930),
    ]);
    const model = buildRailwayModel(people, {
      selectedKingdoms: ["reino de león"],
      transitionCatalog: catalog([{
        id: "division-910",
        kind: "split",
        year: 910,
        from: "Asturias",
        to: ["León", "Galicia"],
      }]),
    });

    expect(model.network.stations).toHaveLength(3);
    expect(model.network.tracks.map((track) => track.kingdom)).toEqual([
      "Asturias",
      "León",
      "Galicia",
    ]);
    expect(model.network.transitions[0].anchors).toHaveLength(3);
    expect(model.projection.selectedKingdoms).toEqual(["León"]);
    expect(model.projection.stations.map((station) => station.rowId)).toEqual(["leon-first"]);
    expect(model.projection.tracks.map((track) => track.kingdom)).toEqual(["León"]);
    expect(model.projection.transitions[0]).toMatchObject({ isPartial: true, isAnchored: true });
    expect(model.projection.transitions[0].anchors).toEqual([
      expect.objectContaining({ kingdom: "León", role: "target" }),
    ]);

    const emptyProjection = projectRailwayNetwork(model.network, []);
    expect(emptyProjection.stations).toEqual([]);
    expect(emptyProjection.transitions).toEqual([]);
    expect(emptyProjection.scale).toBe(model.network.scale);
    expect(model.network.stations).toHaveLength(3);
    expect(model.network.transitions[0].anchors).toHaveLength(3);
  });

  it("mantiene el mismo dominio temporal al filtrar un reino", () => {
    const people = peopleFromRows([
      government("pelayo", "pelayo", "Asturias", 718, 737),
      government("castilla-tardia", "fernando", "Castilla", 1217, 1230),
    ]);
    const model = buildRailwayModel(people, { selectedKingdoms: ["Castilla"] });
    const asturiasProjection = projectRailwayNetwork(model.network, ["Asturias"]);

    expect(model.projection.stations.map((station) => station.rowId)).toEqual([
      "castilla-tardia",
    ]);
    expect(model.projection.scale).toBe(model.network.scale);
    expect(asturiasProjection.scale).toBe(model.network.scale);
    expect(model.projection.scale.minYear).toBeLessThan(718);
    expect(model.projection.scale.maxYear).toBeGreaterThan(1230);
  });
});

describe("determinismo", () => {
  it("mantiene IDs y orden aunque cambie el orden de entrada", () => {
    const rows = [
      government("ast-last", "astur", "Asturias", 900, 910),
      government("leon-first", "rey-compartido", "León", 910, 920),
      government("gal-first", "rey-compartido", "Galicia", 910, 920),
      government("cast-first", "castellano", "Castilla", 920, 930),
    ];
    const transitions: RailwayTransitionDefinition[] = [
      {
        id: "division",
        kind: "split",
        year: 910,
        from: "Asturias",
        to: ["Galicia", "León"],
      },
      {
        id: "union",
        kind: "merge",
        year: 920,
        from: ["Galicia", "León"],
        to: "Castilla",
      },
    ];
    const first = buildRailwayModel(peopleFromRows(rows), {
      transitionCatalog: catalog(transitions, "v1"),
    }).network;
    const second = buildRailwayModel(peopleFromRows([...rows].reverse()), {
      transitionCatalog: catalog([...transitions].reverse(), "v1"),
    }).network;
    const summary = (network: typeof first) => ({
      stationIds: network.stations.map((station) => station.id),
      trackIds: network.tracks.map((track) => track.id),
      services: network.services.map((service) => ({
        id: service.id,
        range: [service.startYear, service.endYear],
        startsAt: service.startsAtTransitions.map((boundary) => [
          boundary.transitionId,
          boundary.role,
        ]),
        endsAt: service.endsAtTransitions.map((boundary) => [
          boundary.transitionId,
          boundary.role,
        ]),
      })),
      unionIds: network.personalUnions.map((union) => union.id),
      transitions: network.transitions.map((transition) => ({
        id: transition.id,
        anchorIds: transition.anchors.map((anchor) => anchor.stationId),
      })),
    });

    expect(summary(second)).toEqual(summary(first));
  });
});
