import { describe, expect, it } from "vitest";
import {
  developmentCspDirectives,
  productionCspDirectives,
  securityHeaders,
  serializeCsp,
} from "./security";

describe("securityHeaders", () => {
  it("incluye cabeceras defensivas para entornos con soporte HTTP", () => {
    expect(securityHeaders).toMatchObject({
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    expect(securityHeaders["Permissions-Policy"]).toContain("camera=()");
    expect(securityHeaders["Permissions-Policy"]).toContain("microphone=()");
  });
});

describe("Content-Security-Policy", () => {
  it("serializa directivas CSP de forma estable", () => {
    expect(serializeCsp({
      "default-src": ["'self'"],
      "object-src": ["'none'"],
    })).toBe("default-src 'self'; object-src 'none'");
  });

  it("mantiene la CSP de producción sin permisos propios de desarrollo", () => {
    const serialized = serializeCsp(productionCspDirectives);

    expect(serialized).toContain("default-src 'self'");
    expect(serialized).toContain("script-src 'self'");
    expect(serialized).toContain("style-src 'self'");
    expect(serialized).toContain("style-src-elem 'self'");
    expect(serialized).toContain("style-src-attr 'unsafe-inline'");
    expect(serialized).toContain("object-src 'none'");
    expect(serialized).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(serialized).not.toContain("style-src 'self' 'unsafe-inline'");
    expect(serialized).not.toContain("style-src-elem 'self' 'unsafe-inline'");
    expect(serialized).not.toContain("ws:");
  });

  it("habilita solo las concesiones necesarias para HMR en desarrollo", () => {
    const serialized = serializeCsp(developmentCspDirectives);

    expect(serialized).toContain("script-src 'self' 'unsafe-inline'");
    expect(serialized).toContain("style-src-elem 'self' 'unsafe-inline'");
    expect(serialized).toContain("connect-src 'self' ws:");
  });
});
