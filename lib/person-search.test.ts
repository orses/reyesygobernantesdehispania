import { describe, expect, it } from "vitest";
import { computeDerivedRow } from "./data";
import { derivePeopleFromRows } from "./people";
import { personMatchesAdvancedSearch } from "./person-search";
import type { Person, RawRow } from "./types";

function makeRow(row: RawRow): RawRow {
  return computeDerivedRow(row) as RawRow;
}

function peopleFixture(): Person[] {
  return derivePeopleFromRows([
    makeRow({
      PersonID: "alfonso",
      "Nombre principal": "Alfonso X",
      Nombre: "Alfonso X",
      Apelativo: "el Sabio",
      Reino: "Reino de Castilla",
      Dinastía: "Borgoña",
      "Tipo de gobierno": "Monarquía",
      "Inicio del reinado (año)": 1252,
      "Final del reinado (año)": 1284,
      "Nacimiento (Fecha)": "1221",
      "Fallecimiento (Fecha)": "1284",
    }),
    makeRow({
      PersonID: "isabel",
      "Nombre principal": "Isabel I",
      Nombre: "Isabel I",
      Apelativo: "la Católica",
      Reino: "Corona de Castilla",
      Dinastía: "Trastámara",
      "Tipo de gobierno": "Monarquía",
      "Inicio del reinado (año)": 1474,
      "Final del reinado (año)": 1504,
      "Nacimiento (Fecha)": "1451",
      "Fallecimiento (Fecha)": "1504",
    }),
    makeRow({
      PersonID: "fernando",
      "Nombre principal": "Fernando II",
      Nombre: "Fernando II",
      Apelativo: "el Católico",
      Reino: "Corona de Aragón",
      Dinastía: "Trastámara",
      "Tipo de gobierno": "Monarquía",
      "Inicio del reinado (año)": 1479,
      "Final del reinado (año)": 1516,
      "Nacimiento (Fecha)": "1452",
      "Fallecimiento (Fecha)": "1516",
    }),
    makeRow({
      PersonID: "pelayo",
      "Nombre principal": "Pelayo",
      Nombre: "Pelayo",
      Reino: "Reino de Asturias",
      Dinastía: "Astur-Leonesa",
      "Tipo de gobierno": "Monarquía",
      "Inicio del reinado (año)": "siglo VIII",
      "Final del reinado (año)": 737,
    }),
    makeRow({
      PersonID: "cortes",
      "Nombre principal": "Regencia de las Cortes",
      Nombre: "Regencia de las Cortes",
      Reino: "España",
      Dinastía: "",
      "Tipo de gobierno": "Regencia",
      "Inicio del reinado (año)": 1810,
      "Final del reinado (año)": 1814,
    }),
  ]).allPeople;
}

function matchingIds(query: string): string[] {
  return peopleFixture()
    .filter((person) => personMatchesAdvancedSearch(person, query))
    .map((person) => String(person.personId));
}

