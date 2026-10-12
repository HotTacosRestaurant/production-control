# Production Control — Reemplazos v1 · 11 octubre 2026

## Qué incluye

Reemplazos basados en el ZIP `production-control copy(5).zip` (Next.js 16.3.8, Firebase Admin). No sobrescribe las colecciones antiguas ni requiere migración masiva.

**Cocina:** captura de bolsas enteras + kg de bolsa abierta; producción final en bolsas + excedente; cálculo de kg y bolsas equivalentes. Catálogo con proceso de preparación (copiado de ChatGPT), días de cobertura objetivo/mínima, lead time de producción, plazo de compra al proveedor, lote indivisible de materia prima, rendimiento esperado y materia prima principal. Vista del proceso en cada lote y conservación de snapshot. Conteos y correcciones con auditoría.

**Inventarios:** nuevo registro sencillo de salidas especiales a Food Truck, catering, merma o ajuste. Estas salidas reducen existencias pero se excluyen del cálculo de DEMANDA ORDINARIA del producto.

**Management:** filtro de periodo para KPIs; historia y baseline independientes; rangos excluidos; eventos y % de demanda adicional; bloqueos de producción por compras; línea histórica de apertura/cierre y forecast en kg; niveles mínimo/objetivo; tabla simulada de futuros lotes, cantidades, materia prima, horas y requerimientos estimados. Excel `.xlsx` multitabla con IDs, versión de esquema y actualización incremental por fecha.

**Showcase público:** indicadores, gráfica y forecast funcionales con datos demostrativos coherentes sin vínculos a registros privados reales.

## Antes de reemplazar (OBLIGATORIO)

1. Confirmar que tu proyecto coincide con el ZIP usado. Respaldar la carpeta o crear rama de Git: `git switch -c backup/pre-production-planning` y regresar a tu rama de trabajo con `git switch main`.
2. Hacer copia de las reglas actuales de Firestore y un respaldo/exportación de Firestore.
3. Hacer pruebas primero en un entorno de staging y, preferentemente, un proyecto Firebase de prueba. No poner datos de clientes reales en el showcase.
4. El ZIP contiene rutas RELATIVAS: copia las carpetas `src/` y los 3 `.md` de la carpeta REEMPLAZOS sobre la raíz del proyecto y acepta sobrescritura.

## PASO 1: entorno (importante)

En Vercel > Proyecto Production Control > Settings > Environment Variables, agregar:

```
PC_OPERATIONS_PIN = <código robusto de dispositivo, mínimo 8 caracteres>
```

Tipo **Secret**, al menos Production. NO incluir el valor en Git, en capturas ni en el chat. En local añadirlo a `.env.local` (archivo gitignored). En producción, si no se configura el PIN, los endpoints operativos devuelven **503** como medida de seguridad. Management sigue con Firebase + rol `portal_users/{uid}` (`role=admin`, `active=true`) y superadmin allow-list existente. El código no crea ni modifica ese rol.

El PIN se introduce una sola vez por sesión de pestaña; los cocineros siguen escogiendo su nombre para el registro de auditoría. No se requiere que cada persona gestione un correo o contraseña de Firebase. Para mayor control, aplicar rate limits/WAF al endpoint y usar HTTPS siempre.

## PASO 2: reglas Firestore

Abre `FIRESTORE_PRODUCTION_CONTROL.rules` incluido en este paquete.

**Si Firebase es EXCLUSIVO de Production Control**, puedes usarlo como conjunto completo de reglas después de respaldar las anteriores.

**Si comparte proyecto con cualquier otra PWA**, NO pegues el archivo completo ni borres los matches existentes. FUSIONA únicamente los matches `pc_*` y `portal_users` con las reglas originales. El archivo trae un `match /{document=**}` de denegación global que no se debe duplicar por encima de reglas de otras aplicaciones.

`pc_movements` es una nueva colección y se crea con el primer registro. Firestore Rules NO limitan llamadas hechas con Firebase Admin; esa autorización está en `/api/pc/...` y por eso es obligatorio el PIN en producción.

## PASO 3: validar y probar

```powershell
npm ci
npx tsc --noEmit
npm run lint
npm run build
npm run dev
```

No desplegar si falla cualquiera de las validaciones. Una vez iniciada la aplicación prueba:

