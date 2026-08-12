/** Indica si una tecla activa el control que tiene el foco. */
export function isKeyboardActivation(key: string): boolean {
    return key === "Enter" || key === " ";
}

/** Indica si Escape debe cerrar un diálogo que aún no ha gestionado el evento. */
export function shouldDismissDialogOnEscape(
    key: string,
    defaultPrevented: boolean
): boolean {
    return key === "Escape" && !defaultPrevented;
}

function wrappedIndex(index: number, count: number): number {
    return ((index % count) + count) % count;
}

/** Resuelve el siguiente foco en un grupo horizontal con recorrido circular. */
export function getHorizontalNavigationIndex(
    currentIndex: number,
    itemCount: number,
    key: string
): number | null {
    if (itemCount <= 0) return null;
    if (key === "Home") return 0;
    if (key === "End") return itemCount - 1;
    if (key === "ArrowRight") {
        return wrappedIndex(currentIndex < 0 ? 0 : currentIndex + 1, itemCount);
    }
    if (key === "ArrowLeft") {
        return wrappedIndex(currentIndex < 0 ? itemCount - 1 : currentIndex - 1, itemCount);
    }
    return null;
}

/** Resuelve el siguiente foco en una lista vertical con recorrido circular. */
export function getVerticalNavigationIndex(
    currentIndex: number,
    itemCount: number,
    key: string
): number | null {
    if (itemCount <= 0) return null;
    if (key === "Home") return 0;
    if (key === "End") return itemCount - 1;
    if (key === "ArrowDown") {
        return wrappedIndex(currentIndex < 0 ? 0 : currentIndex + 1, itemCount);
    }
    if (key === "ArrowUp") {
        return wrappedIndex(currentIndex < 0 ? itemCount - 1 : currentIndex - 1, itemCount);
    }
    return null;
}
