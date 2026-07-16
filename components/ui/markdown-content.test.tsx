import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "./markdown-content";

describe("MarkdownContent", () => {
  it("representa Markdown y conserva los saltos de línea de los textos existentes", () => {
    const html = renderToStaticMarkup(
      <MarkdownContent content={"**Alfonso X**\nEl Sabio\n\n- Castilla\n- León"} />
    );

    expect(html).toContain("<strong>Alfonso X</strong><br/>");
    expect(html).toContain("El Sabio");
    expect(html).toContain("<ul");
    expect(html).toContain(">Castilla</li>");
    expect(html).toContain(">León</li>");
  });

  it("admite tablas mediante la sintaxis Markdown extendida", () => {
    const html = renderToStaticMarkup(
      <MarkdownContent content={"| Reino | Año |\n| --- | ---: |\n| León | 1252 |"} />
    );

    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("León");
  });

  it("omite HTML, imágenes y destinos de enlace peligrosos", () => {
    const unsafeProtocol = ["java", "script"].join("");
    const html = renderToStaticMarkup(
      <MarkdownContent
        content={`<script>alert("xss")</script>\n\n[enlace](${unsafeProtocol}:alert(1))\n\n![retrato](https://example.test/retrato.jpg)`}
      />
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(&quot;xss&quot;)");
    expect(html).not.toContain(`${unsafeProtocol}:`);
    expect(html).not.toContain("<img");
    expect(html).toContain("Imagen Markdown omitida: retrato");
  });

  it("protege los enlaces externos abiertos en otra pestaña", () => {
    const html = renderToStaticMarkup(
      <MarkdownContent content="[RAH](https://historia-hispanica.rah.es/)" />
    );

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
