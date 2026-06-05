import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VerifiedBadge } from "./verified-badge";

// `react-dom/server` renderiza a string sin necesidad de jsdom, en línea con
// la estrategia del proyecto de probar piezas de forma aislada y determinista.
const render = (verified: boolean) => renderToStaticMarkup(<VerifiedBadge verified={verified} />);

// Trazo del check verde y trazos de la antigua interrogación "sin verificar",
// que NUNCA deben aparecer (la ausencia es el estado no verificado).
const CHECK_PATH = "m8.5 12.5 2.5 2.5 4.5-5";
const QUESTION_PATH = "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3";

describe("VerifiedBadge", () => {
  describe("cuando la ficha está verificada (verified=true)", () => {
    const html = render(true);

    it("renderiza contenido (no es vacío)", () => {
      expect(html).not.toBe("");
      expect(html).toContain("<svg");
    });

    it("pinta el check verde y no el icono de interrogación", () => {
      expect(html).toContain(CHECK_PATH);
      expect(html).not.toContain(QUESTION_PATH);
    });

    it("usa el color verde de marca (emerald-400)", () => {
      expect(html).toContain("text-emerald-400");
      expect(html).not.toContain("text-red");
    });

    it("se mantiene discreto: tamaño h-3.5 w-3.5", () => {
      expect(html).toContain("h-3.5");
      expect(html).toContain("w-3.5");
    });

    it("expone semántica accesible coherente", () => {
      expect(html).toContain('aria-label="ficha verificada"');
      expect(html).toContain('title="ficha verificada"');
    });
  });

  describe("cuando la ficha no está verificada (verified=false)", () => {
    const html = render(false);

    it("no renderiza nada (string vacío)", () => {
      expect(html).toBe("");
    });

    it("no filtra ningún icono ni etiqueta de estado", () => {
      expect(html).not.toContain("<svg");
      expect(html).not.toContain(CHECK_PATH);
      expect(html).not.toContain(QUESTION_PATH);
      expect(html).not.toContain("aria-label");
    });
  });

  it("es determinista: misma entrada produce misma salida", () => {
    expect(render(true)).toBe(render(true));
    expect(render(false)).toBe(render(false));
  });
});
