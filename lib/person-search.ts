import { asYearOrNull, centuryFromYear } from "./data";
import { normalizeSearchText } from "./text";
import type { Person, RawRow } from "./types";

export { normalizeSearchText } from "./text";

type TokenKind = "word" | "phrase" | "operator" | "comparison" | "colon" | "lparen" | "rparen";

interface SearchToken {
  kind: TokenKind;
  value: string;
}

type SearchNode =
  | { type: "term"; value: string; exact: boolean }
  | { type: "field"; field: string; operator: ComparisonOperator; value: string; exact: boolean }
  | { type: "not"; child: SearchNode }
  | { type: "and"; left: SearchNode; right: SearchNode }
  | { type: "or"; left: SearchNode; right: SearchNode };

type ComparisonOperator = ":" | "=" | "!=" | ">" | ">=" | "<" | "<=";

interface ParserState {
  tokens: SearchToken[];
  index: number;
}

const BOOLEAN_OPERATORS = new Set(["and", "y", "or", "o", "not", "no"]);
const COMPARISON_OPERATORS = new Set([":", "=", "!=", ">", ">=", "<", "<="]);

const FIELD_ALIASES: Record<string, string> = {
  ano: "year",
  anio: "year",
  annio: "year",
  anos: "year",
  anios: "year",
  anyo: "year",
  año: "year",
  años: "year",
  year: "year",
  years: "year",
  fecha: "year",
  fechas: "year",
  inicio: "start",
  comienza: "start",
  empieza: "start",
  start: "start",
  from: "start",
  fin: "end",
  final: "end",
  termina: "end",
  end: "end",
  to: "end",
  siglo: "century",
  siglos: "century",
  century: "century",
  centuries: "century",
  c: "century",
  nombre: "name",
  name: "name",
  rey: "name",
  monarca: "name",
  personaje: "name",
  reino: "kingdom",
  reinos: "kingdom",
  kingdom: "kingdom",
  kingdoms: "kingdom",
  entidad: "kingdom",
  dinastia: "dynasty",
  dinastía: "dynasty",
  dynasty: "dynasty",
  casa: "dynasty",
  tipo: "governmentType",
  gobierno: "governmentType",
  government: "governmentType",
  duracion: "duration",
  duración: "duration",
  duration: "duration",
  edad: "age",
  age: "age",
};

function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

function isComparisonOperator(value: string): value is ComparisonOperator {
  return COMPARISON_OPERATORS.has(value);
}

function normalizeFieldName(value: string): string | null {
  return FIELD_ALIASES[normalizeSearchText(value)] ?? null;
}

function tokenizeSearchQuery(query: string): SearchToken[] {
  const tokens: SearchToken[] = [];
  let index = 0;

  while (index < query.length) {
    const char = query[index];

    if (isWhitespace(char)) {
      index += 1;
      continue;
    }

    if (char === "(") {
      tokens.push({ kind: "lparen", value: char });
      index += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({ kind: "rparen", value: char });
      index += 1;
      continue;
    }

    if (char === "\"") {
      let phrase = "";
      index += 1;
      while (index < query.length && query[index] !== "\"") {
        phrase += query[index];
        index += 1;
      }
      if (index < query.length && query[index] === "\"") index += 1;
      if (phrase.trim()) tokens.push({ kind: "phrase", value: phrase.trim() });
      continue;
    }

    const twoChar = query.slice(index, index + 2);
    if (twoChar === ">=" || twoChar === "<=" || twoChar === "!=") {
      tokens.push({ kind: "comparison", value: twoChar });
      index += 2;
      continue;
    }

    if (char === ">" || char === "<" || char === "=") {
      tokens.push({ kind: "comparison", value: char });
      index += 1;
      continue;
    }

    if (char === ":") {
      tokens.push({ kind: "colon", value: char });
      index += 1;
      continue;
    }

    if (char === "-") {
      tokens.push({ kind: "operator", value: "not" });
      index += 1;
      continue;
    }

    let word = "";
    while (
      index < query.length &&
      !isWhitespace(query[index]) &&
      query[index] !== "(" &&
      query[index] !== ")" &&
      query[index] !== "\"" &&
      query[index] !== ":" &&
      query[index] !== ">" &&
      query[index] !== "<" &&
      query[index] !== "="
    ) {
      if (query[index] === "!" && query[index + 1] === "=") break;
      word += query[index];
      index += 1;
    }

    const trimmed = word.trim();
    if (!trimmed) continue;
    const normalized = normalizeSearchText(trimmed);
    tokens.push({
      kind: BOOLEAN_OPERATORS.has(normalized) ? "operator" : "word",
      value: BOOLEAN_OPERATORS.has(normalized) ? normalized : trimmed,
    });
  }

  return tokens;
}

