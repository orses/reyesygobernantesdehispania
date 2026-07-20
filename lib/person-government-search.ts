import { rowDisplayName } from "./data";
import {
  normalizeSearchText,
  normalizeSimpleGovernmentSearchQuery,
  rowContainsSearchYear,
  rowDescriptionSearchText,
} from "./person-search";
import type { Person, RawRow } from "./types";

/**
 * Extrae los términos que permiten afinar una tarjeta de gobierno concreta.
 * Las expresiones avanzadas se dejan al filtro general de personajes.
 */
export function simpleGovernmentSearchTerms(query: string): string[] | null {
  if (!query.trim()) return [];
  if (/[<>=()]/.test(query) || /\b(no|not|or|o)\b/iu.test(query) || /(^|\s)-\S/.test(query)) {
    return null;
  }

  return normalizeSimpleGovernmentSearchQuery(query)
    .replace(/\b(and|y)\b/giu, " ")
    .replace(/["']/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function governmentSearchText(person: Person, row: RawRow): string {
  return [
    person.nombrePrincipal,
    ...person.apelativos,
    rowDisplayName(row),
    row?.Nombre,
    row?.nombre,
    row?.Apelativo,
    row?.apelativo,
    row?.Reino,
    row?.Dinastía,
    row?.["Tipo de gobierno"],
    row?.["Inicio del reinado (año)"],
    row?.["Final del reinado (año)"],
    ...person.reinados.map(rowDescriptionSearchText),
  ]
    .map((value) => String(value ?? ""))
    .join(" ");
}

/**
 * Comprueba una búsqueda simple contra una tarjeta y su descripción personal.
 */
export function personGovernmentMatchesSimpleSearch(
  person: Person,
  row: RawRow,
  query: string
): boolean {
  const terms = simpleGovernmentSearchTerms(query);
  if (terms === null || terms.length === 0) return true;

  const haystack = normalizeSearchText(governmentSearchText(person, row));
  return terms.every(
    (term) => haystack.includes(term) || rowContainsSearchYear(row, term)
  );
}
