import { describe, expect, it } from "vitest";
import { normalizeHashPath, toHashHref } from "./hash-router";

describe("normalizeHashPath", () => {
  it("conserva las rutas internas normalizadas", () => {
    expect(normalizeHashPath("/fichas/103")).toBe("/fichas/103");
  });

  it("añade la barra inicial y elimina barras duplicadas", () => {
    expect(normalizeHashPath(" fichas//103 ")).toBe("/fichas/103");
  });

  it("convierte una ruta vacía en la raíz", () => {
    expect(normalizeHashPath("  ")).toBe("/");
  });
});

describe("toHashHref", () => {
  it("solo genera destinos internos basados en hash", () => {
    expect(toHashHref("https://example.test/path")).toBe("#/https:/example.test/path");
  });
});