function currentToken(state: ParserState): SearchToken | null {
  return state.tokens[state.index] ?? null;
}

function consumeToken(state: ParserState): SearchToken | null {
  const token = currentToken(state);
  if (token) state.index += 1;
  return token;
}

function isOrOperator(token: SearchToken | null): boolean {
  return token?.kind === "operator" && (token.value === "or" || token.value === "o");
}

function isAndOperator(token: SearchToken | null): boolean {
  return token?.kind === "operator" && (token.value === "and" || token.value === "y");
}

function isNotOperator(token: SearchToken | null): boolean {
  return token?.kind === "operator" && (token.value === "not" || token.value === "no");
}

function canStartPrimary(token: SearchToken | null): boolean {
  return token?.kind === "word" || token?.kind === "phrase" || token?.kind === "lparen" || isNotOperator(token);
}

function parseSearchExpression(state: ParserState): SearchNode | null {
  return parseOrExpression(state);
}

function parseOrExpression(state: ParserState): SearchNode | null {
  let node = parseAndExpression(state);
  if (!node) return null;

  while (isOrOperator(currentToken(state))) {
    consumeToken(state);
    const right = parseAndExpression(state);
    if (!right) break;
    node = { type: "or", left: node, right };
  }

  return node;
}

function parseAndExpression(state: ParserState): SearchNode | null {
  let node = parseUnaryExpression(state);
  if (!node) return null;

  while (true) {
    const token = currentToken(state);
    if (isAndOperator(token)) {
      consumeToken(state);
      const right = parseUnaryExpression(state);
      if (!right) break;
      node = { type: "and", left: node, right };
      continue;
    }

    if (canStartPrimary(token) && !isOrOperator(token) && token?.kind !== "rparen") {
      const right = parseUnaryExpression(state);
      if (!right) break;
      node = { type: "and", left: node, right };
      continue;
    }

    break;
  }

  return node;
}

function parseUnaryExpression(state: ParserState): SearchNode | null {
  if (isNotOperator(currentToken(state))) {
    consumeToken(state);
    const child = parseUnaryExpression(state);
    return child ? { type: "not", child } : null;
  }

  return parsePrimaryExpression(state);
}

function parsePrimaryExpression(state: ParserState): SearchNode | null {
  const token = currentToken(state);
  if (!token) return null;

  if (token.kind === "lparen") {
    consumeToken(state);
    const node = parseSearchExpression(state);
    if (currentToken(state)?.kind === "rparen") consumeToken(state);
    return node;
  }

  if (token.kind !== "word" && token.kind !== "phrase") return null;
  consumeToken(state);

  const field = token.kind === "word" ? normalizeFieldName(token.value) : null;
  const next = currentToken(state);
  if (field && (next?.kind === "comparison" || next?.kind === "colon")) {
    const operatorToken = consumeToken(state);
    const valueToken = consumeToken(state);
    if (!operatorToken || !valueToken || (valueToken.kind !== "word" && valueToken.kind !== "phrase")) {
      return { type: "term", value: token.value, exact: token.kind === "phrase" };
    }

    const operator = operatorToken.kind === "colon" ? ":" : operatorToken.value;
    return isComparisonOperator(operator)
      ? { type: "field", field, operator, value: valueToken.value, exact: valueToken.kind === "phrase" }
      : { type: "term", value: token.value, exact: token.kind === "phrase" };
  }

  if (field && next && (next.kind === "word" || next.kind === "phrase") && !BOOLEAN_OPERATORS.has(normalizeSearchText(next.value))) {
    const valueToken = consumeToken(state);
    if (valueToken) return { type: "field", field, operator: ":", value: valueToken.value, exact: valueToken.kind === "phrase" };
  }

  return { type: "term", value: token.value, exact: token.kind === "phrase" };
}

function parseQuery(query: string): SearchNode | null {
  const tokens = tokenizeSearchQuery(query);
  if (!tokens.length) return null;
  const parsed = parseSearchExpression({ tokens, index: 0 });
  return parsed ? normalizeSearchNode(parsed) : null;
}

function combineNodes(type: "and" | "or", left: SearchNode | null, right: SearchNode | null): SearchNode | null {
  if (!left) return right;
  if (!right) return left;
  return { type, left, right };
}

function buildAndChain(nodes: SearchNode[]): SearchNode | null {
  return nodes.reduce<SearchNode | null>((current, node) => combineNodes("and", current, node), null);
}

