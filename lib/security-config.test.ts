import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(projectRoot, ...segments), "utf8");
}

describe("configuración de seguridad del repositorio", () => {
  const deployWorkflow = readProjectFile(".github", "workflows", "deploy.yml");
  const securityWorkflow = readProjectFile(".github", "workflows", "security.yml");
  const codeqlWorkflow = readProjectFile(".github", "workflows", "codeql.yml");
  const codeqlConfig = readProjectFile(".github", "codeql", "codeql-config.yml");
  const dependabotConfig = readProjectFile(".github", "dependabot.yml");
  const allWorkflows = [deployWorkflow, securityWorkflow, codeqlWorkflow].join("\n");

  it("evita disparadores peligrosos y permisos globales de escritura", () => {
    expect(allWorkflows).not.toMatch(/\bpull_request_target\b/);
    expect(allWorkflows).not.toMatch(/contents:\s*write/);
  });

  it("bloquea el despliegue de GitHub Pages si no pasa la verificación completa", () => {
    expect(deployWorkflow).toMatch(/pull_request:[\s\S]*branches:\s*\[main\]/);
    expect(deployWorkflow).toContain("npm run verify");
    expect(deployWorkflow).toContain("actions/checkout@v7");
    expect(deployWorkflow).toContain("actions/setup-node@v6");
    expect(deployWorkflow).toContain("actions/configure-pages@v6");
    expect(deployWorkflow).toContain("actions/upload-pages-artifact@v5");
    expect(deployWorkflow).toContain("actions/deploy-pages@v5");
    expect(deployWorkflow).toContain("if: github.event_name != 'pull_request'");
    expect(deployWorkflow).toMatch(/deploy:[\s\S]*pages:\s*write/);
    expect(deployWorkflow).toMatch(/deploy:[\s\S]*id-token:\s*write/);
  });

  it("mantiene auditoría, cobertura y revisión de dependencias en CI", () => {
    expect(securityWorkflow).toContain("npm run verify");
    expect(securityWorkflow).toContain("actions/dependency-review-action@v5");
    expect(securityWorkflow).toContain("fail-on-severity: moderate");
    expect(securityWorkflow).toContain("schedule:");
  });

  it("activa CodeQL para JavaScript y TypeScript con consultas ampliadas", () => {
    expect(codeqlWorkflow).toContain("github/codeql-action/init@v4");
    expect(codeqlWorkflow).toContain("github/codeql-action/analyze@v4");
    expect(codeqlWorkflow).toContain("languages: javascript-typescript");
    expect(codeqlWorkflow).toContain("config-file: ./.github/codeql/codeql-config.yml");
    expect(codeqlConfig).toContain("uses: security-extended");
    expect(codeqlConfig).toContain("uses: security-and-quality");
    expect(codeqlConfig).toContain("coverage/**");
  });

  it("mantiene Dependabot para npm y GitHub Actions", () => {
    expect(dependabotConfig).toContain("package-ecosystem: npm");
    expect(dependabotConfig).toContain("package-ecosystem: github-actions");
    expect(dependabotConfig).toContain("timezone: Europe/Madrid");
    expect(dependabotConfig).toContain("version-update:semver-major");
    expect(dependabotConfig).toContain("actions-minor-and-patch");
  });

  it("mantiene la puerta de verificación en package.json", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.verify).toContain("npm run lint");
    expect(packageJson.scripts.verify).toContain("npm run typecheck");
    expect(packageJson.scripts.verify).toContain("npm run test:coverage");
    expect(packageJson.scripts.verify).toContain("npm run build");
    expect(packageJson.scripts.verify).toContain("npm run security:lockfile");
  });

  it("deja la CSP del HTML en manos del módulo probado de Vite", () => {
    expect(readProjectFile("index.html")).toContain("__CONTENT_SECURITY_POLICY__");
    expect(readProjectFile("vite.config.ts")).toContain("productionCspDirectives");
  });
});