describe("personMatchesAdvancedSearch", () => {
  it("mantiene la búsqueda simple por texto, sin tildes ni mayúsculas", () => {
    expect(matchingIds("catolic")).toEqual(["isabel", "fernando"]);
    expect(matchingIds("asturias")).toEqual(["pelayo"]);
  });

  it("interpreta el espacio como AND", () => {
    expect(matchingIds("castilla sabio")).toEqual(["alfonso"]);
    expect(matchingIds("castilla catolica")).toEqual(["isabel"]);
  });

  it("admite AND/Y explícitos", () => {
    expect(matchingIds("castilla AND sabio")).toEqual(["alfonso"]);
    expect(matchingIds("castilla Y catolica")).toEqual(["isabel"]);
  });

  it("admite OR/O en español e inglés", () => {
    expect(matchingIds("pelayo OR isabel")).toEqual(["pelayo", "isabel"]);
    expect(matchingIds("pelayo O fernando")).toEqual(["pelayo", "fernando"]);
  });

  it("admite NO, NOT y guion como negación", () => {
    expect(matchingIds("castilla NO alfonso")).toEqual(["isabel"]);
    expect(matchingIds("castilla NOT alfonso")).toEqual(["isabel"]);
    expect(matchingIds("castilla -alfonso")).toEqual(["isabel"]);
  });

  it("respeta paréntesis para agrupar expresiones", () => {
    expect(matchingIds("(pelayo OR isabel) AND castilla")).toEqual(["isabel"]);
  });

  it("filtra por campos textuales con dos puntos o igualdad", () => {
    expect(matchingIds("reino:aragon")).toEqual(["fernando"]);
    expect(matchingIds("dinastia=trastamara")).toEqual(["isabel", "fernando"]);
    expect(matchingIds("tipo:regencia")).toEqual(["cortes"]);
    expect(matchingIds("nombre:alfonso")).toEqual(["alfonso"]);
  });

  it("filtra por años de gobierno con comparación y pertenencia al tramo", () => {
    expect(matchingIds("año=1500")).toEqual(["isabel", "fernando"]);
    expect(matchingIds("anio>=1505")).toEqual(["fernando", "cortes"]);
    expect(matchingIds("year<900")).toEqual(["pelayo"]);
    expect(matchingIds("inicio>=1479")).toEqual(["fernando", "cortes"]);
    expect(matchingIds("fin<=737")).toEqual(["pelayo"]);
  });

  it("interpreta un número suelto como año dentro del tramo de reinado", () => {
    expect(matchingIds("1500")).toEqual(["isabel", "fernando"]);
    expect(matchingIds("737")).toEqual(["pelayo"]);
    expect(matchingIds("1812")).toEqual(["cortes"]);
  });

  it("filtra por siglos en número romano o arábigo", () => {
    expect(matchingIds("siglo=VIII")).toEqual(["pelayo"]);
    expect(matchingIds("century=15")).toEqual(["isabel", "fernando"]);
    expect(matchingIds("siglo>=16")).toEqual(["isabel", "fernando", "cortes"]);
  });

  it("filtra por duración y edad con operadores de comparación", () => {
    expect(matchingIds("duracion>35")).toEqual(["fernando"]);
    expect(matchingIds("edad>=60")).toEqual(["alfonso", "fernando"]);
  });

  it("combina campos temporales, texto y negación", () => {
    expect(matchingIds("siglo=15 trastamara -aragon")).toEqual(["isabel"]);
    expect(matchingIds("reino:castilla AND año=1500")).toEqual(["isabel"]);
  });

  it("interpreta las comillas como coincidencia literal exacta del valor textual", () => {
    expect(matchingIds("alfonso")).toEqual(["alfonso"]);
    expect(matchingIds('"alfonso"')).toEqual([]);
    expect(matchingIds('"alfonso x"')).toEqual(["alfonso"]);
    expect(matchingIds('nombre:"alfonso"')).toEqual([]);
    expect(matchingIds('nombre:"alfonso x"')).toEqual(["alfonso"]);
    expect(matchingIds('"el sabio"')).toEqual(["alfonso"]);
  });

  it("aplica una exclusión final a toda la expresión con OR/O", () => {
    const people = derivePeopleFromRows([
      makeRow({
        PersonID: "felipe-ii",
        "Nombre principal": "Felipe II",
        Nombre: "Felipe II",
        Reino: "Monarquía Hispánica",
        Dinastía: "Austria",
        "Inicio del reinado (año)": 1556,
        "Final del reinado (año)": 1598,
      }),
      makeRow({
        PersonID: "felipe-iii",
        "Nombre principal": "Felipe III",
        Nombre: "Felipe III",
        Reino: "Monarquía Hispánica",
        Dinastía: "Austria",
        "Inicio del reinado (año)": 1598,
        "Final del reinado (año)": 1621,
      }),
      makeRow({
        PersonID: "carlos-ii",
        "Nombre principal": "Carlos II",
        Nombre: "Carlos II",
        Reino: "Monarquía Hispánica",
        Dinastía: "Austria",
        "Inicio del reinado (año)": 1665,
        "Final del reinado (año)": 1700,
      }),
    ]).allPeople;

    const ids = people
      .filter((person) => personMatchesAdvancedSearch(person, 'felipe O carlos - "felipe ii"'))
      .map((person) => String(person.personId));

    expect(ids).toEqual(["felipe-iii", "carlos-ii"]);
  });
});
