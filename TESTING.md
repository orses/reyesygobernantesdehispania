# Estrategia de pruebas

Toda corrección y evolución funcional debe conservar una prueba de regresión permanente. La cobertura es una puerta adicional; no sustituye aserciones que describan el comportamiento.

## Entorno reproducible

El proyecto fija Node.js `22.22.3` y npm `10.9.8`. Una instalación limpia debe usar el archivo de bloqueo:

```bash
npm ci
```

No se deben actualizar dependencias de forma implícita para resolver un fallo de pruebas.

## Ciclo obligatorio de un cambio

1. Reproducir el defecto o el contrato nuevo mediante una prueba que falle por la razón esperada.
2. Añadir los casos positivos, negativos, de límite y de compatibilidad pertinentes.
3. Ejecutar la prueba específica durante la implementación.
4. Ejecutar las pruebas relacionadas con los consumidores afectados.
5. Ejecutar `npm run verify` sobre el estado integrado antes de considerar terminado el cambio.
6. Conservar la prueba: no eliminarla ni debilitarla para facilitar una modificación posterior.

Ejemplo:

```bash
npm test -- lib/zip.test.ts
npm test -- lib/dataset-file-import.test.ts lib/zip.test.ts
npm run verify
```

Una optimización debe añadir una prueba de equivalencia con el comportamiento anterior, además de cualquier comprobación de rendimiento o presupuesto.

## Comandos

| Orden | Finalidad |
| --- | --- |
| `npm test -- <archivo>` | Ejecutar una regresión o un grupo específico. |
| `npm test` | Ejecutar toda la batería una vez. |
| `npm run test:all` | Alias explícito de la batería global. |
| `npm run test:coverage` | Ejecutar la batería y generar cobertura V8. |
| `npm run lint` | Comprobar reglas de ESLint. |
| `npm run typecheck` | Comprobar TypeScript sin emitir archivos. |
| `npm run build` | Crear la versión de producción y su manifiesto. |
| `npm run bundle:check` | Comprobar los presupuestos sobre un `dist/` recién generado. |
| `npm run security:lockfile` | Auditar las dependencias resueltas por npm. |
| `npm run verify` | Ejecutar todas las puertas anteriores en el orden correcto. |

`npm run verify` equivale a análisis estático, tipos, cobertura, compilación, presupuesto de recursos y auditoría. La auditoría de npm necesita acceso al registro configurado.

## Organización actual

- `*.test.ts`: lógica de dominio, analizadores, seguridad, persistencia y configuración.
- `*.test.tsx`: contratos y representación estática de componentes React.
- `describe("regresión: …")`: escenario que protege expresamente un defecto corregido.

Las pruebas están colocadas junto a sus módulos. El repositorio no dispone actualmente de una infraestructura de navegador simulado ni de pruebas de extremo a extremo en navegador real; no debe afirmarse que esos niveles estén cubiertos. Cuando se incorporen, se reservarán `tests/integration/` y `tests/e2e/`, junto con su orden reproducible de ejecución.

Los efectos del navegador se mantienen detrás de funciones pequeñas y comprobables. Por ejemplo, `parseZipFile` permite verificar que el tamaño se rechaza antes de leer el búfer sin montar `useDataset`.

## Cobertura

Vitest mide con V8 la lógica incluida en `lib/**` y excluye `lib/types.ts` y `lib/utils.ts`. Los umbrales globales configurados son:

| Métrica | Mínimo |
| --- | ---: |
| Líneas | 80 % |
| Funciones | 80 % |
| Ramas | 75 % |
| Sentencias | 80 % |

Los informes se generan en `coverage/`. Son artefactos regenerables y no deben formar parte de una entrega.

## Pruebas de configuración y seguridad

La batería también protege contratos que no pertenecen a una única función:

- versión de Node y gestor de paquetes;
- configuración de cobertura y flujos de GitHub Actions;
- política de seguridad de contenidos y cabeceras;
- carga diferida de pestañas y diálogos;
- formatos de intercambio, límites ZIP e integridad CRC;
- identidad de filas, sustitución del conjunto y ciclo de vida multimedia.

Los presupuestos de JavaScript y recursos se documentan en [Arquitectura y rendimiento](docs/ARCHITECTURE.md#presupuestos-automáticos). Los límites de archivos y descompresión están en [Formatos, persistencia y privacidad](docs/DATA_AND_PRIVACY.md#límites-de-importación-y-zip).

## Integración continua

Los flujos de despliegue y de seguridad instalan con `npm ci --no-audit` y ejecutan después `npm run verify`. Las solicitudes de incorporación pasan además por la revisión de dependencias; el despliegue en GitHub Pages solo se efectúa fuera de esas solicitudes y después de superar la verificación.
