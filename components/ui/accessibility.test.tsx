import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "./dialog";
import { Notification } from "./notification";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

describe("pestañas accesibles", () => {
    it("expone roles, selección, foco y asociación con su panel", () => {
        const html = renderToStaticMarkup(
            <Tabs value="fichas">
                <TabsList aria-label="Secciones principales">
                    <TabsTrigger value="fichas">Fichas</TabsTrigger>
                    <TabsTrigger value="datos">Datos</TabsTrigger>
                </TabsList>
                <TabsContent value="fichas">Contenido</TabsContent>
                <TabsContent value="datos">Otro contenido</TabsContent>
            </Tabs>
        );

        expect(html).toContain('role="tablist"');
        expect(html).toMatch(/<button(?=[^>]*role="tab")(?=[^>]*aria-selected="true")(?=[^>]*tabindex="0")[^>]*>Fichas<\/button>/);
        expect(html).toMatch(/<button(?=[^>]*role="tab")(?=[^>]*aria-selected="false")(?=[^>]*tabindex="-1")[^>]*>Datos<\/button>/);
        expect(html).toMatch(/<div(?=[^>]*role="tabpanel")(?=[^>]*aria-labelledby="[^"]+")[^>]*>Contenido<\/div>/);
        expect(html).not.toContain("Otro contenido");
    });
});

describe("selector accesible", () => {
    it("declara el desplegable, la lista y el estado de sus opciones", () => {
        const html = renderToStaticMarkup(
            <Select value="uno" defaultOpen>
                <SelectTrigger aria-label="Orden de resultados">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="uno">Uno</SelectItem>
                    <SelectItem value="dos">Dos</SelectItem>
                </SelectContent>
            </Select>
        );

        expect(html).toMatch(/<button(?=[^>]*role="combobox")(?=[^>]*aria-haspopup="listbox")(?=[^>]*aria-expanded="true")(?=[^>]*aria-controls="[^"]+")[^>]*>/);
        expect(html).toMatch(/<div(?=[^>]*role="listbox")(?=[^>]*aria-labelledby="[^"]+")[^>]*>/);
        expect(html).toMatch(/<div(?=[^>]*role="option")(?=[^>]*aria-selected="true")(?=[^>]*tabindex="0")[^>]*>/);
        expect(html).toMatch(/<div(?=[^>]*role="option")(?=[^>]*aria-selected="false")(?=[^>]*tabindex="-1")[^>]*>/);
    });
});

describe("diálogo accesible", () => {
    it("asocia título y descripción y ofrece un cierre con nombre en español", () => {
        const html = renderToStaticMarkup(
            <Dialog open onOpenChange={vi.fn()}>
                <DialogContent>
                    <DialogTitle>Confirmación</DialogTitle>
                    <DialogDescription>Revise la operación.</DialogDescription>
                </DialogContent>
            </Dialog>
        );

        expect(html).toMatch(/<div(?=[^>]*role="dialog")(?=[^>]*aria-modal="true")(?=[^>]*aria-labelledby="[^"]+")(?=[^>]*aria-describedby="[^"]+")[^>]*>/);
        expect(html).toContain('aria-label="Cerrar diálogo"');
        expect(html).toContain("Confirmación");
        expect(html).toContain("Revise la operación.");
    });
});

describe("avisos dinámicos accesibles", () => {
    it("anuncia los errores de forma asertiva y nombra el cierre", () => {
        const html = renderToStaticMarkup(
            <Notification
                type="error"
                message="No se pudo guardar."
                onClose={vi.fn()}
            />
        );

        expect(html).toContain('role="alert"');
        expect(html).toContain('aria-live="assertive"');
        expect(html).toContain('aria-atomic="true"');
        expect(html).toContain('aria-label="Cerrar error"');
    });

    it("anuncia los avisos informativos sin interrumpir", () => {
        const html = renderToStaticMarkup(
            <Notification
                type="csv"
                message="Separador detectado."
                onClose={vi.fn()}
            />
        );

        expect(html).toContain('role="status"');
        expect(html).toContain('aria-live="polite"');
    });
});
