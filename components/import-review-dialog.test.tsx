import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MediaImportReview } from "../lib/media-import";
import {
  buildImportReviewCandidateOptions,
  createMediaImportRepairs,
  ImportReviewDialog,
  validateImportReviewPlan,
} from "./import-review-dialog";

const review: MediaImportReview = {
  kind: "orphan-media-person-references",
  summary: "Un medio hace referencia a un PersonID inexistente.",
  issues: [{
    issueId: "issue-69",
    code: "missing-media-person-reference",
    mediaIndex: 15,
    jsonPath: "mediaAssets[15].personId",
    mediaId: "media-69-kzyjm5",
    personId: "69",
    kind: "external-url",
    url: "https://example.test/Gonzalo_Tellez.jpg",
  }],
  candidates: [{
    personId: "68",
    name: "Gonzalo Fernández",
    contexts: ["Condado de Castilla · 909–915"],
  }],
};

describe("revisión de importación", () => {
  it("exige una decisión explícita y valida el destino", () => {
    expect(validateImportReviewPlan(review.issues, review.candidates, {}).ok).toBe(false);
    expect(validateImportReviewPlan(review.issues, review.candidates, {
      "issue-69": { action: "reassign", personId: "999" },
    }).invalidReassignmentIssueIds).toEqual(["issue-69"]);
    expect(validateImportReviewPlan(review.issues, review.candidates, {
      "issue-69": { action: "omit" },
    }).ok).toBe(true);
  });

  it("convierte el plan en reparaciones ordenadas por las incidencias", () => {
    expect(createMediaImportRepairs(review.issues, {
      "issue-69": { action: "reassign", personId: " 68 " },
    })).toEqual([{ issueId: "issue-69", action: "reassign", personId: "68" }]);
  });

  it("crea opciones buscables con nombre, PersonID y contexto", () => {
    expect(buildImportReviewCandidateOptions(review.candidates)[0]).toMatchObject({
      value: "68",
      name: "Gonzalo Fernández",
      context: "Condado de Castilla · 909–915",
    });
  });

  it("muestra el diagnóstico localizable y bloquea la aplicación inicial", () => {
    const html = renderToStaticMarkup(
      <ImportReviewDialog
        open
        fileName="cronología.zip"
        review={review}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain("mediaAssets[15].personId");
    expect(html).toContain("media-69-kzyjm5");
    expect(html).toContain("Gonzalo_Tellez.jpg");
    expect(html).toContain("restaurar la fila ausente");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Importar con correcciones<\/button>/);
  });

  it("expone el error de revalidación sin ocultar las alternativas", () => {
    const html = renderToStaticMarkup(
      <ImportReviewDialog
        open
        fileName="cronología.zip"
        review={review}
        resolutionError="El archivo ha cambiado."
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("El archivo ha cambiado.");
    expect(html).toContain("corregir el archivo de origen");
  });
});
