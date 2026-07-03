import path from 'path';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import {
  developmentCspDirectives,
  productionCspDirectives,
  securityHeaders,
  serializeCsp,
} from './lib/security';

const CSP_PLACEHOLDER = '__CONTENT_SECURITY_POLICY__';

function contentSecurityPolicyPlugin(): Plugin {
  let command: 'build' | 'serve' = 'build';

  return {
    name: 'content-security-policy',
    configResolved(config) {
      command = config.command;
    },
    transformIndexHtml(html) {
      const directives = command === 'serve'
        ? developmentCspDirectives
        : productionCspDirectives;

      return html.replace(CSP_PLACEHOLDER, serializeCsp(directives));
    },
  };
}

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    host: '0.0.0.0',
    headers: {
      ...securityHeaders,
      'Content-Security-Policy': serializeCsp(developmentCspDirectives),
    },
  },
  plugins: [react(), contentSecurityPolicyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  test: {
    coverage: {
      provider: 'v8',
      // Solo mide cobertura de la lógica pura (lib/), excluye definiciones de tipos
      include: ['lib/**'],
      exclude: ['lib/types.ts', 'lib/utils.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