function splitPositiveAndExclusions(node: SearchNode | null): { positive: SearchNode | null; exclusions: SearchNode[] } {
  if (!node) return { positive: null, exclusions: [] };
  if (node.type === "not") return { positive: null, exclusions: [node.child] };

  if (node.type === "and") {
    const left = splitPositiveAndExclusions(node.left);
    const right = splitPositiveAndExclusions(node.right);
    return {
      positive: combineNodes("and", left.positive, right.positive),
      exclusions: [...left.exclusions, ...right.exclusions],
    };
  }

  return { positive: node, exclusions: [] };
}

function normalizeSearchNode(node: SearchNode): SearchNode {
  if (node.type === "term" || node.type === "field") return node;
  if (node.type === "not") return { type: "not", child: normalizeSearchNode(node.child) };

  if (node.type === "and") {
    return {
      type: "and",
      left: normalizeSearchNode(node.left),
      right: normalizeSearchNode(node.right),
    };
  }

  const left = splitPositiveAndExclusions(normalizeSearchNode(node.left));
  const right = splitPositiveAndExclusions(normalizeSearchNode(node.right));
  const positiveOr = combineNodes("or", left.positive, right.positive);
  const exclusionNodes = [...left.exclusions, ...right.exclusions].map((child): SearchNode => ({
    type: "not",
    child,
  }));

  return buildAndChain([positiveOr, ...exclusionNodes].filter((candidate): candidate is SearchNode => candidate !== null)) ?? node;
}

function textValuesForPerson(person: Person): string[] {
  return [
    person.nombrePrincipal,
    ...person.nombres,
    ...person.apelativos,
    ...person.reinos,
    person.dinastia,
    ...person.dinastias,
    ...person.reinados.flatMap((row) => [
      row?.["Tipo de gobierno"],
      row?.Nombre,
      row?.Apelativo,
      row?.Reino,
      row?.Dinastía,
    ]),
  ].map((value) => String(value ?? ""));
}

function containsNormalizedText(candidate: string, query: string, exact: boolean): boolean {
  const normalizedCandidate = normalizeSearchText(candidate);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  if (!exact) return normalizedCandidate.includes(normalizedQuery);
  return normalizedCandidate === normalizedQuery;
}

function personContainsText(person: Person, query: string, exact: boolean): boolean {
  return textValuesForPerson(person).some((value) => containsNormalizedText(value, query, exact));
}

function termAsYear(value: string): number | null {
  const trimmed = normalizeSearchText(value);
  if (!/^\d{1,4}$/.test(trimmed)) return null;
  return Number(trimmed);
}

function personMatchesTerm(person: Person, query: string, exact: boolean): boolean {
  if (personContainsText(person, query, exact)) return true;
  if (exact) return false;
  const year = termAsYear(query);
  return year !== null && person.reinados.some((row) => rowSpansYear(row, year));
}

function rowStartYear(row: RawRow): number | null {
  return asYearOrNull(row?.["Inicio del reinado (año)"] ?? row?.["Inicio del reinado (aÃ±o)"] ?? row?.inicioAnio);
}

function rowEndYear(row: RawRow): number | null {
  return asYearOrNull(row?.["Final del reinado (año)"] ?? row?.["Final del reinado (aÃ±o)"] ?? row?.finAnio);
}

function compareNumber(value: number, operator: ComparisonOperator, target: number): boolean {
  if (operator === ":" || operator === "=") return value === target;
  if (operator === "!=") return value !== target;
  if (operator === ">") return value > target;
  if (operator === ">=") return value >= target;
  if (operator === "<") return value < target;
  if (operator === "<=") return value <= target;
  return false;
}

function textFieldValues(person: Person, field: string): string[] {
  if (field === "name") return [person.nombrePrincipal, ...person.nombres, ...person.apelativos];
  if (field === "kingdom") return [...person.reinos, ...person.reinados.map((row) => String(row?.Reino ?? ""))];
  if (field === "dynasty") return [person.dinastia, ...person.dinastias, ...person.reinados.map((row) => String(row?.Dinastía ?? ""))];
  if (field === "governmentType") return person.reinados.map((row) => String(row?.["Tipo de gobierno"] ?? ""));
  return [];
}

function matchesTextField(person: Person, field: string, operator: ComparisonOperator, value: string, exact: boolean): boolean {
  const normalizedValue = normalizeSearchText(value);
  const values = textFieldValues(person, field).filter((candidate) => normalizeSearchText(candidate));
  if (!normalizedValue) return true;
  if (operator === "!=") return values.every((candidate) => !containsNormalizedText(candidate, value, exact));
  return values.some((candidate) => containsNormalizedText(candidate, value, exact));
}

