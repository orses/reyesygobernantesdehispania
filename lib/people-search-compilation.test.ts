import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RawRow } from "./types";

const compilationTracker = vi.hoisted(() => ({ count: 0 }));

vi.mock("./person-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./person-search")>();

  return {
    ...actual,
    compilePersonSearch(query: string, literalSearch = false) {
      compilationTracker.count += 1;
      return actual.compilePersonSearch(query, literalSearch);
    },
  };
});

import { derivePeopleFromRows, filterAndSortPeople } from "./people";

const rows: RawRow[] = [
  {
    PersonID: "alfonso",
    "Nombre principal": "Alfonso X",
    Nombre: "Alfonso X",
    Reino: "Reino de Castilla",
    "Inicio del reinado (año)": 1252,
    "Final del reinado (año)": 1284,
  },
  {
    PersonID: "isabel",
    "Nombre principal": "Isabel I",
    Nombre: "Isabel I",
    Reino: "Corona de Castilla",
    "Inicio del reinado (año)": 1474,
    "Final del reinado (año)": 1504,
  },
  {
    PersonID: "fernando",
    "Nombre principal": "Fernando II",
    Nombre: "Fernando II",
    Reino: "Corona de Aragón",
    "Inicio del reinado (año)": 1479,
    "Final del reinado (año)": 1516,
  },
];

describe("filterAndSortPeople", () => {
  beforeEach(() => {
    compilationTracker.count = 0;
  });

  it("compila la consulta una sola vez para toda la colección", () => {
    const people = derivePeopleFromRows(rows).allPeople;
    const matches = filterAndSortPeople(people, {
      query: "reino:castilla",
      literalSearch: false,
      filterReino: "__all__",
      filterTipo: "__all__",
      filterDinastia: "__all__",
      filterSiglo: "__all__",
      filterDinastiaLocked: false,
      sortKey: "cronologia",
      sortDir: "asc",
    });

    expect(compilationTracker.count).toBe(1);
    expect(matches.map((person) => person.personId)).toEqual(["alfonso", "isabel"]);
  });
});
