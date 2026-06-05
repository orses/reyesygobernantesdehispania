/**
 * Indicador de estado de verificación de una ficha.
 *
 * Pieza puramente presentacional y de dominio neutro (solo recibe un
 * booleano), por lo que vive en la capa `ui/` y la comparten varias
 * features (ficha principal, comparativa) sin acoplarse entre ellas.
 *
 * Convención: solo se muestra el check verde cuando la ficha está
 * verificada; si no lo está no se pinta nada (la ausencia es el estado
 * "sin verificar").
 */
export function VerifiedBadge({ verified }: { verified: boolean }) {
  if (!verified) return null;

  return (
    <div className="flex items-center justify-center" title="ficha verificada" aria-label="ficha verificada">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-emerald-400">
        <circle cx="12" cy="12" r="10" strokeOpacity="0.8" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5" />
      </svg>
    </div>
  );
}
