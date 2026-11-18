# PRUEBAS

Ejecutar: `node --test tests/*.test.mjs` (Node 22, sin dependencias).

## Registro de ejecuciones

| Fecha | Fase | Suite | Resultado |
|---|---|---|---|
| 18-11-2026 | 1 | Apertura del original en Chromium (Playwright), 12 de 13 vistas recorridas, captura en móvil | Sin errores de consola. "Mañana" no se pudo pulsar (no visible en 1440 px). Panel Informe vacío (archivo externo ausente) |
| 18-11-2026 | 3 | `tests/motor.test.mjs`: 15 pruebas sobre los datos reales del original | **15/15 OK** |

### Detalle Fase 3 (motor)

| # | Prueba | Qué demuestra |
|---|---|---|
| 1 | Lectura del plan embebido | 674 actividades, 28 unidades, 8 cuadrillas |
| 2 | Días hábiles vs `Be()` original | 2.000 casos idénticos con la función original extraída del bundle |
| 3 | Duración de partidas | 282/282 iguales a la columna `duracion` del Programa |
| 4 | Conflictos del 18-11 | Camión pluma 1 en 4 actividades (alta); supervisor como info; descanso de C. Ochoa |
| 5 | Uso simultáneo en todo el plan | 217, igual a la auditoría |
| 6 | Horarios sin solape | No hay falso conflicto |
| 7 | Cuadrillas incompletas | 7 de 8, 30 referencias rotas |
| 8 | Sin plazos configurados | Ninguna fecha límite inventada; faltantes informados |
| 9 | Con plazos | Fecha límite hacia atrás en días hábiles; estados `vencido` y `hoy` |
| 10 | Cortadas | "posible" en faja vía, "no" en La Estancilla |
| 11 | Simulación (quitar recurso) | Plan oficial congelado intacto; conflicto resuelto detectado |
| 12 | Simulación (mover) | Diff exacto; operaciones no permitidas rechazadas |
| 13 | Determinismo e inmutabilidad | Misma salida; ninguna función modifica el plan congelado |
| 14 | Trisemanal | Semanas lunes→domingo; los conteos cuadran |
| 15 | Estado visible | "En curso" → "En ejecución" sin reescribir el dato |

## Plan de pruebas pendientes

| Área | Fase | Tipo |
|---|---|---|
| Las 16 verificaciones obligatorias de la UI (apertura, actividades, edición, recursos, cuadrillas, conflictos, alertas, semanal, PM, EPF, cortadas, importar/exportar Excel, persistencia, ids, escritorio/móvil) | Etapas 3–7 de `PROPUESTA.md` | Playwright sobre `version2/` vs `original/` |
| Excel oficiales: celdas generadas idénticas antes y después | 8 | comparación de XML de hojas |
| Provider Manager con proveedores simulados (caída, latencia, rechazo, sin herramientas) | 4 | node:test con *mocks*; **sin llamadas reales pagadas sin tu autorización** |
| Política de datos: nada de `contactos` sale; seudonimización ida y vuelta | 4 | node:test |
| Orchestrator: lista blanca, niveles, esquema, máximo de iteraciones | 5 | node:test |
| Inyección: observaciones con instrucciones maliciosas → ninguna herramienta fuera de lista | 5, 12 | node:test con proveedor simulado + prueba real opcional |
| ChangeSet: aplicar, auditar, revertir; conflicto de revisión | 10 | node:test + Playwright |
| Sync: dos clientes editan → 409 y resolución sin pérdida | 11 | node:test |
| Credenciales: ninguna clave en `version2/` ni en exportaciones | 4, 12 | escaneo automático |
