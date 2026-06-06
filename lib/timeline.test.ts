import { describe, expect, it } from "vitest";
import { computeDerivedRow } from "./data";
import { derivePeopleFromRows } from "./people";
import {
  buildTimelineGroups,
  buildTimelineModel,
  buildTimelinePeriods,
  buildTimelineScale,
  getTimelineContemporaryPeriodIds,
  getTimelinePeriodPosition,
  getTimelineSuccessionPeriodIds,
  packTimelineLanes,
  periodsAreContemporary,
} from "./timeline";
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

describe("buildTimelinePeriods", () => {
  it("construye periodos ricos con duración, color semántico y sucesión automática", () => {
    const people = peopleFromRows([
      {
        _rowId: "ast-1",
        PersonID: "pelayo",
        "Nombre principal": "Pelayo",
        Nombre: "Pelayo",
        Reino: "Reino de Asturias",
        Dinastía: "Astur-leonesa",
        "Tipo de gobierno": "Monarquía",
        "Inicio del reinado (año)": 718,
        "Final del reinado (año)": 737,
      },
      {
        _rowId: "ast-2",
        PersonID: "favila",
        "Nombre principal": "Favila",
        Nombre: "Favila",
        Reino: "Reino de Asturias",
        Dinastía: "Astur-leonesa",
        "Inicio del reinado (año)": 737,
        "Final del reinado (año)": 739,
      },
    ]);

    const { periods, issues } = buildTimelinePeriods(people);
    const pelayo = periods.find((period) => period.personId === "pelayo");

    expect(issues).toEqual([]);
    expect(pelayo).toMatchObject({
      id: "pelayo:ast-1",
      rowId: "ast-1",
      name: "Pelayo",
      reignName: "Pelayo",
      kingdom: "Reino de Asturias",
      dynasty: "Astur-leonesa",
      governmentType: "Monarquía",
      startYear: 718,
      endYear: 737,
      durationYears: 19,
      verified: true,
      color: "#00468C",
    });
    expect(pelayo?.predecessor).toBe(null);
    expect(pelayo?.successor).toMatchObject({
      personId: "favila",
      nombrePrincipal: "Favila",
    });
    expect(pelayo?.successorSource).toBe("chronological");
  });

  it("no convierte un final desconocido en una duración ficticia de un año", () => {
    const people = peopleFromRows([
      {
        _rowId: "open-1",
        PersonID: "reina",
        "Nombre principal": "Reina abierta",
        Nombre: "Reina abierta",
        Reino: "Corona de Castilla",
        "Inicio del reinado (año)": 1479,
        "Final del reinado (año)": "",
      },
    ]);

    const { periods, issues } = buildTimelinePeriods(people);

    expect(periods[0]).toMatchObject({
      startYear: 1479,
      endYear: null,
      visualEndYear: 1480,
      durationYears: null,
      isOpenEnded: true,
      hasInvalidRange: false,
    });
    expect(issues).toContainEqual(expect.objectContaining({
      kind: "missing-end",
      severity: "warning",
      rowId: "open-1",
    }));
  });

  it("preserva la evidencia de fechas inferidas y la marca como información pedagógica", () => {
    const people = peopleFromRows([
      {
        _rowId: "inf-1",
        PersonID: "aprox",
        "Nombre principal": "Gobernante aproximado",
        Nombre: "Gobernante aproximado",
        Reino: "Reino de Asturias",
        "Inicio del reinado (año)": "p. s. VIII",
        "Final del reinado (año)": "m. s. VIII",
      },
    ]);

    const { periods, issues } = buildTimelinePeriods(people);

    expect(periods[0]).toMatchObject({
      startYear: 701,
      endYear: 750,
      isInferredStart: true,
      isInferredEnd: true,
      durationYears: 49,
    });
    expect(periods[0].startEvidence.raw).toBe("p. s. VIII");
    expect(periods[0].endEvidence.raw).toBe("m. s. VIII");
    expect(issues).toContainEqual(expect.objectContaining({ kind: "inferred-start", severity: "info" }));
    expect(issues).toContainEqual(expect.objectContaining({ kind: "inferred-end", severity: "info" }));
  });

  it("marca rangos inválidos sin corregirlos silenciosamente", () => {
    const people = peopleFromRows([
      {
        _rowId: "bad-1",
        PersonID: "bad",
        "Nombre principal": "Rango anómalo",
        Nombre: "Rango anómalo",
        Reino: "Reino de León",
        "Inicio del reinado (año)": 1000,
        "Final del reinado (año)": 990,
      },
    ]);

    const { periods, issues } = buildTimelinePeriods(people);

    expect(periods[0]).toMatchObject({
      startYear: 1000,
      endYear: 990,
      visualEndYear: 1001,
      durationYears: null,
      hasInvalidRange: true,
    });
    expect(issues).toContainEqual(expect.objectContaining({
      kind: "invalid-range",
      severity: "error",
      rowId: "bad-1",
    }));
  });

  it("excluye de la visualización los gobiernos sin inicio y registra la incidencia", () => {
    const people = peopleFromRows([
      {
        _rowId: "missing-1",
        PersonID: "missing",
        "Nombre principal": "Sin inicio",
        Nombre: "Sin inicio",
        Reino: "Reino de León",
        "Final del reinado (año)": 1000,
      },
    ]);

    const { periods, issues } = buildTimelinePeriods(people);

    expect(periods).toEqual([]);
    expect(issues).toContainEqual(expect.objectContaining({
      kind: "missing-start",
      severity: "error",
      rowId: "missing-1",
    }));
  });

  it("marca los periodos de la persona seleccionada sin depender de la interfaz", () => {
    const people = peopleFromRows([
      {
        PersonID: "a",
        "Nombre principal": "A",
        Nombre: "A",
        Reino: "Reino de León",
        "Inicio del reinado (año)": 1000,
        "Final del reinado (año)": 1010,
      },
      {
        PersonID: "b",
        "Nombre principal": "B",
        Nombre: "B",
        Reino: "Reino de León",
        "Inicio del reinado (año)": 1010,
        "Final del reinado (año)": 1020,
      },
    ]);

    const { periods } = buildTimelinePeriods(people, { selectedPersonId: "b" });

    expect(periods.find((period) => period.personId === "a")?.isFocused).toBe(false);
    expect(periods.find((period) => period.personId === "b")?.isFocused).toBe(true);
  });

  it("calcula siglos con campos cronológicos alternativos ya normalizados", () => {
    const people = peopleFromRows([
      {
        _rowId: "alias-1",
        PersonID: "alias",
        "Nombre principal": "Alias cronológico",
        Nombre: "Alias cronológico",
        Reino: "Corona de Castilla",
        inicioAnio: 1499,
        finAnio: 1501,
      },
    ]);

    const { periods } = buildTimelinePeriods(people);

    expect(periods[0]).toMatchObject({
      startYear: 1499,
      endYear: 1501,
      durationYears: 2,
      centuries: [15, 16],
    });
  });
});

