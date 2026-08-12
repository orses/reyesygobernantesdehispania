# Arquitectura y rendimiento

## Alcance

La aplicación es una interfaz React estática y sin servicio de datos propio. El estado persistente vive en el navegador; las transformaciones históricas, estadísticas y de búsqueda se ejecutan en el cliente.

El diseño separa las operaciones con efectos laterales de la mayor parte de la lógica de dominio. Algunos módulos, en especial `lib/data.ts`, aún combinan transformaciones puras con utilidades del navegador; por tanto, no debe suponerse que todo `lib/` sea independiente del entorno.

## Fronteras principales

| Zona | Responsabilidad real |
| --- | --- |
| `index.tsx` | Montaje de React, estilos y fuente local. |
| `App.tsx` | Composición de pestañas, rutas mediante fragmentos, diálogos y coordinación de selección. |
| `hooks/useDataset.ts` | Fachada de filas y medios; importación, exportación, edición y acceso a `IndexedDB`. |
| `context/AppContext.tsx` | Estado de filtros y valores derivados: personas, opciones, selección y estadísticas. |
| `components/tabs/` | Presentación y comportamiento de cada vista funcional. |
| `components/ui/` | Controles visuales reutilizables y accesibles. |
| `lib/dataset-*` | Casos de uso de importación, exportación, identidad de filas, persistencia y sustitución del conjunto. |
| `lib/media*` | Modelo multimedia, índices, importación, reconciliación y ciclo de vida de objetos `Blob`. |
| `lib/people.ts`, `person-search.ts`, `filters.ts` y `stats.ts` | Agrupación por persona, consulta, filtrado, ordenación y cálculos estadísticos. |
| `lib/timeline.ts`, `railway.ts` y `railway-topology.ts` | Cronología, red ferroviaria y catálogo historiográfico. |
| `lib/hash-router.tsx` | Navegación propia mediante el fragmento de la URL, sin dependencia de un enrutador externo. |
| Pruebas `*.test.ts(x)` | Regresión colocada junto al módulo o componente protegido. |

La dirección preferida es `componentes -> contexto o controlador de datos -> casos de uso de lib`. La lógica que pueda expresarse sin DOM, almacenamiento ni estado React debe permanecer en funciones puras de `lib/`, pues esto permite probarla sin montar la aplicación.

## Flujo de los datos

1. `useDataset` recibe un archivo y comprueba su tamaño antes de materializarlo cuando el formato lo permite.
2. Los módulos `dataset-file-import`, `dataset-import`, `data` y `zip` interpretan y validan el contenido sin publicar estado parcial.
3. `prepareDatasetRows` calcula campos derivados y garantiza un `_rowId` único sin alterar los identificadores documentales.
4. El ciclo de vida multimedia normaliza referencias, descarta asociaciones sin persona y determina los objetos `Blob` obsoletos.
5. Una sustitución completa entra en la cola de persistencia, relee el último estado confirmado, escribe el nuevo estado y los objetos `Blob` preparados, y solo entonces publica el estado React. La limpieza destructiva se ejecuta al final.
6. `AppContext` deriva personas, filtros, opciones y estadísticas a partir de las filas confirmadas.
7. Los componentes consumen esos modelos y emiten acciones de usuario; no escriben directamente en `IndexedDB`.

Todas las tareas de persistencia se serializan mediante una cola local que no queda inutilizada tras un fallo. Cuando el navegador admite Web Locks, la misma sección crítica coordina también las pestañas abiertas del origen. Cada operación relee `IndexedDB` dentro del bloqueo y fusiona únicamente los dominios modificados —filas, nombre o medios— para no sobrescribir cambios independientes. Si falla una escritura en segundo plano, el error queda registrado en la consola; la persistencia local no debe tratarse como sustituto de una copia ZIP.

La hidratación inicial comparte esa sección crítica: lee, normaliza y persiste las reparaciones antes de buscar objetos `Blob` huérfanos. La interfaz permanece bloqueada mientras se realiza la operación y, si la lectura no es segura, muestra un estado de error sin escribir ni limpiar ninguna clave.

