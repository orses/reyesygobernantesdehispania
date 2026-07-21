import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TimelineDisplaySwitch } from "./timeline-display-switch";

describe("TimelineDisplaySwitch", () => {
  it("expone las dos visualizaciones y marca la activa", () => {
    const html = renderToStaticMarkup(
      <TimelineDisplaySwitch value="railway" onChange={vi.fn()} />
    );

    expect(html).toContain("Visualización cronológica");
    expect(html).toContain("Ferrocarril");
    expect(html).toContain("Periodos");
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*Ferrocarril/s);
  });
});