function romanToNumber(value: string): number | null {
  const roman: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  const normalized = normalizeSearchText(value).replace(/^siglo\s+/, "");
  if (!/^[ivxlcdm]+$/.test(normalized)) return null;

  let total = 0;
  for (let index = 0; index < normalized.length; index++) {
    const current = roman[normalized[index]];
    const next = roman[normalized[index + 1]];
    if (!current) return null;
    total += next && current < next ? -current : current;
  }
  return total;
}

function parseSearchNumber(value: string): number | null {
  const direct = Number(value.replace(",", "."));
  if (Number.isFinite(direct)) return direct;
  return romanToNumber(value);
}

function rowCenturyValues(row: RawRow): number[] {
  const startYear = rowStartYear(row);
  if (startYear === null) return [];
  const endYear = rowEndYear(row) ?? startYear;
  const startCentury = centuryFromYear(startYear);
  const endCentury = centuryFromYear(endYear);
  if (startCentury === null || endCentury === null) return [];
  const from = Math.min(startCentury, endCentury);
  const to = Math.max(startCentury, endCentury);
  const values: number[] = [];
  for (let century = from; century <= to; century++) values.push(century);
  return values;
}

function rowSpansYear(row: RawRow, year: number): boolean {
  const startYear = rowStartYear(row);
  if (startYear === null) return false;
  const endYear = rowEndYear(row) ?? startYear;
  return year >= Math.min(startYear, endYear) && year <= Math.max(startYear, endYear);
}

function matchesYearField(person: Person, operator: ComparisonOperator, rawValue: string): boolean {
  const target = parseSearchNumber(rawValue);
  if (target === null) return false;

  return person.reinados.some((row) => {
    const startYear = rowStartYear(row);
    if (startYear === null) return false;
    const endYear = rowEndYear(row) ?? startYear;
    if (operator === ":" || operator === "=") return rowSpansYear(row, target);
    if (operator === "!=") return !rowSpansYear(row, target);
    if (operator === ">") return endYear > target;
    if (operator === ">=") return endYear >= target;
    if (operator === "<") return startYear < target;
    if (operator === "<=") return startYear <= target;
    return false;
  });
}

function matchesStartOrEndField(person: Person, field: string, operator: ComparisonOperator, rawValue: string): boolean {
  const target = parseSearchNumber(rawValue);
  if (target === null) return false;
  return person.reinados.some((row) => {
    const value = field === "start" ? rowStartYear(row) : rowEndYear(row);
    return value !== null && compareNumber(value, operator, target);
  });
}

function matchesCenturyField(person: Person, operator: ComparisonOperator, rawValue: string): boolean {
  const target = parseSearchNumber(rawValue);
  if (target === null) return false;
  return person.reinados.some((row) => rowCenturyValues(row).some((century) => compareNumber(century, operator, target)));
}

function totalDuration(person: Person): number {
  return person.reinados.reduce(
    (total, row) => total + (typeof row._duracionCalc === "number" && Number.isFinite(row._duracionCalc) ? row._duracionCalc : 0),
    0
  );
}

function matchesNumericPersonField(person: Person, field: string, operator: ComparisonOperator, rawValue: string): boolean {
  const target = parseSearchNumber(rawValue);
  if (target === null) return false;
  const value = field === "duration" ? totalDuration(person) : person.age;
  return typeof value === "number" && Number.isFinite(value) && compareNumber(value, operator, target);
}

function matchesField(person: Person, field: string, operator: ComparisonOperator, value: string, exact: boolean): boolean {
  if (field === "name" || field === "kingdom" || field === "dynasty" || field === "governmentType") {
    return matchesTextField(person, field, operator, value, exact);
  }
  if (field === "year") return matchesYearField(person, operator, value);
  if (field === "start" || field === "end") return matchesStartOrEndField(person, field, operator, value);
  if (field === "century") return matchesCenturyField(person, operator, value);
  if (field === "duration" || field === "age") return matchesNumericPersonField(person, field, operator, value);
  return false;
}

function evaluateNode(person: Person, node: SearchNode): boolean {
  if (node.type === "term") return personMatchesTerm(person, node.value, node.exact);
  if (node.type === "field") return matchesField(person, node.field, node.operator, node.value, node.exact);
  if (node.type === "not") return !evaluateNode(person, node.child);
  if (node.type === "and") return evaluateNode(person, node.left) && evaluateNode(person, node.right);
  if (node.type === "or") return evaluateNode(person, node.left) || evaluateNode(person, node.right);
  return false;
}

export function personMatchesAdvancedSearch(person: Person, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const parsed = parseQuery(query);
  if (!parsed) return true;
  return evaluateNode(person, parsed);
}
