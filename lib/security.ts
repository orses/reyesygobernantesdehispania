export type ContentSecurityPolicyDirectives = Readonly<Record<string, readonly string[]>>;

export const securityHeaders: Readonly<Record<string, string>> = {
  // Evita que la aplicación se incruste en marcos externos en entornos que admiten cabeceras.
  "X-Frame-Options": "DENY",
  // Impide que el navegador deduzca tipos MIME distintos a los declarados.
  "X-Content-Type-Options": "nosniff",
  // No envía la URL de referencia fuera de la propia navegación.
  "Referrer-Policy": "no-referrer",
  // Deshabilita API del navegador que la aplicación no necesita.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

export const productionCspDirectives: ContentSecurityPolicyDirectives = {
  "default-src": ["'self'"],
  "script-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "https:", "data:", "blob:"],
  "connect-src": ["'self'"],
  "font-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
};

export const developmentCspDirectives: ContentSecurityPolicyDirectives = {
  ...productionCspDirectives,
  // Vite necesita scripts inline y WebSocket durante HMR.
  "script-src": ["'self'", "'unsafe-inline'"],
  "connect-src": ["'self'", "ws:"],
};

export function serializeCsp(directives: ContentSecurityPolicyDirectives): string {
  return Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");
}
