// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  // Ignorar build y dependencias
  { ignores: ["dist/**", "node_modules/**"] },

  // Reglas base JS
  js.configs.recommended,

  // Reglas TypeScript
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // ──────────────────────────────────────────────
      // SEGURIDAD: prohibición de ejecución de código dinámico
      // ──────────────────────────────────────────────
      "no-eval": "error",                 // prohíbe eval()
      "no-new-func": "error",             // prohíbe new Function(string)
      "no-implied-eval": "error",         // prohíbe setTimeout("string") / setInterval("string")
      "no-script-url": "error",           // prohíbe javascript: URLs

      // ──────────────────────────────────────────────
      // SEGURIDAD: calidad y control de flujo
      // ──────────────────────────────────────────────
      "no-prototype-builtins": "error",   // evita prototype pollution
      "no-extend-native": "error",        // prohíbe extender prototipos nativos
      "no-global-assign": "error",        // prohíbe reasignar globales (window, undefined…)

      // ──────────────────────────────────────────────
      // REACT HOOKS
      // ──────────────────────────────────────────────
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // ──────────────────────────────────────────────
      // TYPESCRIPT: ajustes razonables
      // ──────────────────────────────────────────────
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        ignoreRestSiblings: true,   // permite: const { _foo, ...rest } = obj
      }],
    },
  },
);
