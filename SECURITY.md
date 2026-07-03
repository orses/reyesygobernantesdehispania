# Política de seguridad

## Versiones soportadas

| Versión | Soporte de seguridad |
|---------|----------------------|
| última  | Activo               |

## Modelo de seguridad

Este proyecto es una aplicación web estática de una sola página. Procesa los datos
en el navegador del usuario y no dispone de backend, base de datos ni envío de
datos a servidores propios.

La seguridad del proyecto se apoya en estas capas:

- `Content-Security-Policy` estricta en la compilación de producción.
- Cabeceras defensivas en el servidor local de desarrollo.
- Auditoría de dependencias mediante `npm audit`.
- Revisión de cambios de dependencias en pull requests.
- Análisis estático con CodeQL para JavaScript y TypeScript.
- Actualizaciones automáticas de dependencias npm y GitHub Actions con Dependabot.

## Reportar una vulnerabilidad

Si encuentras una vulnerabilidad de seguridad en este proyecto, no abras un issue
público.

Envía los detalles de forma privada mediante la función
[Report a vulnerability](../../security/advisories/new) de GitHub, disponible en
la pestaña **Security** del repositorio.

Incluye en el reporte:

- Descripción del problema y su impacto potencial.
- Pasos para reproducirlo.
- Versión, commit o URL afectada.
- Prueba de concepto, trazas o capturas relevantes, si las hay.

Se responderá en un plazo máximo de 72 horas. Si se confirma la vulnerabilidad,
se preparará una corrección, se publicará el aviso de seguridad correspondiente y
se acreditará el descubrimiento salvo que prefieras permanecer en el anonimato.

## Alcance

### En alcance

- XSS o inyección de contenido al importar CSV/JSON.
- Debilidades de `Content-Security-Policy`.
- Exposición indebida de datos cargados por el usuario.
- Dependencias con vulnerabilidades conocidas.
- Configuración insegura de GitHub Actions o GitHub Pages.

### Fuera de alcance

- Ataques que requieran acceso físico al dispositivo del usuario.
- Ingeniería social.
- Vulnerabilidades de navegadores, extensiones o sistemas operativos de terceros.
- Problemas derivados de alojar una copia modificada fuera de este repositorio.
