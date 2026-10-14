# Production Control — Reemplazos completos · 14/oct/2026

Paquete preparado directamente desde `production-control copy(6).zip`. Conserva Next.js, Firebase, colecciones e IDs de registros existentes. **No es una versión probada contra la base Firestore real.** Primero probar en una rama y staging.

## Qué cambia

1. **Salidas especiales:** opción adicional «Windsor». Se registra como salida del origen; **no crea una recepción automática** en Windsor.
2. **Presentaciones:** productos terminados con `bagSize` + `bagUnit` (kg, g, lb, L, mL, piezas y porciones). Ejemplo: bolsa de 10 porciones: se cuentan 10 bolsas, y se conocen 100 porciones. Los productos previos sin esos campos siguen usando `bagWeightKg` en kg. Las unidades físicas incompatibles **no se suman entre sí**.
3. **Consulta operativa:** nueva ruta `/consulta`, visible para usuarios de Firebase Authentication con `portal_users/{uid}` activo, `role: "viewer"` o `role: "admin"`. Muestra gráfica de bolsas por día, conteos, producción, ingredientes y salidas; no usa el endpoint de KPIs. El usuario `viewer` **no tiene acceso** a los endpoints de Management. La consulta se hace por periodo y sucursal.
4. **Alta de productos:** permite una medida diferente de kg por bolsa y conserva la conversión opcional a kilogramos solo para presentaciones de masa. Los cálculos gerenciales **en kg** no representan porciones/piezas/litros; deben analizarse por unidad, no tratarse como cero kg de consumo real.
5. **Producción:** campo «Fecha de producción» independiente de «Fecha del conteo».
6. **Ingrediente:** el desplegable se cierra al seleccionar, al perder enfoque y al registrar.
7. **Cierre de producción:** «Finalizar preparación» está disponible tanto en «Por producto» como en «Por persona»; registra bolsas terminadas y contenido extra en la unidad de producto. Requiere cronómetros pausados y un resultado positivo. Conserva snapshot de presentación en lotes nuevos.
8. **Finalización única:** los lotes finalizados no muestran botón de finalizar y el backend bloquea un segundo cierre, usando transacción. Para cambiar el resultado terminado hay una corrección autorizada.
9. **Producción por fecha:** las abiertas se muestran de forma independiente (incluidas pendientes anteriores) y las finalizadas se agrupan por día y se despliegan solo al pedirlo.
10. **Conteos por fecha:** filas compactas apertura/cierre; «Sin registrar» para los días sin datos del periodo. Al registrar tarde se conserva fecha operativa, responsables y timestamp del servidor (`capturedAt`). No se crean registros falsos de «sin conteo».
11. **Consultas limitadas:** cocina carga por defecto solo el día actual; para buscar un rango se seleccionan fechas **antes de pedir los datos**. Máximo 91 días inclusivos. Firestore aplica filtros por `operationalDate` antes de descargar, incluidos ingredientes, movimientos y actividades. Los lotes aún abiertos se recuperan aparte. Management usa un periodo inicial de 30 días y el endpoint rechaza consultas mayores de 91 días.
12. **Correcciones:** sin firmas, con código de verificación del encargado, motivo, nombre de operador y revisiones anteriores en Firestore. Se aplica a conteo, insumos, producción final y cronómetros. **Nunca se pide este código para contar, preparar, registrar ingredientes o usar cronómetros normalmente**.

## Configuración antes de desplegar

1. Guarda una copia del repositorio actual y un respaldo de Firestore. Prueba primero con datos no productivos.
2. Reemplaza los archivos manteniendo las rutas exactas indicadas en `ARCHIVOS_MODIFICADOS.txt`. Los archivos existentes no incluidos no se sustituyen.
3. En **Vercel → Production Control → Settings → Environment Variables** agrega `PC_CORRECTION_CODE` como **Secret** con un valor resistente a intentos de adivinación (recomendado 12+ caracteres). Añade el mismo valor a `.env.local` para pruebas locales (no publicar ni versionar el secreto). Redeploy después de cambiarlo.
4. **NO** configures `PC_OPERATIONS_PIN`: ya no se utiliza; ni conteos ni producción requieren códigos.
5. Para habilitar un usuario de consulta, crea su cuenta en **Firebase Authentication** y agrega/actualiza el documento `portal_users/{firebaseAuthUid}` con `active: true`, `role: "viewer"`. Hazlo con permisos administrativos. El superadmin mantiene su control actual con `role: "admin"` **y la lista de correos autorizados**. No se agregan cuentas automáticamente ni contraseñas al repositorio.
6. No cambies indiscriminadamente las reglas de Firestore de otras aplicaciones. Las rutas del servidor usan Firebase Admin SDK, así que las reglas de cliente no suplen la autorización del servidor.
7. Ejecuta en tu equipo: `npm ci`, `npm run lint`, `npm run build`; después valida en staging con un usuario de cocina y otro `viewer`. Realiza un despliegue sólo al aprobar las pruebas.