`datasetReplacementRevision` es una señal monótona que distingue una sustitución completa de una edición normal. `App` y `AppContext` la usan para restablecer de forma coordinada filtros, selección y ruta.

## Identidad y modelos derivados

- Una fila representa un gobierno; varias filas con el mismo `PersonID` forman una persona.
- `ID` e `id` son identificadores documentales y pueden repetirse.
- `_rowId` es la identidad técnica única de la fila. Las referencias manuales de sucesión usan `row:<_rowId>`.
- Los campos `_duracionCalc` y `_duracionFuente` son derivados, se recalculan y se excluyen de los formatos exportados.
- Las estadísticas y personas son proyecciones: no se almacenan como una segunda fuente de verdad.

## Navegación y carga diferida

`useHashLocation` normaliza rutas internas y escucha `hashchange`. El fragmento de la URL permite abrir rutas profundas en un alojamiento estático sin reglas de reescritura del servidor.

`FichasTab` forma parte de la carga inicial. Estadísticas, datos, línea temporal, comparativa, el módulo de diálogos y el renderizador Markdown de las descripciones se importan mediante `React.lazy` y `Suspense`. Una prueba de contrato verifica que todos esos módulos sigan exportando sus entradas esperadas.

## Estrategia de rendimiento actual

Las optimizaciones presentes reducen trabajo repetido sin introducir una segunda caché de dominio:

- `AppContext` memoriza la agrupación de filas, los filtros, las estadísticas y las opciones mientras sus entradas no cambien.
- La consulta avanzada se compila una vez por operación de filtrado y su predicado se reutiliza para todas las personas.
- La lista de fichas crea en una pasada un índice del medio principal por persona.
- Las vistas previas de medios y la exportación ZIP leen objetos `Blob` de `IndexedDB` por lotes.
- La firma de las vistas previas depende solo del identificador del medio y de su clave binaria; editar metadatos no vuelve a leer los objetos binarios.
- La red ferroviaria base se construye cuando cambia `allPeople`; seleccionar reinos solo reproyecta esa red.
- Las pestañas secundarias y el renderizador Markdown se separan en recursos diferidos.

No existe actualmente un presupuesto de tiempo en milisegundos ni un banco de pruebas de CPU estable. Tampoco hay virtualización de listas ni procesamiento en un trabajador web. Si un conjunto real demuestra que son necesarios, deben incorporarse con una medición reproducible y una prueba de equivalencia funcional.

## Presupuestos automáticos

`scripts/check-bundle-budget.mjs` analiza el manifiesto generado por Vite. `npm run bundle:check` falla si se incumple cualquiera de estos valores:

| Recurso | Presupuesto |
| --- | ---: |
| JavaScript inicial, suma comprimida con gzip | 180 KiB |
| Mayor recurso JavaScript diferido, comprimido con gzip | 125 KiB |
| Número mínimo de entradas diferidas | 5 |
| `public/favicon.png` | 460 KiB |

El comprobador necesita una compilación reciente:

```bash
npm run build
npm run bundle:check
```

Los límites de memoria de importación forman otro presupuesto y se detallan en [Formatos, persistencia y privacidad](DATA_AND_PRIVACY.md#límites-de-importación-y-zip).

## Criterios para evolucionar la arquitectura

- Mantener una sola fuente de verdad para filas y medios.
- Proteger cada extracción u optimización con equivalencias frente al comportamiento anterior.
- Evitar dependencias de interfaz dentro de los casos de uso puros.
- Preservar `_rowId` en cualquier formato que pueda reimportarse.
- Preparar y validar una sustitución completa antes de publicar estado.
- No aumentar un presupuesto para ocultar una regresión: justificar el cambio con el contenido generado y su efecto funcional.
- Seguir el flujo obligatorio de [Estrategia de pruebas](../TESTING.md).
