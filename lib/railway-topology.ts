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
  version: "reinos-occidentales-1.2.0",
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
  mainlineSegments: [
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
      id: "troncal-castilla-desde-1066",
      kingdom: "Castilla",
      startYear: 1066,
      endYear: null,
      label: "Castilla, vía troncal desde 1066",
    },
  ],
};
