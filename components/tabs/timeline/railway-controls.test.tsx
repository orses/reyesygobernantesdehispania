import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RAILWAY_KINGDOMS, type RailwayKingdom } from "../../../lib/railway";
import { RailwayControls } from "./railway-controls";

const stationCounts: Record<RailwayKingdom, number> = {
  Asturias: 3,
  León: 2,
  Galicia: 1,
  Castilla: 0,
};

describe("RailwayControls", () => {
  it("muestra los reinos en el orden del catálogo, con color y recuento", () => {
    const html = renderToStaticMarkup(
      <RailwayControls
        selectedKingdoms={["Asturias", "Galicia"]}
        stationCounts={stationCounts}
        onToggleKingdom={vi.fn()}
        onResetKingdoms={vi.fn()}
      />
    );

    const positions = RAILWAY_KINGDOMS.map((kingdom) => html.indexOf(`>${kingdom}</span>`));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(html).toContain("3 marcadores");
    expect(html).toContain("1 marcador");
    expect(html).toContain("#00468C");
    expect(html).toContain("#702963");
    expect(html).toContain("#0079AF");
    expect(html).toContain("#C2354A");
    expect(html).toContain("solo poda la vista");
    expect(html).toContain("no recalcula la historia ni sus relaciones");
  });

  it("permite representar una selección vacía sin activar Todos", () => {
    const html = renderToStaticMarkup(
      <RailwayControls
        selectedKingdoms={[]}
        stationCounts={stationCounts}
        onToggleKingdom={vi.fn()}
        onResetKingdoms={vi.fn()}
      />
    );

    expect(html.match(/aria-pressed="false"/g)).toHaveLength(RAILWAY_KINGDOMS.length + 1);
    expect(html).not.toContain('aria-pressed="true"');
  });
});
