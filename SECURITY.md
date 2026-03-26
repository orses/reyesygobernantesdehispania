# Security Policy

## Versiones soportadas

| Versión | Soporte de seguridad |
|---------|---------------------|
| última  | ✅ Activa            |

## Reportar una vulnerabilidad

Si encuentras una vulnerabilidad de seguridad en este proyecto, **no abras un issue público**.

Envía los detalles de forma privada a través de la función
[**"Report a vulnerability"**](../../security/advisories/new) de GitHub
(pestaña **Security** del repositorio).

Incluye en tu reporte:
- Descripción del problema y su impacto potencial
- Pasos para reproducirlo
- Versión o commit afectado
- Cualquier prueba de concepto o capturas relevantes

Recibirás respuesta en un plazo de **72 horas**. Si se confirma la vulnerabilidad,
se publicará un aviso de seguridad (CVE) y se acreditará tu descubrimiento salvo
que prefieras permanecer anónimo.

## Alcance

Este proyecto es una **aplicación web estática** (SPA) que procesa datos
exclusivamente en el navegador del usuario. No existe backend, base de datos,
ni transmisión de datos a servidores externos.

### En alcance
- Vulnerabilidades XSS en el procesamiento de archivos CSV/JSON cargados por el usuario
- Problemas en la Content Security Policy
- Dependencias con CVEs conocidos

### Fuera de alcance
- Ataques que requieran acceso físico al dispositivo del usuario
- Ingeniería social
- Vulnerabilidades en navegadores o sistemas operativos de terceros
