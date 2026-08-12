import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DataTab } from "./data-tab";

describe("DataTab", () => {
  it("asocia el nombre del archivo y nombra el selector de imágenes", () => {
    const markup = renderToStaticMarkup(
      <DataTab
        rows={[]}
        datasetName="gobernantes"
        setDatasetName={vi.fn()}
        imagePrintProfile="original"
        setImagePrintProfile={vi.fn()}
      />
    );

    expect(markup).toContain('<label for="dataset-name"');
    expect(markup).toContain('id="dataset-name"');
    expect(markup).toContain('aria-label="Perfil de imágenes en ZIP"');
  });
});
