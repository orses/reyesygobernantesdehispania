import { describe, expect, it } from "vitest";
import {
  RIGHTS_OPTIONS,
  calculatedMeta,
  centuryBadgeStyle,
  chronologyMeta,
  durationMeta,
  dynastyColor,
  dynastyBadgeStyle,
  isApproxDate,
  kingdomBadgeStyle,
  kingdomColor,
  mediaAssetSrc,
  personDenominationsByKingdom,
  personGovernmentPeriods,
  personImageFallbackUrl,
  personLifeFields,
  personRahUrl,
  personReignRangeLabel,
  rangeMeta,
  rightsLabel,
} from "./ficha-view";
import type { MediaAsset } from "./types";

const baseMediaAsset = {
  id: "media-1",
  personId: "1",
  rightsStatus: "unknown",
  isPrimary: false,
  createdAt: "2026-05-17T00:00:00.000Z",
} satisfies Pick<MediaAsset, "id" | "personId" | "rightsStatus" | "isPrimary" | "createdAt">;

describe("colores de fichas", () => {
  it("resuelve reinos con tildes y nombres compuestos", () => {
    expect(kingdomColor("Monarquía Hispánica / España")).toBe("#B12B30");
    expect(kingdomColor("Reino de León")).toBe("#702963");
  });

  it("distingue visualmente Trastámara y Borbón", () => {
    const trastamara = dynastyBadgeStyle("Trastámara");
    const borbon = dynastyBadgeStyle("Borbón");

    expect(trastamara.borderColor).toContain("#b91c1c");
    expect(borbon.borderColor).toContain("#2563eb");
    expect(trastamara.borderColor).not.toBe(borbon.borderColor);
  });

  it("genera un color estable para dinastías no catalogadas", () => {
    expect(dynastyColor("Casa inventada")).toMatch(/^hsl\(\d+ 62% 42%\)$/);
  });

  it("marca el badge activo con color sólido", () => {
    expect(centuryBadgeStyle("8", true)).toMatchObject({
      backgroundColor: expect.stringMatching(/^hsl\(/),
      color: "#ffffff",
    });
  });

  it("usa color de respaldo para reinos sin color conocido", () => {
    expect(kingdomBadgeStyle("Señorío sin catálogo").borderColor).toContain("#64748b");
  });
});

describe("metadatos de procedencia de datos", () => {
  it("no muestra indicador cuando falta el dato cronológico", () => {
    expect(chronologyMeta("")).toBeUndefined();
  });

  it("marca como original un año explícito", () => {
    expect(chronologyMeta("737")).toMatchObject({
      kind: "original",
      label: "Original",
    });
  });

  it("marca como inferida una fecha expresada por siglo", () => {
    expect(chronologyMeta("siglo VIII")).toMatchObject({
      kind: "inferred",
      label: "Inferido",
    });
  });

  it("distingue duración original y duración calculada", () => {
    expect(durationMeta("duracionAnios")).toMatchObject({ kind: "original" });
    expect(durationMeta("inicio/fin (año)")).toMatchObject({ kind: "calculated" });
  });

  it("usa metadato calculado genérico si no hay fuente concreta de duración", () => {
    expect(durationMeta("no-disponible")).toMatchObject({
      kind: "calculated",
      tooltip: "Calculado con los datos cronológicos disponibles.",
    });
  });

  it("clasifica rangos explícitos, inferidos y sin cronología completa", () => {
    expect(rangeMeta(999, 1028)).toMatchObject({ kind: "original" });
    expect(rangeMeta("s. VIII", 737)).toMatchObject({ kind: "inferred" });
    expect(rangeMeta("", "")).toMatchObject({ kind: "calculated" });
  });

  it("detecta si una fecha de edad es aproximada", () => {
    expect(isApproxDate("737")).toBe(false);
    expect(isApproxDate("-44")).toBe(false);
    expect(isApproxDate("c. 737")).toBe(true);
    expect(isApproxDate("siglo VIII")).toBe(true);
  });

  it("crea metadatos calculados explícitos para valores derivados", () => {
    expect(calculatedMeta("Calculado desde nacimiento y fallecimiento.")).toEqual({
      kind: "calculated",
      label: "Calculado",
      tooltip: "Calculado desde nacimiento y fallecimiento.",
    });
  });
});

describe("metadatos visuales de imágenes", () => {
  it("mantiene el orden público de estados de derechos", () => {
    expect(RIGHTS_OPTIONS.map((option) => option.value)).toEqual([
      "unknown",
      "public-domain",
      "licensed",
      "copyrighted",
    ]);
  });

  it("devuelve etiquetas de derechos conocidas y usa una por defecto", () => {
    expect(rightsLabel("public-domain")).toBe("dominio público");
    expect(rightsLabel("licensed")).toBe("licencia documentada");
    expect(rightsLabel("sin-catalogar" as never)).toBe("derechos desconocidos");
  });

  it("normaliza la fuente de una imagen externa", () => {
    const asset: MediaAsset = {
      ...baseMediaAsset,
      kind: "external-url",
      src: "www.example.com/pelayo.jpg",
    };

    expect(mediaAssetSrc(asset, {})).toBe("https://www.example.com/pelayo.jpg");
  });

  it("resuelve la previsualización local de una imagen subida", () => {
    const asset: MediaAsset = {
      ...baseMediaAsset,
      kind: "uploaded-file",
      src: "",
      storageKey: "blob-key",
      fileName: "pelayo.jpg",
    };

    expect(mediaAssetSrc(asset, { "media-1": "blob:http://local/media-1" })).toBe("blob:http://local/media-1");
    expect(mediaAssetSrc(asset, {})).toBe("");
  });
});

describe("tarjetas de personaje", () => {
  it("calcula el rango visible con todos los gobiernos del personaje", () => {
    expect(
      personReignRangeLabel({
        reinados: [
          { "Inicio del reinado (año)": 1479, "Final del reinado (año)": 1516 },
          { "Inicio del reinado (año)": 1512, "Final del reinado (año)": 1516 },
        ],
      })
    ).toBe("1479 - 1516");
  });

  it("usa años inferidos de siglos cuando no hay año exacto", () => {
    expect(
      personReignRangeLabel({
        reinados: [
          { "Inicio del reinado (año)": "siglo VIII", "Final del reinado (año)": 737 },
        ],
      })
    ).toBe("737 - 750");
  });

  it("devuelve raya cuando no hay cronología utilizable", () => {
    expect(personReignRangeLabel({ reinados: [{ Nombre: "sin años" }] })).toBe("—");
  });
});

describe("detalle de ficha", () => {
  it("prioriza fechas cronológicas sobre lugares en los campos vitales", () => {
    expect(
      personLifeFields({
        reinados: [
          {
            "Nacimiento (Fecha)": "19 de diciembre de 1683",
            "Nacimiento (lugar)": "Versalles",
            "Fallecimiento (Fecha)": "9 de julio de 1746",
            "Fallecimiento (lugar)": "Madrid",
          },
        ],
      })
    ).toEqual({
      birthRaw: "19 de diciembre de 1683",
      deathRaw: "9 de julio de 1746",
      birthDisplay: "19 de diciembre de 1683",
      deathDisplay: "9 de julio de 1746",
    });
  });

  it("usa lugar o ciudad cuando no hay fecha vital", () => {
    expect(
      personLifeFields({
        reinados: [
          {
            "Nacimiento (lugar)": "Sos",
            "Fallecimiento (ciudad)": "Madrigalejo",
          },
        ],
      })
    ).toMatchObject({
      birthRaw: "",
      deathRaw: "",
      birthDisplay: "Sos",
      deathDisplay: "Madrigalejo",
    });
  });

  it("devuelve campos vitales vacíos cuando no hay personaje seleccionado", () => {
    expect(personLifeFields(null)).toEqual({
      birthRaw: "",
      deathRaw: "",
      birthDisplay: "",
      deathDisplay: "",
    });
  });

  it("deduplica denominaciones por pareja de reino y nombre visible", () => {
    expect(
      personDenominationsByKingdom({
        reinados: [
          { Reino: "Corona de Castilla", Nombre: "Fernando V" },
          { Reino: "Corona de Castilla", Nombre: "Fernando V" },
          { Reino: "Corona de Aragón", Nombre: "Fernando II" },
        ],
      })
    ).toEqual([
      { reino: "Corona de Castilla", nombre: "Fernando V" },
      { reino: "Corona de Aragón", nombre: "Fernando II" },
    ]);
  });

  it("normaliza la URL principal de la ficha RAH", () => {
    expect(
      personRahUrl({
        reinados: [{ "Ficha RAH URL": "www.rah.es/ficha/pelayo" }],
      })
    ).toBe("https://www.rah.es/ficha/pelayo");
  });

  it("devuelve la primera imagen heredada disponible del personaje", () => {
    expect(
      personImageFallbackUrl({
        reinados: [
          { "Imagen URL": "" },
          { "Imagen URL": "https://example.com/alfonso.jpg" },
        ],
      })
    ).toBe("https://example.com/alfonso.jpg");
  });

  it("conserva gobiernos repetidos y discontinuos en el mismo reino", () => {
    const periods = personGovernmentPeriods({
      reinados: [
        {
          _rowId: "leon-1",
          Reino: "Reino de León",
          Nombre: "Alfonso",
          "Inicio del reinado (año)": 1000,
          "Final del reinado (año)": 1005,
        },
        {
          _rowId: "castilla-1",
          Reino: "Reino de Castilla",
          Nombre: "Alfonso",
          "Inicio del reinado (año)": 1005,
          "Final del reinado (año)": 1010,
        },
        {
          _rowId: "leon-2",
          Reino: "Reino de León",
          Nombre: "Alfonso",
          "Inicio del reinado (año)": 1012,
          "Final del reinado (año)": 1028,
        },
      ],
    });

    expect(periods.map((period) => [period.rowId, period.reino, period.inicio, period.fin])).toEqual([
      ["leon-1", "Reino de León", 1000, 1005],
      ["castilla-1", "Reino de Castilla", 1005, 1010],
      ["leon-2", "Reino de León", 1012, 1028],
    ]);
  });

  it("mantiene periodos sin reino, con ID alternativo y duración inválida sin fusionarlos", () => {
    const periods = personGovernmentPeriods({
      reinados: [
        { ID: "legacy-row", Nombre: "Sin reino", _duracionCalc: Number.NaN },
        { Nombre: "Sin ID", Reino: "", _duracionCalc: null },
      ],
    });

    expect(periods).toMatchObject([
      { rowId: "legacy-row", reino: "(sin reino)", duration: null },
      { rowId: "period-2", reino: "(sin reino)", duration: null },
    ]);
  });
});
