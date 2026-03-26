
// --- Tipos y Helpers de Formato ---

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  // Truco para mostrar enteros si no hay decimales, o hasta 2 decimales si los hay.
  return Number(n.toFixed(2)).toString();
}

export function safeJsonParse(text: string) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function downloadTextFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- Parsing CSV ---

export function parseCsv(text: string) {
  const input = String(text ?? "");

  let normalized = input;
  if (normalized.includes("\r\n")) normalized = normalized.split("\r\n").join("\n");
  if (normalized.includes("\r")) normalized = normalized.split("\r").join("\n");

  let inQ = false;
  let detectedQuotes = false; // Flag para saber si se usan comillas
  let cut = normalized.length;

  // Detección preliminar del fin de la cabecera
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '"') {
      detectedQuotes = true;
      if (inQ && normalized[i + 1] === '"') {
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (!inQ && ch === "\n") {
      cut = i;
      break;
    }
  }

  const firstRecord = normalized.slice(0, cut);
  if (!firstRecord.trim()) return { ok: false, error: "CSV insuficiente: falta cabecera." };

  const countSepUnquoted = (line: string, sepChar: string) => {
    let q = false;
    let count = 0;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          i++;
        } else {
          q = !q;
        }
      } else if (!q && ch === sepChar) {
        count++;
      }
    }
    return count;
  };

  let sep = "|";
  const hasPipe = countSepUnquoted(firstRecord, "|") > 0;
  const hasSemi = countSepUnquoted(firstRecord, ";") > 0;

  if (hasPipe) {
    sep = "|";
  } else if (hasSemi) {
    sep = ";";
  } else {
    const candidates = [",", "\t"];
    const scores = candidates.map((c) => countSepUnquoted(firstRecord, c));
    let bestIdx = 0;
    for (let i = 1; i < candidates.length; i++) {
      if (scores[i] > scores[bestIdx]) bestIdx = i;
    }
    if (scores[bestIdx] > 0) {
      sep = candidates[bestIdx];
    } else {
      // fallback por defecto
      sep = ";";
    }
  }

  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  inQ = false;

  const pushRecordIfNotEmpty = () => {
    const allEmpty = record.every((x) => String(x).trim() === "");
    if (!allEmpty) records.push(record.map((x) => String(x)));
  };

  for (let i = 0; i <= normalized.length; i++) {
    const ch = i === normalized.length ? "\n" : normalized[i];

    if (ch === '"') {
      detectedQuotes = true;
      if (inQ && normalized[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }

    if (!inQ && ch === sep) {
      record.push(field);
      field = "";
      continue;
    }

    if (!inQ && ch === "\n") {
      record.push(field);
      field = "";
      pushRecordIfNotEmpty();
      record = [];
      continue;
    }

    field += ch;
  }

  if (records.length < 2) return { ok: false, error: "CSV insuficiente: falta cabecera o filas." };

  // Filtrar cabeceras vacías para evitar columnas fantasma
  const header = records[0].map((h, idx) => {
    let v = String(h ?? "");
    if (idx === 0 && v.length && v.charCodeAt(0) === 0xfeff) v = v.slice(1);
    return v;
  }).filter(h => h.trim() !== "");

  const rows = [];
  for (let i = 1; i < records.length; i++) {
    const cols = records[i];
    const obj: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      const k = header[c];
      obj[k] = cols[c] ?? "";
    }
    rows.push(obj);
  }

  return { ok: true, value: rows, delimiter: sep, usesQuotes: detectedQuotes };
}

// --- Generación CSV ---

export function generateCsv(rows: Record<string, unknown>[]) {
  if (!rows || !rows.length) return "";

  // 1. Limpiar campos internos
  const cleanRows = rows.map((r) => {
    const { _duracionCalc, _duracionFuente, _rowId, ...rest } = r;
    return rest;
  });

  // 2. Determinar el orden de las columnas:
  const baseKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
  const allKeysSet = new Set(baseKeys);

  cleanRows.forEach(row => {
    Object.keys(row).forEach(k => allKeysSet.add(k));
  });

  let headers = Array.from(allKeysSet);
  headers = headers.filter(h => !h.startsWith("_") && h.trim() !== "");

  // 3. Construir CSV
  const escapeCsv = (val: unknown) => {
    const s = String(val ?? "");
    return `"${s.replace(/"/g, '""')}"`;
  };

  const headerLine = headers.join(";");
  const lines = cleanRows.map(row => {
    return headers.map(h => escapeCsv(row[h])).join(";");
  });

  return [headerLine, ...lines].join("\n");
}

// --- Normalización y Cálculos ---

