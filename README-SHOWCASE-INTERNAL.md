# Showcase interno — Production Control

`/showcase` muestra el mismo dashboard y los mismos KPIs de Management Information, usando los mismos cálculos de `buildManagementData()`.

Cambios:
- `/showcase` no pide autenticación.
- No muestra correo, botón de iniciar sesión ni botón de cerrar sesión.
- El único botón de acción del dashboard es **Actualizar**.
- `/api/showcase` devuelve `ManagementData` directamente desde la capa server-side; no expone documentos Firestore al navegador.
- No se modifican las reglas de Firestore. Las colecciones `pc_*` siguen bloqueadas para acceso directo del cliente.
- Se agrega `translate="no"` y `<meta name="google" content="notranslate">` al layout raíz para evitar el aviso de Google Translate.

Esta ruta debe considerarse interna: cualquier persona con acceso a `/showcase` puede consultar esos KPIs mientras el endpoint permanezca sin autenticación.