describe("packTimelineLanes", () => {
  it("separa periodos solapados y mantiene juntos los periodos contiguos", () => {
    const people = peopleFromRows([
      {
        PersonID: "a",
        "Nombre principal": "A",
        Nombre: "A",
        Reino: "Reino de León",
        "Inicio del reinado (año)": 1000,
        "Final del reinado (año)": 1010,
      },
      {
        PersonID: "b",
        "Nombre principal": "B",
        Nombre: "B",
        Reino: "Reino de León",
        "Inicio del reinado (año)": 1005,
        "Final del reinado (año)": 1015,
      },
      {
        PersonID: "c",
        "Nombre principal": "C",
        Nombre: "C",
        Reino: "Reino de León",
        "Inicio del reinado (año)": 1015,
        "Final del reinado (año)": 1020,
      },
    ]);
    const { periods } = buildTimelinePeriods(people);

    const lanes = packTimelineLanes(periods);

    expect(lanes).toHaveLength(2);
    expect(lanes[0].periods.map((period) => period.personId)).toEqual(["a", "c"]);
    expect(lanes[1].periods.map((period) => period.personId)).toEqual(["b"]);
  });
});

describe("buildTimelineGroups", () => {
  it("ordena los grupos por primera aparición histórica y no solo alfabéticamente", () => {
    const people = peopleFromRows([
      {
        PersonID: "late",
        "Nombre principal": "Tardío",
        Nombre: "Tardío",
        Reino: "A Reino tardío",
        "Inicio del reinado (año)": 1100,
        "Final del reinado (año)": 1110,
      },
      {
        PersonID: "early",
        "Nombre principal": "Temprano",
        Nombre: "Temprano",
        Reino: "Z Reino temprano",
        "Inicio del reinado (año)": 900,
        "Final del reinado (año)": 910,
      },
    ]);
    const { periods } = buildTimelinePeriods(people);

    const groups = buildTimelineGroups(periods, "kingdom");

    expect(groups.map((group) => group.label)).toEqual(["Z Reino temprano", "A Reino tardío"]);
  });

  it("ordena las entidades políticas relacionadas por continuidad histórica", () => {
    const rows = [
      ["asturias", "Reino de Asturias", 718],
      ["barcelona", "Condado de Barcelona", 801],
      ["pamplona", "Reino de Pamplona", 824],
      ["castilla-condado", "Condado de Castilla", 850],
      ["cataluna", "Condado de Cataluña", 900],
      ["leon", "Reino de León", 910],
      ["galicia", "Reino de Galicia", 910],
      ["aragon-condado", "Condado de Aragón", 922],
      ["aragon-reino", "Reino de Aragón", 1035],
      ["castilla-reino", "Reino de Castilla", 1065],
      ["navarra", "Reino de Navarra", 1162],
      ["aragon-corona", "Corona de Aragón", 1164],
      ["castilla-corona", "Corona de Castilla", 1479],
      ["hispanica", "Monarquía Hispánica", 1516],
    ] as const;
    const people = peopleFromRows(rows.map(([id, kingdom, startYear]) => ({
      PersonID: id,
      "Nombre principal": kingdom,
      Nombre: kingdom,
      Reino: kingdom,
      "Inicio del reinado (año)": startYear,
      "Final del reinado (año)": startYear + 1,
    })));
    const { periods } = buildTimelinePeriods(people);

    const groups = buildTimelineGroups(periods, "kingdom");

    expect(groups.map((group) => group.label)).toEqual([
      "Reino de Asturias",
      "Reino de León",
      "Reino de Galicia",
      "Condado de Castilla",
      "Reino de Castilla",
      "Corona de Castilla",
      "Monarquía Hispánica",
      "Condado de Barcelona",
      "Condado de Cataluña",
      "Condado de Aragón",
      "Reino de Aragón",
      "Corona de Aragón",
      "Reino de Pamplona",
      "Reino de Navarra",
    ]);
  });

  it("agrupa por dinastía con una paleta estable", () => {
    const people = peopleFromRows([
      {
        PersonID: "borbon",
        "Nombre principal": "Borbón",
        Nombre: "Borbón",
        Reino: "España",
        Dinastía: "Borbón",
        "Inicio del reinado (año)": 1700,
        "Final del reinado (año)": 1746,
      },
    ]);
    const { periods } = buildTimelinePeriods(people);

    const groups = buildTimelineGroups(periods, "dynasty");

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      key: "dynasty:borbon",
      label: "Borbón",
      color: "#2563eb",
    });
  });

  it("incluye un reinado que cruza siglos en todos los grupos cronológicos afectados", () => {
    const people = peopleFromRows([
      {
        PersonID: "isabel",
        "Nombre principal": "Isabel I",
        Nombre: "Isabel",
        Reino: "Corona de Castilla",
        "Inicio del reinado (año)": 1474,
        "Final del reinado (año)": 1504,
      },
    ]);
    const { periods } = buildTimelinePeriods(people);

    const groups = buildTimelineGroups(periods, "century");

    expect(groups.map((group) => group.key)).toEqual(["century:15", "century:16"]);
    expect(groups.map((group) => group.label)).toEqual(["siglo XV", "siglo XVI"]);
    expect(groups.every((group) => group.periods[0].personId === "isabel")).toBe(true);
  });
});