export function asNumberOrNull(v: unknown) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseRoman(str: string): number | null {
  const s = str.toUpperCase().trim();
  const roman: { [key: string]: number } = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let num = 0;
  for (let i = 0; i < s.length; i++) {
    const curr = roman[s[i]];
    const next = roman[s[i + 1]];
    if (!curr) return null; // Caracter inválido
    if (next && curr < next) {
      num -= curr;
    } else {
      num += curr;
    }
  }
  return num;
}

/**
 * Intenta extraer un año computacional "seguro" de un texto histórico.
 * Soporta: "1452", "c. 850", "Siglo X", "s. XI", "a.C."
 */
export function asYearOrNull(v: unknown) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);

  const s0 = String(v).trim();
  if (!s0) return null;
  const lower = s0.toLowerCase();

  // 1. Detectar si es Antes de Cristo
  const isBC = lower.includes("a.c") || lower.includes("b.c") || lower.includes("antes de cristo");
  const multiplier = isBC ? -1 : 1;

  // 2. Limpieza básica de ruido (c., ca., h., sobre, hacia)
  // Eliminamos caracteres que no sean dígitos, letras de siglo o indicadores de fecha importantes
  // 3. Buscar año de 3 o 4 dígitos explícito (Prioridad 1)
  // Ej: "c. 1450" -> 1450
  const mYear = s0.match(/(?:\b|\D)(\d{3,4})(?:\b|\D)/);
  if (mYear) {
    const year = Number(mYear[1]);
    if (!Number.isNaN(year) && year > 0) return year * multiplier;
  }

  // 4. Abreviaturas de período + siglo romano
  // Detecta: «p. s. IX», «p. t. s. VIII», «m. s. XII», «f. s. X»,
  //          «s. t. s. XI», «ú. t. s. IX», «u. t. s. IX»
  // y formas sin puntos o con variaciones ortográficas.
  // Tabla de offsets dentro del siglo (sobre base = (siglo - 1) * 100):
  //   principios / p. s.      → +1
  //   primer tercio / p.t.s.  → +17
  //   mediados / m. s.        → +50
  //   segundo tercio / s.t.s. → +50
  //   último tercio / ú.t.s.  → +67
  //   finales / f. s.         → +90
  const periodPatterns: [RegExp, number][] = [
    // p. t. s. / primer tercio del siglo  (antes de p. s. para evitar colisión)
    [/(?:p\.?\s*t\.?\s*s\.?|primer\s+tercio(?:\s+del)?\s+s(?:iglo)?\.?)\s*([ivx]+)\b/i, 17],
    // s. t. s. / segundo tercio del siglo
    [/(?:s\.?\s*t\.?\s*s\.?|segundo\s+tercio(?:\s+del)?\s+s(?:iglo)?\.?)\s*([ivx]+)\b/i, 50],
    // ú. t. s. / u. t. s. / último tercio del siglo
    [/(?:[uú]\.?\s*t\.?\s*s\.?|[uú]ltimo\s+tercio(?:\s+del)?\s+s(?:iglo)?\.?)\s*([ivx]+)\b/i, 67],
    // p. s. / principios del siglo
    [/(?:p\.?\s*s\.?\s+|principios?\s+(?:del?\s+)?s(?:iglo)?\.?\s*)([ivx]+)\b/i, 1],
    // m. s. / mediados del siglo
    [/(?:m\.?\s*s\.?\s+|mediados?\s+(?:del?\s+)?s(?:iglo)?\.?\s*)([ivx]+)\b/i, 50],
    // f. s. / finales del siglo
    [/(?:f\.?\s*s\.?\s+|finales?\s+(?:del?\s+)?s(?:iglo)?\.?\s*)([ivx]+)\b/i, 90],
  ];
  for (const [regex, offset] of periodPatterns) {
    const m = s0.match(regex);
    if (m) {
      const century = parseRoman(m[1]);
      if (century !== null) {
        const yearBase = (century - 1) * 100;
        return (yearBase + offset) * multiplier;
      }
    }
  }

  // 5. Buscar Siglos Romanos genéricos (Ej: "Siglo X", "s. XI")
  const mCentury = s0.match(/(?:s(?:iglo)?|c)\.?\s*([ivx]+)\b/i);
  if (mCentury) {
    const roman = mCentury[1];
    const century = parseRoman(roman);
    if (century !== null) {
      let offset = 0;
      if (lower.includes("fin") || lower.includes("tard")) offset = 90;
      else if (lower.includes("med") || lower.includes("mitad")) offset = 50;

      const yearBase = (century - 1) * 100;
      return (yearBase + offset) * multiplier;
    }
  }

  // 5. Fallback: buscar cualquier secuencia de dígitos
  const mAny = s0.replace(",", ".").match(/-?\d+/);
  if (mAny) {
    const n = Number(mAny[0]);
    return Number.isFinite(n) ? Math.trunc(n) * multiplier : null;
  }

  return null;
}

