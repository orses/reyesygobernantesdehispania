import { describe, expect, it } from "vitest";
import { WESTERN_KINGDOMS_RAILWAY_TOPOLOGY } from "./railway-topology";

describe("topología ferroviaria de los reinos occidentales", () => {
  it("declara un catálogo versionado y determinista", () => {
    const { transitions } = WESTERN_KINGDOMS_RAILWAY_TOPOLOGY;
    const ids = transitions.map((transition) => transition.id);

    expect(WESTERN_KINGDOMS_RAILWAY_TOPOLOGY.schemaVersion).toBe(1);
    expect(WESTERN_KINGDOMS_RAILWAY_TOPOLOGY.version).toBe("reinos-occidentales-1.4.0");
    expect(new Set(ids).size).toBe(ids.length);
    expect(transitions.map((transition) => transition.year)).toEqual(
      [...transitions].map((transition) => transition.year).sort((left, right) => left - right)
    );
  });

  it("declara el relevo temporal de la vía troncal sin confundirlo con la topología política", () => {
    expect(WESTERN_KINGDOMS_RAILWAY_TOPOLOGY.mainlineSegments).toEqual([
      {
        id: "troncal-asturias-hasta-914",
        kingdom: "Asturias",
        startYear: null,
        endYear: 914,
        label: "Asturias, vía troncal hasta 914",
      },
      {
        id: "troncal-leon-914-1066",
        kingdom: "León",
        startYear: 914,
        endYear: 1066,
        label: "León, vía troncal entre 914 y 1066",
      },
      {
        id: "troncal-castilla-1066-1252",
        kingdom: "Castilla",
        startYear: 1066,
        endYear: 1252,
        label: "Reino de Castilla, vía troncal entre 1066 y 1252",
      },
      {
        id: "troncal-corona-castilla-1252-1516",
        kingdom: "Corona de Castilla",
        startYear: 1252,
        endYear: 1516,
        label: "Corona de Castilla, vía troncal entre 1252 y 1516",
      },
      {
        id: "troncal-monarquia-hispanica-desde-1516",
        kingdom: "Monarquía Hispánica / España",
        startYear: 1516,
        endYear: null,
        label: "Monarquía Hispánica / España, vía troncal desde 1516",
      },
    ]);
  });

  it("modela la división de 910 con las tres ramas presentes en los datos", () => {
    expect(WESTERN_KINGDOMS_RAILWAY_TOPOLOGY.transitions[0]).toEqual({
      id: "division-alfonso-iii-910",
      kind: "split",
      year: 910,
      from: "Asturias",
      to: ["Asturias", "León", "Galicia"],
      label: "División tras Alfonso III",
    });
  });

  it("reúne Asturias y Galicia con un León que ya existía", () => {
    const transitions = WESTERN_KINGDOMS_RAILWAY_TOPOLOGY.transitions;

    expect(transitions.find((transition) => transition.id === "ordono-ii-leon-914"))
      .toMatchObject({
        kind: "merge",
        from: ["Galicia", "León"],
        to: "León",
      });
    expect(transitions.find((transition) => transition.id === "fruela-ii-leon-924"))
      .toMatchObject({
        kind: "merge",
        from: ["Asturias", "León"],
        to: "León",
      });
  });

  it("distingue uniones y separaciones dinásticas de las fusiones políticas", () => {
    const union = WESTERN_KINGDOMS_RAILWAY_TOPOLOGY.transitions.find(
      (transition) => transition.id === "union-definitiva-1230"
    );
    const separation = WESTERN_KINGDOMS_RAILWAY_TOPOLOGY.transitions.find(
      (transition) => transition.id === "separacion-leon-castilla-1157"
    );

    expect(union).toMatchObject({
      kind: "dynastic-union",
      year: 1230,
      kingdoms: ["León", "Castilla"],
    });
    expect(separation).toMatchObject({
      kind: "dynastic-separation",
      year: 1157,
      kingdoms: ["León", "Castilla"],
    });
  });

  it("distingue el relevo de 1252 de la integración sin extinción de 1516", () => {
    const transitions = WESTERN_KINGDOMS_RAILWAY_TOPOLOGY.transitions;

    expect(transitions.find(
      (transition) => transition.id === "relevo-periodizacion-castellana-1252"
    )).toEqual({
      id: "relevo-periodizacion-castellana-1252",
      kind: "transformation",
      year: 1252,
      from: "Castilla",
      to: "Corona de Castilla",
      label: "Relevo de periodización tras Fernando III",
    });
    expect(transitions.find(
      (transition) => transition.id
        === "integracion-corona-castilla-monarquia-hispanica-1516"
    )).toEqual({
      id: "integracion-corona-castilla-monarquia-hispanica-1516",
      kind: "integration",
      year: 1516,
      from: "Corona de Castilla",
      to: "Monarquía Hispánica / España",
      label: "Integración de la Corona de Castilla en la Monarquía Hispánica",
    });
  });
});
