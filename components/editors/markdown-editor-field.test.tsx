import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MarkdownEditorField } from "./markdown-editor-field";

describe("MarkdownEditorField", () => {
  it("ofrece escritura por sintaxis y copia, sin barra de formato", () => {
    const html = renderToStaticMarkup(
      <MarkdownEditorField
        label="Descripción"
        value="**Texto completo**\nSegunda línea"
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("Descripción");
    expect(html).toContain("Admite Markdown por sintaxis");
    expect(html).toContain("Copiar contenido");
    expect(html).toContain("**Texto completo**");
    expect(html).toContain("Segunda línea");
    expect(html).not.toContain("Insertar negrita");
    expect(html).not.toContain("Insertar enlace");
  });
});