export function yearsBetweenMaybe(start: unknown, end: unknown) {
  // Versión simple basada en años extraídos
  const yStart = asYearOrNull(start);
  const yEnd = asYearOrNull(end);

  if (yStart !== null && yEnd !== null) {
    // Si el año de fin es menor que inicio (error de datos o BC mal gestionado), devolvemos null
    if (yEnd < yStart) return null;
    return yEnd - yStart;
  }

  // Fallback a fechas exactas si el formato lo permite (para ISO estricto)
  const ds = new Date(start as string | number);
  const de = new Date(end as string | number);
  if (!Number.isNaN(ds.getTime()) && !Number.isNaN(de.getTime())) {
    const ms = de.getTime() - ds.getTime();
    const years = ms / (365.2425 * 24 * 3600 * 1000);
    return years >= 0 ? years : null;
  }

  return null;
}

export function normalizeRows(input: unknown) {
  if (Array.isArray(input)) return { ok: true, value: input };
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (Array.isArray(obj.datos)) return { ok: true, value: obj.datos };
    if (Array.isArray(obj.reyes)) return { ok: true, value: obj.reyes };
  }
  return { ok: false, error: 'JSON no reconocido: se esperaba un array o un objeto con clave "datos".' };
}

export function boolFromVerified(v: unknown) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "sí" || s === "si" || s === "true" || s === "1" || s === "x") return true;
  if (s === "no" || s === "false" || s === "0" || s === "") return false;
  return false;
}

export function verifiedToText(b: boolean) {
  return b ? "sí" : "no";
}

export function computeDerivedRow(row: Record<string, unknown>) {
  const dur = asNumberOrNull(row?.duracionAnios ?? row?.["Duración (años)"] ?? row?.["duración (años)"]);
  if (dur !== null) return { ...row, _duracionCalc: dur, _duracionFuente: "duracionAnios" };

  const start = row?.inicioReinado ?? row?.["Inicio Reinado (Fecha)"] ?? row?.["Inicio reinado (fecha)"];
  const end = row?.finReinado ?? row?.["Fin Reinado (Fecha)"] ?? row?.["Fin reinado (fecha)"];
  const calc = yearsBetweenMaybe(start, end);
  if (calc !== null) return { ...row, _duracionCalc: calc, _duracionFuente: "inicio/fin" };

  const ya = asYearOrNull(row?.["Inicio del reinado (año)"] ?? row?.inicioAnio);
  const yb = asYearOrNull(row?.["Final del reinado (año)"] ?? row?.finAnio);
  if (ya !== null && yb !== null && yb >= ya) return { ...row, _duracionCalc: (yb - ya), _duracionFuente: "inicio/fin (año)" };

  return { ...row, _duracionCalc: null, _duracionFuente: "no-disponible" };
}

export function getRowId(row: Record<string, unknown>, idx: number) {
  const v = row?.ID ?? row?.id;
  const s = String(v ?? "").trim();
  return s ? s : `row-${idx + 1}`;
}

export function getPersonId(row: Record<string, unknown>) {
  const v = row?.PersonID ?? row?.personId ?? row?.personID;
  const s = String(v ?? "").trim();
  return s ? s : "";
}

export function rowDisplayName(row: Record<string, unknown>) {
  const n0 = String(row?.Nombre ?? row?.nombre ?? "").trim();
  const a0 = String(row?.Apelativo ?? row?.apelativo ?? "").trim();

  const n = looksLikeUrlText(n0) ? "" : n0;
  const a = looksLikeUrlText(a0) ? "" : a0;

  if (!n && !a) return "(sin nombre)";
  if (n && a) return `${n} ${a}`;
  return n || a;
}

export function firstNonEmpty(...vals: unknown[]) {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

export function normalizeUrl(v: unknown) {
  const s0 = String(v ?? "").trim();
  if (!s0) return "";
  if (/^https?:\/\//i.test(s0)) return s0;
  if (/^\/\//.test(s0)) return `https:${s0}`;
  if (/^www\./i.test(s0)) return `https://${s0}`;
  return s0;
}

export function looksLikeUrlText(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  if (/^www\./i.test(s)) return true;
  return false;
}

export function toRoman(n: unknown) {
  const x = asNumberOrNull(n);
  if (x === null) return "";
  const v = Math.trunc(x);
  if (!(v >= 1 && v <= 3999)) return "";
  const map: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let r = "";
  let t = v;
  for (const [val, sym] of map) {
    while (t >= val) {
      r += sym;
      t -= val;
    }
  }
  return r;
}

export function centuryFromYear(y: unknown) {
  const n = asYearOrNull(y);
  if (n === null) return null;
  const c = Math.floor((n - 1) / 100) + 1;
  return Number.isFinite(c) ? c : null;
}

export function formatCenturyLabel(c: unknown) {
  const n = asNumberOrNull(c);
  if (n === 0) return "siglo 0";
  const r = toRoman(n);
  return r ? `siglo ${r}` : "";
}
