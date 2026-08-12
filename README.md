# Gobernantes de España

Aplicación web estática para importar, revisar, editar, analizar y comparar datos de gobernantes y entidades políticas de la península ibérica. El repositorio incluye un registro de ejemplo; el contenido de investigación lo aporta cada usuario mediante CSV, JSON o un paquete ZIP exportado previamente.

## Funciones principales

- Fichas agrupadas por `PersonID`, con sus distintos gobiernos y una galería de medios.
- Búsqueda literal o estructurada, filtros por reino, tipo de gobierno, dinastía y siglo, y varias ordenaciones.
- Estadísticas globales o filtradas sobre gobiernos, personas, dinastías, cronología y edades.
- Línea temporal general y proyección ferroviaria para Asturias, León, Galicia y Castilla.
- Comparación de varias personas.
- Edición de personas y gobiernos, comprobaciones de coherencia y sucesión manual estable.
- Persistencia local y exportación a CSV, JSON o ZIP con los archivos de imagen.

## Privacidad y funcionamiento local

La aplicación no incorpora un servidor de datos, cuentas de usuario ni telemetría. Las filas, los metadatos multimedia y las imágenes subidas se guardan en `IndexedDB`; los filtros se guardan en `localStorage`. Las importaciones y exportaciones se procesan en el navegador.

Una imagen configurada mediante una URL HTTPS no se copia a `IndexedDB`: el navegador la solicita directamente a su servidor de origen cuando debe mostrarla. El HTML publicado declara la política de referencia `no-referrer`, pero ese servidor sigue recibiendo la conexión de red. Para un trabajo totalmente local deben utilizarse imágenes subidas y conservarse copias ZIP.

La persistencia del navegador no sustituye a una copia de seguridad: puede desaparecer al borrar los datos del sitio, cambiar de perfil o usar determinadas modalidades privadas. Consulte [Formatos, persistencia y privacidad](docs/DATA_AND_PRIVACY.md).

## Puesta en marcha

Requisitos reproducibles:

- Node.js `22.22.3`, fijado en `.nvmrc`.
- npm `10.9.8`, declarado en `package.json`.

```bash
npm ci
npm run dev
```

Vite escucha en el puerto `3000`; la dirección local habitual es <http://localhost:3000>.

Antes de entregar un cambio:

```bash
npm run verify
```

La verificación ejecuta análisis estático con ESLint, comprobación de tipos, pruebas con cobertura, compilación de producción, presupuestos de recursos y auditoría del archivo de dependencias. El flujo detallado se encuentra en [Estrategia de pruebas](TESTING.md).

## Tecnología y navegación

- React 19, TypeScript 5.9 y Vite 8.
- Tailwind CSS, Lucide y una capa local de componentes de interfaz con `@radix-ui/react-slot`.
- Recharts para las visualizaciones estadísticas.
- `idb-keyval` como acceso a `IndexedDB`.
- Vitest, cobertura V8 y ESLint.

La navegación no usa `react-router-dom`. Un enrutador propio basado en el fragmento de la URL, definido en `lib/hash-router.tsx`, mantiene rutas compatibles con alojamiento estático, como `#/fichas/:personId`, `#/estadistica`, `#/datos`, `#/timeline` y `#/comparativa`. Las pestañas no iniciales y los diálogos se cargan de forma diferida.

## Importación y exportación

| Formato | Importación | Exportación | Archivos de imagen |
| --- | --- | --- | --- |
| CSV | Separador detectado entre `|`, `;`, `,` y tabulador | Separador `;`, campos entre comillas | No; conserva las URL y las rutas descriptivas |
| JSON | Lista de filas, objetos heredados o paquete versionado | Paquete de datos versionado | No incluye los binarios subidos |
| ZIP | `datos.json` y medios validados | Paquete autocontenido | Sí, salvo archivos locales ausentes |

El ZIP es el único formato de copia completa. Puede conservar solo los originales o añadir variantes PNG/JPEG con metadatos de impresión de 300 o 600 ppp; no se remuestrean los píxeles.

Los contratos, las columnas técnicas, la versión del paquete y los límites de seguridad están documentados en [Formatos, persistencia y privacidad](docs/DATA_AND_PRIVACY.md).

## Arquitectura y rendimiento

La interfaz delega la lógica de dominio en módulos de `lib/`; `useDataset` concentra las operaciones con archivos e `IndexedDB`, y `AppContext` publica personas, filtros y estadísticas derivados. Las fronteras y los presupuestos actuales se describen en [Arquitectura y rendimiento](docs/ARCHITECTURE.md).

## Despliegue

El proyecto genera un sitio estático con base relativa. Los flujos de GitHub Actions verifican los cambios dirigidos a `main`; en esa rama, el flujo de Pages publica `dist/` solo después de superar `npm run verify`.