describe("buildTimelineScale", () => {
  it("construye una escala con margen, marcas legibles y posiciones acotadas", () => {
    const people = peopleFromRows([
      {
        PersonID: "a",
        "Nombre principal": "A",
        Nombre: "A",
        Reino: "Reino de León",
        "Inicio del reinado (año)": 1000,
        "Final del reinado (año)": 1100,
      },
    ]);
    const { periods } = buildTimelinePeriods(people);

    const scale = buildTimelineScale(periods, 0.05);
    const position = getTimelinePeriodPosition(periods[0], scale);

    expect(scale.minYear).toBeLessThan(1000);
    expect(scale.maxYear).toBeGreaterThan(1100);
    expect(scale.totalYears).toBe(scale.maxYear - scale.minYear);
    expect(scale.tickStep).toBe(10);
    expect(scale.ticks.length).toBeGreaterThan(0);
    expect(position.left).toBeGreaterThan(0);
    expect(position.width).toBeGreaterThan(70);
    expect(position.left + position.width).toBeLessThanOrEqual(100);
  });
});

describe("buildTimelineModel", () => {
  it("devuelve modelo completo con estadísticas de calidad cronológica", () => {
    const people = peopleFromRows([
      {
        PersonID: "explicit",
        "Nombre principal": "Explícito",
        Nombre: "Explícito",
        Reino: "Reino de León",
        "Inicio del reinado (año)": 1000,
        "Final del reinado (año)": 1010,
      },
      {
        PersonID: "open",
        "Nombre principal": "Abierto",
        Nombre: "Abierto",
        Reino: "Reino de León",
        "Inicio del reinado (año)": 1020,
      },
      {
        PersonID: "inferred",
        "Nombre principal": "Inferido",
        Nombre: "Inferido",
        Reino: "Reino de León",
        "Inicio del reinado (año)": "s. XI",
        "Final del reinado (año)": "f. s. XI",
      },
      {
        PersonID: "missing",
        "Nombre principal": "Sin inicio",
        Nombre: "Sin inicio",
        Reino: "Reino de León",
      },
    ]);

    const model = buildTimelineModel(people, { groupMode: "kingdom" });

    expect(model.periods).toHaveLength(3);
    expect(model.groups).toHaveLength(1);
    expect(model.stats).toMatchObject({
      totalPeriods: 3,
      skippedPeriods: 1,
      inferredPeriods: 1,
      openEndedPeriods: 1,
      invalidPeriods: 0,
    });
  });

  it("detecta contemporaneidad con el mismo criterio que usa el empaquetado visual", () => {
    const people = peopleFromRows([
      {
        PersonID: "a",
        "Nombre principal": "A",
        Nombre: "A",
        Reino: "Reino de León",
        "Inicio del reinado (año)": 1000,
        "Final del reinado (año)": 1010,
      },
      {
        PersonID: "b",
        "Nombre principal": "B",
        Nombre: "B",
        Reino: "Reino de León",
        "Inicio del reinado (año)": 1005,
        "Final del reinado (año)": 1015,
      },
      {
        PersonID: "c",
        "Nombre principal": "C",
        Nombre: "C",
        Reino: "Reino de León",
        "Inicio del reinado (año)": 1010,
        "Final del reinado (año)": 1020,
      },
    ]);
    const { periods } = buildTimelinePeriods(people);
    const byId = new Map(periods.map((period) => [period.personId, period]));

    expect(periodsAreContemporary(byId.get("a")!, byId.get("b")!)).toBe(true);
    expect(periodsAreContemporary(byId.get("a")!, byId.get("c")!)).toBe(false);
  });
});

