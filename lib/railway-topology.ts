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
  version: "reinos-occidentales-1.4.0",
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
    // El hito de 1252 refleja la periodización de las filas cargadas; no
    // desplaza a ese año la unión política de Castilla y León declarada en 1230.
    {
      id: "relevo-periodizacion-castellana-1252",
      kind: "transformation",
      year: 1252,
      from: "Castilla",
      to: "Corona de Castilla",
      label: "Relevo de periodización tras Fernando III",
    },
    {
      id: "integracion-corona-castilla-monarquia-hispanica-1516",
      kind: "integration",
      year: 1516,
      from: "Corona de Castilla",
      to: "Monarquía Hispánica / España",
      label: "Integración de la Corona de Castilla en la Monarquía Hispánica",
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
    // El relevo troncal de 1516 no es una fusión: la vía documentada de la
    // Corona de Castilla continúa hasta 1555 y se solapa con esta nueva etapa.
    {
      id: "troncal-monarquia-hispanica-desde-1516",
      kingdom: "Monarquía Hispánica / España",
      startYear: 1516,
      endYear: null,
      label: "Monarquía Hispánica / España, vía troncal desde 1516",
    },
  ],
};
