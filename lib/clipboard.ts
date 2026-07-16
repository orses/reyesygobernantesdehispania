/** Copia el texto exacto, sin eliminar espacios ni saltos de línea. */
export async function copyTextToClipboard(value: string): Promise<boolean> {
    if (!value) return false;

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
    }

    if (typeof document === "undefined") return false;

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);

    try {
        textarea.select();
        return document.execCommand("copy");
    } finally {
        document.body.removeChild(textarea);
    }
}
