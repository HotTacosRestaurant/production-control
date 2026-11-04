# Production Control — Preparaciones intermedias no contabilizables

**Fuente:** `production-control copy(9).zip`, adjuntado el 4 de noviembre de 2026. Este paquete **no** se obtuvo de una lectura en vivo de `main` en GitHub.

## Objetivo

Permitir **producir MARINADO, registrar tiempo de elaboración, documentar cantidad obtenida y usar ese MARINADO como ingrediente de CARNITAS** sin exigir inventario físico de MARINADO en apertura y cierre.

## Regla funcional

- Para productos de tipo `finished` existe `countable` (booleano). **Ausente equivale a `true`** para preservar el comportamiento de todos los productos existentes.
- `countable=true`: mantiene conteo físico, presentación y pronóstico de inventario.
- `countable=false`: mantiene producción, procedimiento y cronómetro. Finaliza el lote capturando **cantidad producida** con su unidad (`kg`, `L`, etc.), sin registrar bolsas físicas. Aparece en la búsqueda de ingredientes de otros lotes.
- `active` **no** equivale a `countable`. Una preparación no contabilizable sigue activa y utilizable.
- Los insumos simples (`ingredient`) se siguen usando como antes y **no aparecen** en conteos físicos por este cambio.
- Se prohíbe registrar un producto como ingrediente de su propio lote. Un registro de ingredientes es manual: no provoca decrementos de existencias automáticos.
- Los conteos físicos nuevos y salidas extraordinarias solo admiten `finished` contabilizables. Los conteos históricos y sus revisiones siguen consultables/corregibles.
- `pc_batches.countableSnapshot` preserva el modo usado al crear el lote. Los lotes iniciados antes de desactivar el switch siguen con su comportamiento anterior.
- En lotes no contabilizables, `bagCount=0`, `partialAmount=0`, y el resultado real se mantiene en `outputAmount` / `outputUnit`. Los reportes de producción e insumos retienen estos registros.
- `01_Existencias` excluye productos no contabilizables, pero `04_Producción`, `07_Ingredientes` y los hechos de exportación conservan producción e ingredientes. La estructura de `dim_productos.csv` se mantiene igual para no alterar integraciones.

## Archivos incluidos

1. `src/app/page.tsx`: toggle, conteos, entrada de preparaciones como ingredientes, captura directa y corrección de producción no contabilizable.
2. `src/app/pc.css`: presentación del toggle.
3. `src/app/api/pc/[action]/route.ts`: persistencia y validación de `countable`, producción e insumos, protección de conteo físico.
4. `src/lib/pc-units.ts`: permite también porciones como unidad de ingrediente intermedio.
5. `src/lib/pc-kpis-server.ts`: excluye no contabilizables del catálogo de pronóstico de inventario.
6. `src/lib/pc-reports-server.ts`: bloquea pronósticos directos de productos no contabilizables.
7. `src/lib/pc-operational-report.ts`: evita filas no contabilizables en `01_Existencias`; preserva hechos de producción.
8. `src/app/consulta/page.tsx` y `src/lib/pc-consulta-chart.ts`: distinguen la producción sin conteo físico en Consulta Operativa y evitan mostrar bolsas inexistentes.
9. `tests/pc-intermediate-preparation.test.cjs`: pruebas aisladas de la API y reportes con Firestore en memoria; **no escriben datos reales**.

## Instalación segura (PowerShell)

Abre PowerShell **en la raíz de `production-control`**. Antes de sobrescribir nada, comprueba que tu copia local coincide con el ZIP fuente:

```powershell
$paquete = 'C:\RUTA\AL\PAQUETE\Production_Control_Preparaciones_Intermedias_No_Contabilizables'
& "$paquete\PRECHECK_BASELINE.ps1" -RepoPath (Get-Location).Path
```

**Si el resultado indica `DIFIERE`, detente.** Puede haber cambios más recientes que este paquete no incluye. No sobreescribas un repositorio con cambios locales ni lo fuerces.

Si la baseline coincide, revisa `git status --short` y usa una copia de seguridad o una rama temporal antes de copiar los nueve archivos. Para hacer copia de seguridad sin contaminar el repo:

```powershell
$backup = Join-Path $env:TEMP ('production-control-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$reemplazos = Import-Csv "$paquete\MANIFEST_BASELINE_SHA256.csv"
foreach ($item in $reemplazos) {
  $destino = Join-Path (Get-Location).Path $item.Path
  $origen = Join-Path $paquete $item.Path
  $respaldo = Join-Path $backup $item.Path
  New-Item -ItemType Directory -Force -Path (Split-Path $respaldo) | Out-Null
  Copy-Item -LiteralPath $destino -Destination $respaldo -Force
  Copy-Item -LiteralPath $origen -Destination $destino -Force
}
New-Item -ItemType Directory -Force -Path 'tests' | Out-Null
Copy-Item -LiteralPath "$paquete\tests\pc-intermediate-preparation.test.cjs" -Destination 'tests\pc-intermediate-preparation.test.cjs' -Force
Write-Host "Copia de seguridad: $backup"
```

Luego valida **antes de hacer commit**:

```powershell
node --test tests/pc-intermediate-preparation.test.cjs
if ($LASTEXITCODE -ne 0) { throw 'Fallo en prueba de preparaciones intermedias' }
npm run lint
if ($LASTEXITCODE -ne 0) { throw 'Fallo ESLint' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Fallo compilacion Next.js' }
git diff --check
if ($LASTEXITCODE -ne 0) { throw 'Fallo git diff --check' }
git status --short
```

No modificar `.env.local`, Firestore Rules ni migrar datos para esta funcionalidad.

## Prueba manual mínima antes de publicar

1. **Catálogo:** edita MARINADO como **producto de producción**, activa `Activo` y desactiva **Incluir en conteos físicos**. Selecciona litros como unidad y registra el procedimiento.
2. **Producción:** crea una preparación MARINADO, registra el cronómetro y finaliza capturando, por ejemplo, **3.5 L**. Debe constar como cantidad terminada, sin requerir bolsas.
3. **Carnitas:** inicia un lote de CARNITAS, busca MARINADO en Ingredientes y registra 2.5 L. Debe quedar en `pc_inputs` asociado a CARNITAS. No descuenta automáticamente los litros producidos.
4. **Conteo:** captura apertura/cierre. Debe aparecer CARNITAS (si está marcado contabilizable) y **no MARINADO**.
5. **Corrección:** confirma que un lote MARINADO se puede corregir por cantidad producida y que los conteos anteriores siguen accesibles.
6. **Exportación:** `01_Existencias` excluye MARINADO, pero `04_Producción` y `07_Ingredientes` muestran registros correspondientes.
7. **Retrocompatibilidad:** un producto sin campo `countable` debe seguir apareciendo en conteos.
8. **Importante:** un lote ya iniciado toma su modalidad al momento de crearlo; finalízalo antes de cambiar su esquema operativo.

## Validación realizada al construir el paquete

- Parse sintáctico con TypeScript de 43 archivos TS/TSX: **PASS**.
- CSS analizado con `tinycss2`: **sin errores de sintaxis de nivel superior**.
- `node --test` de flujos de producción, ingrediente, conteo, corrección y exportación con base de datos en memoria: **2 PASS**.
- `npm ci` no pudo completarse por dependencias npm no disponibles en este entorno. **No se ejecutaron `npm run lint` ni `npm run build` aquí**; son necesarios en la computadora local antes de hacer push.