describe("lecturas didácticas de la línea temporal", () => {
  it("interpreta Sucesión como serie dinástica dentro de la misma entidad política", () => {
    const people = peopleFromRows([
      {
        PersonID: "carlos-i",
        "Nombre principal": "Carlos I",
        Nombre: "Carlos I",
        Reino: "Monarquía Hispánica",
        Dinastía: "Austria",
        "Inicio del reinado (año)": 1516,
        "Final del reinado (año)": 1556,
      },
      {
        PersonID: "felipe-ii",
        "Nombre principal": "Felipe II",
        Nombre: "Felipe II",
        Reino: "Monarquía Hispánica",
        Dinastía: "Austria",
        "Inicio del reinado (año)": 1556,
        "Final del reinado (año)": 1598,
      },
      {
        PersonID: "felipe-iii",
        "Nombre principal": "Felipe III",
        Nombre: "Felipe III",
        Reino: "Monarquía Hispánica",
        Dinastía: "Austria",
        "Inicio del reinado (año)": 1598,
        "Final del reinado (año)": 1621,
      },
      {
        PersonID: "felipe-iv",
        "Nombre principal": "Felipe IV",
        Nombre: "Felipe IV",
        Reino: "Monarquía Hispánica",
        Dinastía: "Austria",
        "Inicio del reinado (año)": 1621,
        "Final del reinado (año)": 1665,
      },
      {
        PersonID: "carlos-ii",
        "Nombre principal": "Carlos II",
        Nombre: "Carlos II",
        Reino: "Monarquía Hispánica",
        Dinastía: "Austria",
        "Inicio del reinado (año)": 1665,
        "Final del reinado (año)": 1700,
      },
      {
        PersonID: "felipe-v",
        "Nombre principal": "Felipe V",
        Nombre: "Felipe V",
        Reino: "Monarquía Hispánica",
        Dinastía: "Borbón",
        "Inicio del reinado (año)": 1700,
        "Final del reinado (año)": 1746,
      },
      {
        PersonID: "carlos-navarra",
        "Nombre principal": "Carlos de Navarra",
        Nombre: "Carlos de Navarra",
        Reino: "Reino de Navarra",
        Dinastía: "Austria",
        "Inicio del reinado (año)": 1516,
        "Final del reinado (año)": 1556,
      },
    ]);
    const { periods } = buildTimelinePeriods(people);
    const selected = periods.find((period) => period.personId === "carlos-i") ?? null;

    const successionIds = getTimelineSuccessionPeriodIds(periods, selected);
    const selectedPeople = periods
      .filter((period) => successionIds.has(period.id))
      .map((period) => period.personId);

    expect(selectedPeople).toEqual([
      "carlos-i",
      "felipe-ii",
      "felipe-iii",
      "felipe-iv",
      "carlos-ii",
    ]);
  });

  it("interpreta Contemporáneos como todos los periodos que se solapan con el seleccionado", () => {
    const people = peopleFromRows([
      {
        PersonID: "selected",
        "Nombre principal": "Seleccionado",
        Nombre: "Seleccionado",
        Reino: "Reino A",
        Dinastía: "Casa A",
        "Inicio del reinado (año)": 1000,
        "Final del reinado (año)": 1010,
      },
      {
        PersonID: "overlap-left",
        "Nombre principal": "Solapa por la izquierda",
        Nombre: "Solapa por la izquierda",
        Reino: "Reino B",
        Dinastía: "Casa B",
        "Inicio del reinado (año)": 990,
        "Final del reinado (año)": 1001,
      },
      {
        PersonID: "inside",
        "Nombre principal": "Dentro",
        Nombre: "Dentro",
        Reino: "Reino C",
        Dinastía: "Casa C",
        "Inicio del reinado (año)": 1003,
        "Final del reinado (año)": 1006,
      },
      {
        PersonID: "touching",
        "Nombre principal": "Contiguo",
        Nombre: "Contiguo",
        Reino: "Reino D",
        Dinastía: "Casa D",
        "Inicio del reinado (año)": 1010,
        "Final del reinado (año)": 1020,
      },
      {
        PersonID: "after",
        "Nombre principal": "Posterior",
        Nombre: "Posterior",
        Reino: "Reino E",
        Dinastía: "Casa E",
        "Inicio del reinado (año)": 1021,
        "Final del reinado (año)": 1030,
      },
    ]);
    const { periods } = buildTimelinePeriods(people);
    const selected = periods.find((period) => period.personId === "selected") ?? null;

    const contemporaryIds = getTimelineContemporaryPeriodIds(periods, selected);
    const selectedPeople = periods
      .filter((period) => contemporaryIds.has(period.id))
      .map((period) => period.personId);

    expect(selectedPeople).toEqual(["overlap-left", "selected", "inside"]);
  });
});
