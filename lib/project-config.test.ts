import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readProjectFile(...segments: string[]): string {
    return readFileSync(join(projectRoot, ...segments), "utf8");
}

describe("regresión: línea base reproducible del proyecto", () => {
    it("mantiene fuera de Git los informes generados de cobertura", () => {
        const ignoredEntries = readProjectFile(".gitignore")
            .split(/\r?\n/u)
            .map((entry) => entry.trim());

        expect(ignoredEntries).toContain("coverage");
    });

    it("declara las versiones de Node y npm utilizadas por el proyecto", () => {
        const packageJson = JSON.parse(readProjectFile("package.json")) as {
            engines?: { node?: string };
            packageManager?: string;
            scripts: Record<string, string>;
        };

        expect(readProjectFile(".nvmrc").trim()).toBe("22.22.3");
        expect(packageJson.engines?.node).toBe("22.22.3");
        expect(packageJson.packageManager).toBe("npm@10.9.8");
        expect(packageJson.scripts["test:all"]).toBe("vitest run");
    });

    it("genera informes explícitos sin mezclar futuras pruebas de navegador", () => {
        const viteConfig = readProjectFile("vite.config.ts");

        expect(viteConfig).toContain("include: ['**/*.test.{ts,tsx}']");
        expect(viteConfig).toContain("reportsDirectory: 'coverage'");
        expect(viteConfig).toContain("reporter: ['text', 'html', 'json-summary']");
    });

    it("evita duplicar la auditoría durante la instalación de CI", () => {
        const workflows = [
            readProjectFile(".github", "workflows", "deploy.yml"),
            readProjectFile(".github", "workflows", "security.yml"),
        ];

        for (const workflow of workflows) {
            expect(workflow).toContain("npm ci --no-audit");
            expect(workflow).toContain("npm run verify");
        }
    });
});
