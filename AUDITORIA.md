# AUDITORÍA — Pizarra de Operaciones LMT (versión 2026-11-13)

Etapa 1 · Fecha de auditoría: 18-11-2026 · No se hicieron cambios funcionales.

- Archivo auditado: `original/Pizarra_Operaciones_2026-11-13.html` (copia íntegra y sin modificar)
- SHA-256: `91c028181f1fe6bc2ed771b1e7c3b7a2ab2b325df4000e4140b40cebebbb2b11`
- Tamaño: 3,65 MB · 2.641 líneas (la mayoría de las líneas tienen más de 100 KB)
- Datos guardados en el archivo: 17-11-2026 23:54:25 (UTC)

---

## 1. Arquitectura actual

La aplicación es **un único archivo HTML autocontenido**, que funciona sin servidor y sin conexión.

| Líneas | Bloque | Contenido |
|---|---|---|
| 2 | `<script id="plan-inicial">` | `window.__PLAN_INICIAL = {…}`: **todos los datos** (757 KB de JSON) entre los marcadores `/*PLAN_INICIAL_INI*/ … /*PLAN_INICIAL_FIN*/` |
| 6–51 | `<script type="module">` (bundle Vite minificado) | React 19.3, react-dom, react-konva + Konva 10.9, zustand (store), JSZip + pako (Excel), cliente opcional de Tauri (escritorio) |
| 52–2126 | Código **agregado a mano dentro del mismo módulo** | Plantillas Excel oficiales en base64, catálogo PEP, catálogo EPF, vistas Preventivas / PM / Cortadas / Panel Informe |
| 2127–2636 | `<style>` | CSS de la aplicación (51 KB) |
| 2638–2642 | `<body><div id="root">` | Punto de montaje |

**Punto de entrada:** al final del módulo, `createRoot(#root).render(<StrictMode><Em/></StrictMode>)`.
`Em` es el componente raíz: atajos Ctrl+Z, Ctrl+Y y Ctrl+S, aviso al cerrar si hay cambios sin guardar y selector de vistas.

**Componentes principales** (nombres minificados → función):

| Símbolo | Función |
|---|---|
| `U` | Store zustand (estado global y acciones) |
| `oa` | Barra superior: obra, fecha, vistas, turno, disciplina, alertas, deshacer/rehacer, sincronizar, Guardar, menú Archivo |
| `sa` | Panel izquierdo: Dotación, Cuadrillas, Figuras |
| `_p` | Vista **Día**: lienzo Konva con la línea de postes P1–P128 y tarjetas arrastrables |
| `Ir` | Vistas **Semana / 3 semanas / Mes** |
| `Ep` | Panel derecho: ficha de actividad o recurso (edición) |
| `Xp` | **Last Planner** (tarjetas por columna y restricciones) |
| `rm` | **Agenda** (notas o compromisos) |
| `ym` / `Tm` | **Avance** / **Término** (proyección a partir del Programa de Obra) |
| `Mr` | Motor de **alertas** existente |
| `De` | Motor Excel propio sobre JSZip (`abrir`, `hoja`, `set`, `generar`) que conserva el formato de la plantilla |
| `VistaPedidosPM`, `VistaPreventivas`, `VistaCortadas`, `VistaPanelInforme` | Vistas agregadas a mano (líneas 52–2126) |

**Navegación actual:** 13 pestañas en una sola fila: Día · Mañana · Semana · 3 semanas · Mes · 📌 Last Planner · 🗓 Agenda · 📦 Pedidos (PM) · 🛡️ Preventivas EFE · ⚡ Cortadas EFE · 📊 Panel Informe · 📈 Avance · 🏁 Término. A eso se suman Tarjetas, el selector de obra (LMT/CHENA/NOS), el turno, la disciplina, las alertas y el menú Archivo.

## 2. Inventario de funcionalidades