## Límites explícitos de seguridad

- La captura de cocina **es anónima** a nivel de inicio de sesión; el nombre seleccionado sirve para atribución operativa, **no es una identidad autenticada**.
- El endpoint básico `/api/pc/snapshot` es accesible al personal sin cuenta, porque la cocina debe consultar el inventario actual e históricos seleccionados sin login. Por lo tanto, **la información operativa que puede leer cocina no es confidencial a nivel de API**. `/consulta` exige cuenta para dar una experiencia de supervisión; para que toda la historia operativa sea privada será necesario separar en el futuro el subconjunto público de cocina del API de supervisión.
- La protección de **KPIs gerenciales** sí se aplica en servidor con Firebase Auth, allowlist de superadministradores y rol `admin`.
- Correcciones requieren `PC_CORRECTION_CODE` validado en servidor; si falta, el endpoint devuelve error 503 y **no permite corregir**. Los registros normales siguen operando.
- Por ahora no hay límite de intentos de código de corrección; se recomienda un secreto robusto, HTTPS y protección WAF/rate limiting desde Vercel.

## Compatibilidad y alcance

- Se conservan registros previos y formatos antiguos `bagWeightKg`, `openKg`, `partialKg`, `outputKg` para cantidades de masa; las unidades nuevas utilizan `bagSize`, `bagUnit`, `openAmount`, `partialAmount` y `outputAmount`.
- Los informes/KPIs heredados que se expresan en kg **no calculan rendimiento de porciones ni litros**. Los datos de ingredientes registrados siguen en sus unidades nativas. No se inventa un rendimiento numérico sumando agua, masa y piezas.
- En consultas gerenciales y reportes por periodo, actividades/ingredientes **legacy sin campo `operationalDate`** pueden no aparecer hasta que se les añada ese campo con una migración verificada. Las consultas de lotes actuales sí utilizan los datos registrados con fecha.
- Cualquier lote activo muy antiguo permanece en «En curso» hasta que sea finalizado/corregido; el backend limita a 60 lotes pendientes fuera del periodo. Si existe más carga acumulada que esa, conviene cerrar los lotes legítimamente y hacer limpieza supervisada.
- La finalización se bloquea si un cronómetro aún corre. El aviso en la pantalla indica qué persona debe pausarlo; «Terminar mi tiempo» y «Finalizar preparación» son acciones distintas.
- Firestore requiere índices automáticos de campos simples `operationalDate`, `status` y `batchId` (configuración predeterminada). No se añadieron consultas de múltiples campos que requieran índices compuestos.

## Pruebas mínimas antes del despliegue

1. Crear producto de 1 kg, otro de 5 lb, otro de bolsa con 10 porciones; guardar, editar y reabrir.
2. Contar apertura/cierre por separado; verificar bolsas y subtotal por unidad sin mezclas.
3. Registrar movimiento Windsor, comprobar sitio origen y cantidades.
4. Crear lote, agregar ingrediente, iniciar cronómetro, intentar finalizar (debe advertir), pausar y finalizar en ambas vistas. Confirmar que no permite finalizar dos veces y que guarda cantidad final.
5. Corregir una captura sin código y con código incorrecto (rechazo); con código correcto (revisión registrada).
6. Buscar varios días sin registros: las fechas vacías deben aparecer; registrar posteriormente y comprobar quién capturó y `capturedAt` real del servidor.
7. Comprobar que `/consulta` requiere usuario `viewer`/`admin`, que un `viewer` recibe 403 al solicitar Management, y que el superadmin sigue viendo KPIs.
8. Revisar periodos y que ni `snapshot`, ni Management ni los reportes consulten las colecciones operativas completas, salvo catálogos y los lotes pendientes.

## Verificación ejecutada en este entorno

- Inspección de código y validación **sintáctica** de los archivos TypeScript/TSX con el compilador global de TypeScript.
- Pruebas locales de conversiones y cantidades del módulo independiente de presentaciones.
- **No** se pudo completar `npm ci` por restricciones de acceso al registro de paquetes; por tanto **no se ha ejecutado `npm run build` ni pruebas contra Firebase/Vercel**. La revisión sintáctica no sustituye a la compilación ni pruebas de integración.
