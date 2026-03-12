<div align="center">

# Gobernantes de España

**Herramienta de análisis, visualización y comparativa histórica**

</div>

Aplicación web enfocada en investigadores, historiadores y estudiantes, que permite cargar, visualizar, analizar y comparar bases de datos de monarcas y entidades políticas de la península ibérica. Toda la aplicación funciona del lado del cliente sin enviar datos a servidores externos, garantizando máxima privacidad y velocidad.

## Características Principales

*   **Fichas Detalladas:** Visualización interactiva con soporte para búsqueda difusa, filtrado por reinos, dinastías y siglos. Ordenación cronológica y alfabética.
*   **Análisis Estadísticos:** Resúmenes y gráficas avanzadas generadas automáticamente sobre distribuciones dinásticas, longevidad vital, duración de reinados y frecuencias.
*   **Línea del Tiempo (Timeline):** Visualización interactiva temporal donde los períodos se distribuyen en vías para evitar colisiones visuales. Asignación algorítmica de colores según el reino.
*   **Comparativa (Cara a Cara):** Selector interactivo múltiple para colocar a diversas figuras históricas una junto a otra, contrastando ágilmente parámetros clave.
*   **Persistencia Local:** La aplicación guarda de forma transparente todo el conjunto de datos en el navegador del usuario utilizando `IndexedDB`.
*   **Edición y Exportación:** Herramienta de edición rápida en memoria que permite corregir datos sobre la marcha y descargar el set optimizado y corregido de vuelta como archivo `CSV`.

## Tecnologías Utilizadas

El proyecto está diseñado sobre un *stack* de desarrollo moderno y altamente eficiente:

*   **Core:** React 19, TypeScript y Vite.
*   **Estilos y UX:** Tailwind CSS, `framer-motion` (para animaciones sutiles) y componentes UI puros basados en `radix-ui`.
*   **Análisis Visual:** `recharts` para las gráficas interactivas del panel estadístico.
*   **Enrutamiento y Estado:** `react-router-dom` (HashRouter, adaptado para Github Pages) e `idb-keyval` (almacenamiento asíncrono persistente).

## Inicialización Local

**Requisitos previos:** `Node.js` (versión 18 o superior recomendada).

1.  **Instalar dependencias:**
    ```bash
    npm install
    ```

2.  **Ejecutar entorno de desarrollo local:**
    ```bash
    npm run dev
    ```
    La aplicación se inicializará y estará disponible normalmente en `http://localhost:3000`.

## Despliegue Estático (GitHub Pages)

Este repositorio está preparado nativamente para publicarse como página estática a través de **GitHub Pages**.

1. Asegúrese de hacer *push* al repositorio en su respectiva cuenta de GitHub.
2. Vaya a `Settings` > `Pages`.
3. Bajo *Source*, escoja **GitHub Actions**.
4. GitHub detectará que el proyecto utiliza Vite/React o sugerirá compilar HTML estático, autoconfigurando el flujo de compilación tras hacer clic en "Configure".

## Uso y Origen de los Datos

El núcleo de esta aplicación es puramente interpretativo y requiere de la inserción inicial de fuentes. Puede importar cualquier tabla de datos guardada en formato **`.csv`** (con delimitadores estándares o automáticos como `;`, `|`, `,` o `\t`) o archivos exportados previamente en formato **`.json`**.
