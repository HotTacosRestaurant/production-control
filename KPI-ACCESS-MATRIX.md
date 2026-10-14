# Matriz de accesos — Production Control (octubre 2026)

| Función | Cocina sin iniciar sesión | Usuario `viewer` autenticado | Superadmin |
|---|---|---|---|
| Captura de conteos y productos | Sí | Sí, desde PWA operativa | Sí |
| Cronómetros, ingredientes y fin de lote | Sí | Sí, desde PWA operativa | Sí |
| Correcciones de registros | Con `PC_CORRECTION_CODE` del encargado | Con código | Con código |
| Consulta operativa `/consulta` | No, requiere login | Sí | Sí |
| Gráfica de conteos/producción en `/consulta` | No, requiere login | Sí | Sí |
| KPIs `/api/pc/management`, reportes y exportación | No | No | Sí: token Firebase + allowlist + rol `admin` |
| Showcase demostrativo `/showcase` | Sí | Sí | Sí |

Un usuario `viewer` requiere **Firebase Authentication** y `portal_users/{uid}` con `active=true` y `role='viewer'`. El superadmin requiere rol `admin` y el correo en la lista de autorizados. La cocina continúa sin cuentas y sin PIN.

**Importante:** como la API operativa básica también permite consultar información necesaria para cocina sin autenticación, el uso de `/consulta` con login **no convierte en privados todos los datos de operación**. Solo Management/KPIs y la pantalla de consultas tienen control de acceso a nivel de ruta. Para confidencialidad completa de los históricos habría que limitar la API pública y diseñar un acceso de captura separado.

Las correcciones conservan revisiones y exigen un secreto del servidor; nunca guardes el secreto en el repositorio o en `NEXT_PUBLIC_*`.
