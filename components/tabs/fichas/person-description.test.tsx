import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PersonDescription } from "./person-description";

describe("PersonDescription", () => {
  it("integra el renderizado Markdown en la descripción de la ficha", () => {
    const html = renderToStaticMarkup(
      <PersonDescription description="**Reina propietaria** de Castilla" />
    );

    expect(html).toContain("<strong>Reina propietaria</strong>");
  });

  it("mantiene el indicador de dato vacío", () => {
    expect(renderToStaticMarkup(<PersonDescription description="  " />)).toContain("—");
  });
});