1. **Conteo:** 7 bolsas de 5 kg + 3 kg abiertos = **38 kg**. Guarda, carga, corrige kg abiertos y comprueba que se conserve la revisión.
2. **Producción:** 2 bolsas de 5 kg + 2 kg excedentes = **12 kg** y **2.4 bolsas equivalentes**. Reabre el registro y verifica los KPIs de ese día.
3. **Proceso:** pega pasos de preparación sin cantidades en Catálogo, abre un ciclo nuevo y comprueba «Ver proceso de preparación». El snapshot no se debe alterar si editas el catálogo después.
4. **Salidas:** inventario apertura 38, cierre 31, salida especial 2 kg => consumo habitual calculado **5 kg**, no 7.
5. **Forecast:** 14 días válidos de 5 kg/día, mínimo 3 días y objetivo 10 días => umbrales **15 y 50 kg**. Si un cordero entero de 30 kg rinde 70%, produce en **42 kg** al necesitar 35 kg; alcanza **57 kg** partiendo de 15.
6. **Base/exclusiones:** elimina un intervalo de festividad solo del promedio, añade un +40% a fechas futuras, agrega bloqueo de compras y observa los cambios de la gráfica/tabla.
7. **Rendimiento:** selecciona materia prima principal, captura kg y verifica rendimiento real; si falta insumo principal, «Sin datos».
8. **Excel:** desde Management, genera reporte y pulsa «Descargar Excel»; comprueba que tenga manifest, inventory_counts, inventory_movements, production_batches, production_inputs, production_labor, daily_consumption, forecast_daily, production_plan y kpi_snapshot.
9. **Celular:** iPhone 390 px: conteos, selector de empleados, campo kg abiertos, cierre de producción, procedimiento, tabla desplazable lateralmente. Management mantiene controles separados de captura del personal.
10. **Showcase público:** `/showcase` debe mostrar gráficos, datos numéricos y tabla de escenario pero NO IDs reales, empleados ni resultados del cliente.

## PASO 4: publicar

```powershell
git status
git add src KPI-ACCESS-MATRIX.md KPI-DEFINITIONS-PRODUCTION-CONTROL.md SHOWCASE-DATA-CONTRACT.md
git commit -m "feat: production weights, forecasting, Excel exports and demo showcase"
git push origin main
```

Vercel hará su deploy si el repo está conectado. Confirmar READY y repetir las pruebas en production.

## Data Mart incremental y evolución

Excel tiene columnas y `schema_version=1`, IDs de entidades, timestamps y `manifest` con filtros y `updated_since`. Para PRIMERA extracción dejar watermark vacío. Para siguientes extracciones, utilizar el último watermark UTC con un solapamiento prudente y upsert por ID natural, no insertar a ciegas. El filtro incremental se aplica SOLO a las tablas fuente dentro del intervalo de fecha operativa seleccionado; las hojas de forecast/KPIs son snapshots del nuevo escenario. Para correcciones antiguas, vuelve a consultar la partición anual correspondiente. Las exportaciones de esta versión no emiten tombstones de borrados duros y no son aún un pipeline ETL programado. Nuevos campos deben agregarse de forma aditiva en futuras versiones, sin renombrar o borrar columnas existentes.

## Alcance pendiente de integración

* Los lotes proyectados son **simulaciones**, NO crean órdenes de compra, compromisos financieros ni producción aprobada.
* Las cantidades de ingredientes previstos se extrapolan del histórico por unidad. Hasta tener recetas normalizadas son ESTIMACIONES que debe confirmar Compras.
* Una salida hacia Food Truck reduce el inventario del origen; no registra aún una recepción validada en el destino. La recepción sigue dependiendo del conteo en Food Truck.
* No hay conexión directa con ChatGPT: el proceso de preparación se redacta externamente y se pega en el catálogo.
* La PWA puede procesar históricos que carecen de `openKg` o `partialKg` tratándolos como cero, sin reescribirlos.
* Los intervalos de actividades/insumos legacy siguen resolviéndose a través de sus IDs de lote; mejorar la estrategia de consulta incremental antes de llegar a grandes volúmenes.
* Se requiere probar en el Firebase/hosting real el circuito de red y permisos. La validación del paquete se efectuó sin arrancar el Next.js completo, porque no fue posible instalar las dependencias en este entorno.
