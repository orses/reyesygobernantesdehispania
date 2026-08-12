# Formatos, persistencia y privacidad

## Modelo de intercambio

Una fila representa un gobierno, no necesariamente una persona única. La aplicación agrupa como una persona las filas que comparten `PersonID`. No se exige una tabla cerrada de columnas: las claves desconocidas se conservan y las conocidas se interpretan cuando están presentes.

Identificadores:

| Campo | Finalidad |
| --- | --- |
| `PersonID`, `personId` o `personID` | Agrupación de varios gobiernos bajo una persona. |
| `ID` o `id` | Identificador documental importado; puede repetirse y no se usa para dirigir una edición. |
| `_rowId` | Identificador técnico, único y estable de cada fila. |
| `Predecesor` y `Sucesor` | Referencia manual opcional mediante `row:<_rowId>`; también se admite el `PersonID` heredado. |

Al preparar un conjunto, un `_rowId` ausente o repetido se completa de forma determinista sin modificar `ID` ni `id`. CSV, JSON y ZIP conservan `_rowId` para que una exportación y posterior importación no rompan las referencias manuales.

`_duracionCalc` y `_duracionFuente` son campos de ejecución. Se recalculan y se excluyen de las exportaciones. Los años admiten números o texto; las fechas aproximadas y los siglos pueden producir valores cronológicos inferidos para las visualizaciones.

Entre las columnas reconocidas se encuentran `Nombre`, `Nombre principal`, `Reino`, `Tipo de gobierno`, `Dinastía`, los campos de inicio y fin del reinado, nacimiento, fallecimiento, descripción, verificación y URL. La definición completa y sus alias están en `lib/types.ts` y en los normalizadores de `lib/data.ts`.

## CSV

### Importación

- El archivo se lee como UTF-8 y se elimina el BOM de la primera cabecera.
- El separador se detecta a partir de la cabecera. La prioridad actual es `|`, `;` y, después, la mejor coincidencia entre `,` y tabulador.
- Se admiten campos entre comillas, comillas escapadas como `""` y saltos de línea dentro de un campo entrecomillado.
- Debe existir una cabecera y al menos una fila no vacía.
- Las cabeceras vacías se omiten sin desplazar sus columnas de origen.
- Se rechazan cabeceras duplicadas, comillas sin cerrar y filas con contenido más allá de la cabecera.

### Exportación

- Usa `;` como separador y encierra todas las cabeceras y celdas entre comillas.
- Duplica las comillas internas.
- Incluye la unión de columnas presente en todas las filas y conserva `_rowId`.
- Excluye las demás claves que comienzan por `_`.
- Ante valores que empiezan por `=`, `+`, `-`, `@`, tabulador o retorno de carro, antepone un apóstrofo para reducir la ejecución de fórmulas al abrir el archivo en una hoja de cálculo.
- Escribe la URL principal en `Imagen URL`, las restantes en `Galería` y las rutas descriptivas de archivos subidos en `Imágenes subidas (rutas, solo en ZIP)`.

El CSV no transporta imágenes subidas ni sus metadatos completos. Las rutas de la última columna solo son referencias a la estructura de un ZIP.

## JSON

La importación admite estas formas:

- una lista de objetos de fila;
- un objeto heredado con una lista `datos`;
- un objeto heredado con una lista `reyes`;
- el paquete versionado que genera la aplicación.

El formato actual de exportación es:

```json
{
  "version": 1,
  "datasetName": "datos",
  "exportedAt": "2026-08-05T20:00:00.000Z",
  "datos": [],
  "mediaAssets": []
}
```

Si un objeto declara `version`, esta debe ser exactamente `1`. Los formatos heredados sin versión siguen admitidos. Las filas deben ser objetos; `mediaAssets`, cuando existe, debe ser una lista cuyos elementos tengan identificadores, persona y tipo válidos. Los tipos actuales son `external-url` y `uploaded-file`.

El JSON independiente no contiene objetos `Blob`. La exportación conserva metadatos transferibles de los medios subidos, pero al reimportar ese JSON solo se restauran los medios `external-url`; no es posible reconstruir un archivo local a partir de su nombre o `packagePath`. Para conservarlo debe usarse el ZIP.

## ZIP

El paquete completo tiene esta estructura lógica:

```text
datos.json
media/<identificador>-<nombre seguro>.<extensión>
media-documento/300dpi/<identificador>-<nombre seguro>.<extensión>
media-documento/600dpi/<identificador>-<nombre seguro>.<extensión>
```

