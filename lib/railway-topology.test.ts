import { describe, expect, it } from "vitest";
import {
  WESTERN_KINGDOMS_RAILWAY_SOURCES,
  WESTERN_KINGDOMS_RAILWAY_TOPOLOGY,
} from "./railway-topology";

describe("topología ferroviaria de los reinos occidentales", () => {
  it("declara un catálogo versionado, determinista y con fuentes de contraste", () => {
    const { transitions } = WESTERN_KINGDOMS_RAILWAY_TOPOLOGY;
    const ids = transitions.map((transition) => transition.id);

    expect(WESTERN_KINGDOMS_RAILWAY_TOPOLOGY.schemaVersion).toBe(1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(transitions.map((transition) => transition.year)).toEqual(
      [...transitions].map((transition) => transition.year).sort((left, right) => left - right)
    );
    expect(ids.every((id) => WESTERN_KINGDOMS_RAILWAY_SOURCES[id]?.startsWith("https://"))).toBe(true);
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
});
