import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PersonListPanel } from "./person-list-panel";

function renderPanel(): string {
  const noop = vi.fn();

  return renderToStaticMarkup(
    <PersonListPanel
      people={[]}
      totalPeopleCount={0}
      rowsCount={0}
      query=""
      setQuery={noop}
      literalSearch={false}
      setLiteralSearch={noop}
      filterReino="__all__"
      setFilterReino={noop}
      filterDinastia="__all__"
      setFilterDinastia={noop}
      filterSiglo="__all__"
      setFilterSiglo={noop}
      setFilterDinastiaLocked={noop}
      sortKey="cronologia"
      setSortKey={noop}
      sortDir="asc"
      setSortDir={noop}
      sortOptions={{ "cronologia:asc": "cronología: más antiguos a más recientes" }}
      selectedPersonId={null}
      selectedGovernmentRowId={null}
      setSelectedGovernment={noop}
      onSearchSubmit={noop}
      reinos={[]}
      dinastias={[]}
      siglos={[]}
      mediaAssets={[]}
      mediaPreviewUrls={{}}
      onCollapse={noop}
    />
  );
}

describe("PersonListPanel", () => {
  it("permite ocultar solo los filtros sin ocultar las miniaturas", () => {
    const markup = renderPanel();

    expect(markup).toContain('aria-label="Ocultar filtros"');
    expect(markup).toContain('aria-controls="person-list-filters"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('id="person-list-filters"');
  });

  it("sitúa la búsqueda literal junto al restablecimiento sin texto redundante", () => {
    const markup = renderPanel();
    const literalSearchIndex = markup.indexOf("Búsqueda literal");
    const resetFiltersIndex = markup.indexOf("restablecer filtros");

    expect(literalSearchIndex).toBeGreaterThan(-1);
    expect(resetFiltersIndex).toBeGreaterThan(literalSearchIndex);
    expect(markup.match(/Búsqueda literal/g)).toHaveLength(1);
    expect(markup).not.toContain("coincidencia exacta");
  });
});
