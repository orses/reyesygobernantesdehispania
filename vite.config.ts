import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cabeceras de seguridad comunes a dev y producción
const securityHeaders: Record<string, string> = {
  // Clickjacking: impide que la app se cargue en un <iframe> externo
  'X-Frame-Options': 'DENY',
  // MIME sniffing: el navegador no adivina el tipo de contenido
  'X-Content-Type-Options': 'nosniff',
  // No envía la URL de referencia a terceros
  'Referrer-Policy': 'no-referrer',
  // Deshabilita APIs sensibles que la app no usa
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    host: '0.0.0.0',
    headers: {
      ...securityHeaders,
      // En desarrollo: 'unsafe-inline' en script-src porque Vite
      // inyecta módulos HMR inline. En producción usar la meta tag
      // del index.html (sin 'unsafe-inline').
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",   // 'unsafe-inline' solo para HMR en dev
        "style-src 'self' 'unsafe-inline'",    // Tailwind y framer-motion usan estilos inline
        "img-src 'self' data: blob:",
        "connect-src 'self' ws:",              // ws: necesario para HMR WebSocket
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    },
  },
  plugins: [react()],
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
