// ---------------------------------------------------------------------------
// Señal monotónica de sustitución completa del conjunto de datos.
// ---------------------------------------------------------------------------

/**
 * Genera una revisión estable sin depender del reloj del sistema. Solo debe
 * invocarse después de confirmar una sustitución completa del dataset.
 */
export function nextDatasetReplacementRevision(currentRevision: number): number {
    if (!Number.isSafeInteger(currentRevision) || currentRevision < 0) {
        throw new Error("La revisión del dataset debe ser un entero seguro no negativo.");
    }
    if (currentRevision === Number.MAX_SAFE_INTEGER) return 1;
    return currentRevision + 1;
}

/** Indica si un consumidor aún no ha procesado la sustitución confirmada. */
export function isPendingDatasetReplacement(
    currentRevision: number,
    handledRevision: number
): boolean {
    return currentRevision > 0 && currentRevision !== handledRevision;
}
