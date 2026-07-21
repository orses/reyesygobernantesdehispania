import type { RailwayTransitionCatalog } from "./railway";

/**
 * Topología inicial de los reinos occidentales.
 *
 * Los sucesos son decisiones historiográficas explícitas: no se deducen de
 * coincidencias de fechas ni de que una persona figure en varios reinos. El
 * catálogo puede sustituirse o ampliarse sin alterar los gobiernos cargados.
 */
export const WESTERN_KINGDOMS_RAILWAY_TOPOLOGY: RailwayTransitionCatalog = {
  schemaVersion: 1,
  version: "reinos-occidentales-1.1.0",
  transitions: [
    {
      id: "division-alfonso-iii-910",
      kind: "split",
      year: 910,
      from: "Asturias",
      to: ["Asturias", "León", "Galicia"],
      label: "División tras Alfonso III",
    },
    {
      id: "ordono-ii-leon-914",
      kind: "merge",
      year: 914,
      from: ["Galicia", "León"],
      to: "León",
      label: "Ordoño II accede a León",
    },
    {
      id: "fruela-ii-leon-924",
      kind: "merge",
      year: 924,
      from: ["Asturias", "León"],
      to: "León",
      label: "Fruela II reúne Asturias y León",
    },
    {
      id: "division-fernando-i-1066",
      kind: "split",
      year: 1066,
      from: "León",
      to: ["León", "Galicia", "Castilla"],
      label: "División de la herencia de Fernando I",
    },
    {
      id: "union-leon-castilla-1072",
      kind: "dynastic-union",
      year: 1072,
      kingdoms: ["León", "Castilla"],
      label: "León y Castilla comparten monarca",
    },
    {
      id: "union-leon-galicia-1073",
      kind: "dynastic-union",
      year: 1073,
      kingdoms: ["León", "Galicia"],
      label: "León y Galicia comparten monarca",
    },
    {
      id: "separacion-leon-castilla-1157",
      kind: "dynastic-separation",
      year: 1157,
      kingdoms: ["León", "Castilla"],
      label: "División sucesoria tras Alfonso VII",
    },
    {
      id: "union-definitiva-1230",
      kind: "dynastic-union",
      year: 1230,
      kingdoms: ["León", "Castilla"],
      label: "Unión dinástica definitiva",
    },
  ],
};

/** Referencias de contraste empleadas al preparar el catálogo inicial. */
export const WESTERN_KINGDOMS_RAILWAY_SOURCES: Record<string, string> = {
  "division-alfonso-iii-910":
    "https://historia-hispanica.rah.es/hechos/1438376-910-20-xii",
  "ordono-ii-leon-914":
    "https://historia-hispanica.rah.es/biografias/33847-ordono-ii",
  "fruela-ii-leon-924":
    "https://historia-hispanica.rah.es/biografias/17353-fruela-ii",
  "division-fernando-i-1066":
    "https://historia-hispanica.rah.es/biografias/41191-sancho-ii",
  "union-leon-castilla-1072":
    "https://historia-hispanica.rah.es/biografias/904-alfonso-vi",
  "union-leon-galicia-1073":
    "https://historia-hispanica.rah.es/biografias/904-alfonso-vi",
  "separacion-leon-castilla-1157":
    "https://historia-hispanica.rah.es/hechos/1440083-1157-21-viii",
  "union-definitiva-1230":
    "https://historia-hispanica.rah.es/hechos/1442240-1230-2-xii",
};