| Área | Funcionalidad | Dónde |
|---|---|---|
| Planificación | Crear actividad sobre poste o zona; arrastrar a lo largo de la línea; duplicar, eliminar, copiar o pasar al día siguiente; duplicar el día; propagar hacia adelante; desplazar postes | store `crearActividad`, `moverActividad`, `duplicarDia`, `propagarAdelante`… |
| Planificación | Vistas Día (lienzo), Semana, 3 semanas, Mes; filtros por turno y disciplina | `_p`, `Ir` |
| Planificación | Detección automática de postes (P#–P#) y entregable o lámina a partir del texto de la actividad | `actualizarActividad` |
| Recursos | Dotación (personas, máquinas, equipos) con tipo, disciplina, competencias, propiedad o arriendo, patente y estado activo | `sa`, `crearUnidad`, `actualizarUnidad` |
| Recursos | Asignar recurso a actividad, arrastrar entre actividades, quitar, duplicar; asignación automática de una unidad libre del mismo tipo | `agregarRecurso`, `yr` |
| Cuadrillas | Configuraciones reutilizables (guardar, actualizar, eliminar, soltar sobre actividad, separar en frente paralelo) | `guardarConfiguracion`, `separar` |
| Alertas | 20 alertas visibles (ver §5) | `Mr` |
| Last Planner | Tarjetas por columna (Programa maestro → Con restricciones → Liberada → S+1 → Esta semana → Hecho / No hecho); restricciones con estado Detectada / En gestión / Resuelta / Vencida; PPC | `Xp`, `lp` |
| Agenda | Notas o compromisos con día, hora, prioridad, encargado y vínculo con tarjeta | `rm`, `agenda` |
| Abastecimiento | Requerimientos y pedidos internos (correlativo PM-…), alerta "pedir ya" y arriendos sin pedir | `abast`, `setAbast` |
| Pedidos PM | Ítems agrupados por PEP, 16 filas por documento, correlativo incremental, Excel oficial e impresión | `VistaPedidosPM`, `exportarPMOficial` |
| Catálogo PEP | Lista fija `window.__PEP_CATALOG` | línea 64 |
| Preventivas EPF | Tarjetas por EPF (LB / CA / PS), semanas 16-11 y 23-11 precargadas, "semana tipo", "sugerir desde el plan", Excel oficial por EPF o de las tres | `VistaPreventivas`, `exportarPreventivaOficial` |
| Cortadas | Tarjetas de solicitud de cortada y Excel oficial | `VistaCortadas`, `exportarCortadasOficial` |
| Programa de Obra | **Importar** el Programa (.xlsx), sincronizar (fechas, avance, tarjetas), restaurar la sincronización anterior, programar hasta el término, pasar tarjetas del Excel a la pizarra | menú Archivo |
| Exportación | Exportar toda la programación a Excel; tarjetas semanales o trisemanales (PDF/impresión y agregarlas al Excel); respaldo JSON | menú Archivo |
| Persistencia | Guardado automático, Guardar (Ctrl+S) como HTML autocontenido, abrir .html o .json, deshacer/rehacer (50 pasos) | §3 |
| Avance / Término | Avance por partida y proyección de término | `ym`, `Tm`, `avance` |
| Panel Informe | Iframe a `Panel_Informe_Pizarra_Operaciones.html` y descarga de plantillas | `VistaPanelInforme` |

## 3. Persistencia

1. **Guardado automático** (600 ms después de cada cambio): `localStorage["pizarra_lmt_autosave"]`. Bajo Tauri (escritorio) también se guarda en `AppData/plan_autosave.json`, con respaldos rotativos cada 15 minutos (30 archivos).
2. **Guardar (Ctrl+S)**: clona el propio documento, reemplaza `#plan-inicial` por los datos actuales y descarga o sobrescribe el `.html`. **El archivo se guarda a sí mismo**: cualquier código nuevo también tiene que viajar dentro del HTML.
3. **Al abrir**: carga `__PLAN_INICIAL` o el guardado automático y normaliza los datos con `br()`, la migración existente (completa disciplina y `activo`, renombra `APM-`→`PM-`).
4. **Serialización** `xr()`: solo guarda las claves `version, schemaVer, proyecto, unidades, configuraciones, actividades, settings, lp, agenda, programa, abast, avance, termino`. **Una clave nueva de primer nivel se pierde al guardar**, salvo que se agregue a `xr`, `Sr` y `Dr`. Los campos nuevos *dentro* de una actividad sí se conservan.
5. Otras claves: `pizarra_proyecto`, `agenda_tab`, `pizarra_ultima_sinc` (localStorage) y la base IndexedDB `pizarra_programa` (archivo del Programa vinculado).

## 4. Estructura de datos (estado al 17-11-2026)

```
plan
├─ version: 2, schemaVer: "2026-11-16-smart-v2", proyecto: "lmt"
├─ unidades[28]        {id, tipo, nombre, disciplina, activo, competencias[], patente?, cargo?, propiedad?, proveedor?}
├─ configuraciones[8]  {id, nombre, disciplina, miembros[ids de unidad]}      ← cuadrillas
├─ actividades[674]    {id, fecha, turno, proyecto, posteIni, posteFin, zona?, actividad, disciplina,
│                       partida, cuadrilla, unidad, rendimiento, cantidad?, responsable, estado,
│                       recursos[{id, unidad}], entregable, lamina?, observaciones?, requierePreventiva?,
│                       preventiva?, importado, restricciones?}
├─ settings            {ventanaViaIni "00:00", ventanaViaFin "05:00", ventanaNota}
├─ lp                  {tarjetas[14], restricciones[12], tally, calc, ppc[]}
├─ agenda              {notas[0]}
├─ programa            {origen "Programa Obra EFE NOS.xlsx", partidas{lmt[78], chena[188], nos[47]}, param, …}
├─ abast               {requerimientos[0], pedidos[0], correlativo 0}
├─ avance              {"lmt|LMT-LIM": {ejecutado, fecha}, …}
└─ guardado            ISO timestamp
```

**Relaciones:**
- `actividad.recursos[].unidad` → `unidades.id` (2.728 referencias, todas válidas).
- `configuraciones.miembros[]` → `unidades.id` (**hay referencias rotas**, ver §6).
- `actividad.partida` → `programa.partidas[obra].id` o `lp.tarjetas.cod` (las restricciones de Last Planner se vinculan por `act` = código de partida).
- `actividad.responsable` y `actividad.cuadrilla` son **texto libre**, no referencias.

**Perfil de los datos:**
- Fechas desde 19-10-2026 hasta 06-09-2027. Obras: lmt 501, chena 135, nos 38. Turnos: diurno 384, nocturno 290.
- `estado`: **todas** las actividades están "Programada" (627) o "programada" (47, en minúscula). Nadie ha registrado ejecución ni cierre: 202 actividades anteriores a hoy siguen "Programada".
- Estados que ofrece la interfaz: `Programada · En curso · Terminada · Suspendida`. No existen "Bloqueada" ni "Reprogramada". La reprogramación solo aparece como prefijo "↻" en el nombre (15 actividades).
- Las actividades no tienen horario propio, solo turno. El horario existe únicamente en las tarjetas de preventivas y cortadas.
- Ninguna actividad tiene `preventiva` vinculada, aunque 573 la requieren.
- Hoy (18-11) hay 13 actividades.

## 5. Sistema de alertas existente (`Mr`)

Revisa desde hoy hasta un horizonte de 2 semanas para responsable, recursos y preventivas. Reglas actuales:

| Nivel | Regla |
|---|---|
| alta | Mismo recurso en 2 o más actividades, misma fecha y turno |
| alta | Persona con turno noche y turno de día a continuación (descanso) |
| alta | Equipo ferroviario en turno diurno |
| alta | Requerimiento de material atrasado ("pedir ya") |
| alta/media | Arriendo programado sin pedir |
| alta | Tarjeta Last Planner con restricciones abiertas o vencidas |
| media | Personal sin capataz ni supervisor; máquinas sin operador; camión grúa sin operador o sin rigger |
| media | Requiere preventiva y no la tiene |
| media | Predecesora no terminada ni programada antes |
| info | Sin responsable; sin recursos; faja vía (confirmar cortada); competencia de disciplina |

**Conclusión:** la base es buena. No conviene reemplazarla; conviene **extenderla**, porque faltan recursos inactivos, cuadrillas incompletas, vencidas sin cierre y actividad bloqueada, y la referencia al registro es solo por id de actividad.

## 6. Problemas detectados

**Datos**
1. **Cuadrillas con integrantes inexistentes:** 7 de 8 configuraciones tienen 30 referencias a ids que no están en `unidades` (por ejemplo `u-cap-civil-lmt` y `u-exc-lmt-1…4`). Al soltar la cuadrilla, esos integrantes no aparecen.
2. **Estados sin uso real:** sin "En curso" ni "Terminada", la pizarra no refleja la ejecución. Además hay valores inconsistentes ("programada" en minúscula).
3. **Conflictos de recursos reales:** hoy, el camión pluma 1 aparece en 4 actividades, la rampla y el GEO-X en 3, y Mariano Ortiz en 3. Hay 217 combinaciones recurso/fecha/turno duplicadas en total.
4. Las observaciones de las actividades de tarjetas semanales repiten el mismo texto largo de la tarjeta completa.

**Funcionales**
5. **Preventivas, Pedidos PM y Cortadas no se guardan.** Su estado vive solo en el componente (`useState`): al cambiar de pestaña o recargar, se pierde lo editado y se vuelve a los datos fijos del código (semanas 16-11 y 23-11). Es el riesgo operativo más alto.
6. **Panel Informe vacío:** el iframe apunta a `Panel_Informe_Pizarra_Operaciones.html`, que no viaja con la pizarra.
7. **Pestaña "Pedidos" desplazada:** la vista original de abastecimiento (`abast`) quedó sin acceso directo; la pestaña ahora abre `VistaPedidosPM`. Los requerimientos `abast` siguen alimentando alertas.
8. Datos fijos en el código: semanas de preventivas precargadas, RUT y celulares de EPF, firmantes del PM ("JERMAIN BASCOUR", "FELIPE VILLEGAS"), correlativo base "EFE NOS 000188" y valores por defecto de tramo y km.

**Técnicos**
9. Las vistas agregadas dependen de nombres minificados del bundle (`U`, `b`, `W`, `li`, `De`, `rr`). Una recompilación del bundle las rompe.
10. `actualizarActividad` fue editado a mano dentro del código minificado (detección de postes y zona).
11. No hay código fuente legible ni proceso de compilación en el repositorio; el código fuente original de Vite no está disponible.
12. Las plantillas Excel en base64 (≈1,1 MB) se duplican en cada guardado (esto es esperable, pero hace pesado el archivo).

**Usabilidad**
13. **Sobrecarga en la barra superior:** 13 vistas y más de 10 controles. En el teléfono, la barra ocupa media pantalla y el lienzo Día es ilegible.
14. **No existe una pantalla de "situación de hoy":** para saber qué pasa hoy hay que leer el lienzo de postes o la semana.
15. Las vistas de Gestión son formularios extensos con muchos botones de colores.

## 7. Riesgos de modificación

| Riesgo | Mitigación |
|---|---|
| Romper el guardado (el HTML se clona a sí mismo) | El código nuevo vive en un `<script>` propio dentro del mismo HTML; se probará Guardar → reabrir |
| Perder datos por claves nuevas no serializadas | Agregar la clave a `xr`, `Sr` y `Dr` con un cambio mínimo y documentado; los campos nuevos de actividad van como campos opcionales |
| Dependencia de nombres minificados | Un único "puente" (`window.__PIZARRA = {store, React, jsx, excel, guardarArchivo}`) en un solo punto; el resto del código nuevo usa solo el puente |
| Cambiar identificadores | No se reescribe ningún `id`; los estados existentes se conservan (las etiquetas nuevas son solo de visualización) |
| Compatibilidad hacia atrás | Un archivo guardado con la 2.0 debe abrir en la versión original: los campos opcionales se ignoran. La clave nueva de Gestión se pierde si se guarda desde la versión antigua (se documentará) |
| Excel oficial | No tocar `De`, las plantillas ni las funciones `exportar*Oficial`; pruebas comparando celdas generadas antes y después |
| Regresión visual del lienzo Día | No se modifica `_p` ni `Ir`; solo se reubican en el módulo PROGRAMA |

## 8. Propuesta de intervención (resumen)

Ver `PROPUESTA.md` (Etapa 2) y la maqueta `propuesta/maqueta_HOY.html`.

1. Versión nueva separada en `version2/`, construida por un script (`tools/build`) a partir del original sin modificarlo y de fuentes legibles en `src/`.
2. Puente mínimo hacia el store y un script propio con los módulos HOY, navegación, alertas extendidas y persistencia de Gestión.
3. Las vistas existentes se conservan tal cual y se reagrupan en 5 módulos.
4. Migración controlada y reversible: solo se agregan campos opcionales; no se renombran ni borran datos.

---

## 9. Anexo (Fase 1, Pizarra Inteligente 2.0): brechas frente a la nueva visión

| Capacidad requerida | Estado en el original | Consecuencia para el diseño |
|---|---|---|
| Backend o servidor | **No existe.** Es un HTML en el navegador; opcionalmente corre como escritorio Tauri (plugins `fs` y `dialog`), pero el shell Tauri no está en el repositorio | Las claves de API **no pueden** vivir en el HTML. La IA en la nube requiere un **servidor local** nuevo |
| Horario de actividad | Solo turno (Diurno/Nocturno). Las horas existen únicamente en tarjetas de preventivas y cortadas | Campos opcionales `horaIni` y `horaFin`. Sin ellos, el motor informa "horario faltante" |
| Plazos de preparación o anticipación | No existen | Configuración nueva; **sin valores por defecto inventados** |
| Necesidad de cortada por actividad | No existe el campo. Solo una alerta informativa "faja vía" y la regla de equipo ferroviario en turno diurno | Campo opcional `requiereCortada`. El motor deduce "sí" o "posible", nunca "autorizada" |
| Vínculo actividad ↔ preventiva | Campo `preventiva` previsto, pero ninguna de 573 actividades lo tiene | Vincular desde Gestión; la alerta existente sigue vigente |
| Materiales por actividad | `abast.requerimientos` existe (con `actividad`) pero está **vacío** | El calendario de materiales funciona apenas se registren requerimientos |
| Historial y trazabilidad | Solo deshacer en memoria (50 pasos); no hay bitácora | Audit Manager nuevo (registro solo de agregado) |
| Usuarios y permisos | No hay identidad de usuario | Identidad local simple (nombre y rol) en el servidor; sin ella, el modo archivo sigue como hoy |
| Sincronización | Guardado automático en localStorage + archivo HTML; sin control de versiones | Revisión por versión con detección de conflictos |

**Hallazgo adicional del motor (18-11):** Cristian Ochoa está asignado al turno nocturno de CHENA y a turnos diurnos el mismo día. La regla de descanso del original también lo marca.