`datos.json` usa el contrato JSON versionado. `media/` contiene los originales disponibles. Las carpetas `media-documento/` solo aparecen al solicitar un perfil de 300 o 600 ppp y cuando el PNG o JPEG admite la modificación de sus metadatos. La operación no cambia las dimensiones de píxel ni remuestrea la imagen. Si falta un objeto `Blob` o no puede generarse una variante documental, la exportación continúa y muestra una advertencia.

La aplicación genera ZIP mediante el método STORE. El lector admite STORE y DEFLATE, verifica CRC-32 y tolera marcadores de directorio. Las rutas se normalizan a Unicode NFC y `/`; se rechazan rutas absolutas, segmentos `.` o `..`, separadores dobles y rutas duplicadas después de normalizar.

Durante la importación, `datos.json` debe aparecer una sola vez. Los medios subidos deben usar una ruta bajo `media/` y referirse a un `PersonID` existente. Las claves internas de `IndexedDB` incluidas en un documento no se consideran confiables: se generan claves locales nuevas.

## Límites de importación y ZIP

Los límites predeterminados son constantes del código y forman parte de las pruebas de regresión:

| Entrada | Límite |
| --- | ---: |
| CSV o JSON independiente | 32 MiB por archivo |
| Archivo ZIP | 256 MiB |
| Entradas de un ZIP | 4096 |
| Una entrada ZIP descomprimida | 256 MiB |
| Suma descomprimida de las entradas ZIP | 256 MiB |

El tamaño declarado del archivo se comprueba antes de llamar a `arrayBuffer()` en el flujo ZIP. El analizador vuelve a comprobar el tamaño real. Para DEFLATE se controla tanto el tamaño de cabecera como el producido durante la descompresión, y STORE participa en los mismos límites individuales y agregados. El generador aplica la misma política para no producir paquetes que la propia aplicación rechazaría.

Estos topes reducen el riesgo, pero no convierten un archivo desconocido en confiable. La interpretación y la descompresión siguen consumiendo memoria y CPU en el navegador.

## Persistencia local

`useDataset` usa `idb-keyval` sobre `IndexedDB` con estas claves propias:

- `reyes_dataset_rows`: filas preparadas;
- `reyes_dataset_name`: nombre base de exportación;
- `reyes_media_assets`: metadatos multimedia;
- `reyes_media_blob_<id>`: contenido binario de una imagen subida.

Los filtros se guardan por separado en `localStorage`, bajo `reyes_filters`, y se sanean al restaurarlos.

Las lecturas iniciales y las escrituras se serializan para conservar su orden. Cuando Web Locks está disponible, un bloqueo exclusivo coordina además las pestañas abiertas del mismo origen. Cada cambio relee el último estado de `IndexedDB` dentro de esa sección crítica y fusiona por separado filas, nombre y medios.

La interfaz no permite editar hasta que la hidratación termina correctamente. Una lectura válida normaliza y vuelve a guardar las reparaciones antes de buscar objetos `Blob` huérfanos. Si el contenido persistido no puede interpretarse con seguridad, la aplicación bloquea las acciones y no escribe ni elimina claves. En una sustitución completa, el nuevo estado se almacena antes de publicarse en React; la eliminación de objetos obsoletos se realiza al final y un fallo de esa limpieza solo puede dejar un objeto huérfano para una revisión posterior.

Las vistas previas de archivos locales usan direcciones URL de objeto temporales y las revocan al cambiar el plan de medios o desmontarse el consumidor.

La aplicación no ofrece actualmente una acción única para borrar todo el almacenamiento. Para eliminarlo por completo hay que borrar los datos del sitio desde el navegador. Antes conviene descargar un ZIP completo.

## Privacidad y red

- No hay cuentas, analítica, telemetría ni API propia que reciba el conjunto de datos.
- Los datos normalizados procedentes de archivos y las imágenes subidas permanecen en el almacenamiento del origen web del navegador.
- Exportar crea una descarga local; copiar JSON escribe en el portapapeles solo tras la acción correspondiente.
- Mostrar un medio `external-url` hace que el navegador solicite ese recurso. En producción, la política de seguridad permite imágenes HTTPS, `data:` y `blob:`; el HTML publicado declara `no-referrer` para no enviar información de referencia.
- Abrir una imagen o una fuente externa navega a un tercero. Sus condiciones de privacidad son ajenas a este proyecto.
- Los campos de autoría, licencia y estado de derechos son metadatos declarativos; la aplicación no verifica por sí misma la situación jurídica de una imagen.

Para trabajo sensible: utilice archivos locales, evite las URL externas, exporte ZIP con regularidad y controle quién tiene acceso al perfil del navegador y a las descargas resultantes.
