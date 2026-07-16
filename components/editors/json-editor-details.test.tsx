import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { JsonEditorDetails } from "./json-editor-details";

describe("JsonEditorDetails", () => {
  it("muestra el título, la explicación, el JSON completo y su acción de copia", () => {
    const html = renderToStaticMarkup(
      <JsonEditorDetails
        title="Datos completos del personaje (Edición JSON)"
        description="Edite el objeto completo."
        value={{ PersonID: "alfonso", Gobiernos: [{ Reino: "Reino de León" }] }}
        validate={(value) => ({ ok: true, value })}
        onValidChange={vi.fn()}
        onErrorChange={vi.fn()}
      />
    );

    expect(html).toContain("Datos completos del personaje (Edición JSON)");
    expect(html).toContain("Edite el objeto completo.");
    expect(html).toContain("Copiar JSON");
    expect(html).toContain("&quot;PersonID&quot;: &quot;alfonso&quot;");
    expect(html).toContain("&quot;Reino&quot;: &quot;Reino de León&quot;");
  });
});
