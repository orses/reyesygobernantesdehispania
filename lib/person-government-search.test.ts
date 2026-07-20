import { describe, expect, it } from "vitest";
import { computeDerivedRow } from "./data";
import {
  personGovernmentMatchesSimpleSearch,
  simpleGovernmentSearchTerms,
} from "./person-government-search";
import { derivePeopleFromRows } from "./people";
import type { RawRow } from "./types";

const rows: RawRow[] = [
  computeDerivedRow({
    ID: "leon",
    _rowId: "leon",
    PersonID: "ordono",
    "Nombre principal": "Ordoño II",
    Nombre: "Ordoño II",
    Reino: "Reino de León",
    "Inicio del reinado (año)": 910,
    "Final del reinado (año)": 924,
  }),
  computeDerivedRow({
    ID: "galicia",
    _rowId: "galicia",
    PersonID: "ordono",
    "Nombre principal": "Ordoño II",
    Nombre: "Ordoño II",
    Reino: "Reino de Galicia",
    "Inicio del reinado (año)": 914,
    "Final del reinado (año)": 924,
    Descripción: "Venció a los ejércitos cordobeses en Muez.",
  }),
];

const person = derivePeopleFromRows(rows).allPeople[0];

describe("búsqueda de tarjetas de gobierno", () => {
  it("acepta una consulta vacía y rechaza texto inexistente", () => {
    expect(simpleGovernmentSearchTerms("   ")).toEqual([]);
    expect(personGovernmentMatchesSimpleSearch(person, person.reinados[0], "")).toBe(true);
    expect(personGovernmentMatchesSimpleSearch(person, person.reinados[0], "inexistente")).toBe(false);
  });

  it.each(["Muez", "descripcion:Muez", "descripción:Muez", "description:Muez"])(
    "encuentra la descripción personal con %s",
    (query) => {
      expect(personGovernmentMatchesSimpleSearch(person, person.reinados[0], query)).toBe(true);
      expect(personGovernmentMatchesSimpleSearch(person, person.reinados[1], query)).toBe(true);
    }
  );

  it("encuentra un año interior aunque no coincida con los extremos", () => {
    expect(personGovernmentMatchesSimpleSearch(person, person.reinados[0], "920")).toBe(true);
    expect(personGovernmentMatchesSimpleSearch(person, person.reinados[0], "año:920")).toBe(true);
    expect(personGovernmentMatchesSimpleSearch(person, person.reinados[0], "909")).toBe(false);
    expect(personGovernmentMatchesSimpleSearch(person, person.reinados[0], "925")).toBe(false);
  });

  it("mantiene las expresiones avanzadas a cargo del filtro general", () => {
    expect(simpleGovernmentSearchTerms("descripcion!=Muez")).toBeNull();
    expect(simpleGovernmentSearchTerms("Muez OR Córdoba")).toBeNull();
  });
});
