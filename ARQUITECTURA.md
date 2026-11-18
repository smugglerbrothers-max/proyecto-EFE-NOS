# ARQUITECTURA — Pizarra Operativa Inteligente 2.0

Fase 2 · Basado en `AUDITORIA.md` (Fase 1). Documentos relacionados: `MODELO_DATOS.md`, `REGLAS_OPERACIONALES.md`, `AI_INTEGRATION.md`, `SEGURIDAD_Y_AUTORIZACIONES.md`, `ROADMAP.md`.

## 1. Principios

1. **La pizarra funciona sin IA.** Toda capacidad operacional (programar, asignar, detectar conflictos, calcular plazos, exportar Excel oficiales) vive en el navegador y en el motor determinístico. La IA es una capa opcional.
2. **La IA no escribe el programa oficial.** Consulta, simula y propone. Un cambio oficial solo ocurre cuando una **persona** lo aprueba en la interfaz, y queda registrado.
3. **Los cálculos críticos son código, no texto del modelo.** Disponibilidad, conflictos, duraciones, plazos y secuencias los calcula `src/motor/` (pruebas reproducibles). El modelo interpreta y explica los resultados del motor.
4. **Sin datos inventados.** Un valor no configurado aparece como **faltante**, nunca como un supuesto.
5. **Preservar el original.** `original/` no se toca. La 2.0 se construye por capas sobre el mismo HTML (ver `PROPUESTA.md`).

## 2. Modos de ejecución

```
┌────────────────────────── MODO ARCHIVO (como hoy) ───────────────────────────┐
│  Pizarra_Operativa_2.0.html (navegador o Tauri)                              │
│   ├─ Pizarra original (React/Konva/zustand) ─ vistas, edición, Excel oficiales│
│   ├─ Capa 2.0: HOY, navegación, ficha, alertas                                 │
│   └─ Motor operacional (src/motor) ─ conflictos, necesidades, simulación       │
│  Sin IA. Guardado: localStorage + HTML autocontenido.                          │
└───────────────────────────────────────────────────────────────────────────────┘

┌──────────────────── MODO SERVIDOR LOCAL (nuevo, opcional) ────────────────────┐
│  Navegador ──HTTP 127.0.0.1──► pizarra-servidor (Node 22, en el equipo del    │
│  (misma 2.0)                    jefe de terreno o de la oficina técnica)       │
│                                  ├─ API REST /api/*                            │
│                                  ├─ Motor operacional (mismo src/motor)        │
│                                  ├─ AI Orchestrator + Provider Manager         │
│                                  ├─ Approval, Audit, Sync, Context managers    │
│                                  ├─ Almacén: datos/ (JSON + JSONL de auditoría)│
│                                  └─ Secretos: .env local (fuera del repo)      │
│                                        │            │             │            │
│                                   Claude API   Gemini API   Ollama 127.0.0.1   │
└───────────────────────────────────────────────────────────────────────────────┘
```

- El **mismo HTML** detecta el servidor (`GET /api/estado`). Si no responde, sigue en modo archivo y oculta la IA, sin errores visibles.
- El servidor escucha solo en `127.0.0.1`. Exponerlo en red queda fuera del alcance hasta definir autenticación (ver `SEGURIDAD_Y_AUTORIZACIONES.md`).
- **Por qué Node:** el motor ya es JavaScript y corre igual en navegador y servidor; Node 22 trae `fetch` y `node:test`; no hace falta un framework.
- **Tauri:** el original ya soporta escritorio. Más adelante, el servidor puede empaquetarse como *sidecar* de Tauri; no es requisito.

## 3. Componentes

| Componente | Dónde corre | Responsabilidad | Depende de | Estado |
|---|---|---|---|---|
| **Operational Rules Engine** (`src/motor/`) | navegador + servidor | Disponibilidad, conflictos, duraciones, plazos, necesidades preventivas/cortadas, tramos | nada | **Implementado (Fase 3)** |
| **Resource Planner** (`motor/necesidades.mjs`) | ambos | Necesidades por actividad, calendario consolidado, fechas límite, carga por día | motor | **Implementado (núcleo)** |
| **Schedule Planner** (`motor/trisemanal.mjs`, `simulacion.mjs`) | ambos | Resumen trisemanal, simulación de cambios sobre copia, diff | motor | **Núcleo implementado**; UI en Fase 6 |
| **Decision Engine** | servidor (+ UI) | Genera escenarios (A/B/C) a partir de simulaciones del motor y los compara | Schedule Planner | Fase 9 |
| **Approval Manager** | servidor + UI | Lista blanca de acciones, niveles 1/2/3, ChangeSets, confirmación humana | Audit | Fase 10 |
| **Audit Manager** | servidor | Registro de solo agregado (JSONL): quién, qué, cuándo, antes/después, humano o IA | — | Fase 10 |
| **Synchronization Manager** | servidor + navegador | Revisión del plan, detección de conflictos, cola de cambios sin conexión | Audit | Fase 11 |
| **AI Context Manager** | servidor | Arma el contexto mínimo por tarea y aplica la política de datos por proveedor (filtrado y seudonimización) | motor | Fase 4–5 |
| **AI Provider Manager** | servidor | Interfaz común (Claude, Gemini, Ollama), capacidades, disponibilidad, enrutamiento | — | Fase 4 |
| **AI Orchestrator** | servidor | Intención → herramientas permitidas → motor → propuesta → explicación → solicitud de aprobación | todos | Fase 5 |
| **Interfaz** | navegador | HOY, Programa, Recursos, Gestión, Control; asistente lateral; Centro de Decisiones | API | Etapas 3–6 de `PROPUESTA.md` + Fases 5–9 |

**Desacoplamiento:** la interfaz solo conoce el contrato REST y los objetos del motor. Nunca llama a un proveedor de IA. El orquestador no conoce React. El motor no conoce ni la interfaz ni la IA.

## 4. Flujo de un cambio propuesto por la IA

```
Usuario: "Pasa las excavaciones L3 de esta semana a turno noche"
  │
  ▼  Orchestrator ── intención: reprogramar · nivel requerido: 2 (propuesta)
  │   ├─ herramienta consultar_actividades(filtro)          → motor (solo lectura)
  │   ├─ herramienta simular_cambios([{op:'mover', …}])    → motor.simular (copia)
  │   └─ herramienta crear_propuesta(changeSet)             → Approval Manager (estado: propuesta)
  ▼
UI muestra: diff (antes → después), registros afectados, conflictos nuevos/resueltos, faltantes
  │
  ├─ Rechazar → registro en auditoría (decisión humana)
  └─ Aprobar  → el NAVEGADOR aplica con las acciones del store original
               → guardado automático → Sync (revisión+1) → auditoría {aprobadoPor, origen: IA, changeSetId}
               → reversión: ChangeSet inverso (también requiere aprobación)
```

El ChangeSet se aplica en el navegador con las mismas acciones del store que usa una persona (`actualizarActividad`, `moverActividad`, `asignarUnidad`…). Así se respetan las reglas del original (postes, entregable, lámina) y el deshacer sigue funcionando.

## 5. Contrato de la API local (borrador)

| Método | Ruta | Nivel | Descripción |
|---|---|---|---|
| GET | `/api/estado` | — | Versión, revisión del plan, proveedores disponibles |
| GET | `/api/plan` · PUT `/api/plan` | — / sync | Lectura; escritura con `baseRevision` (409 si hay conflicto) |
| POST | `/api/motor/{conflictos,necesidades,trisemanal,simular}` | 1 | Cálculos determinísticos |
| POST | `/api/asistente/mensajes` | 1–2 | Conversación (streaming SSE) |
| GET/POST | `/api/propuestas` · `/api/propuestas/:id/{aprobar,rechazar,revertir}` | 2–3 | Ciclo de vida de ChangeSets |
| GET | `/api/auditoria?desde=&tipo=` | — | Consulta del registro |
| GET/PUT | `/api/config` | admin | Plazos, horarios, responsables, política de datos por proveedor |

## 6. Estructura del repositorio (objetivo)

```
original/                    respaldo íntegro (no se modifica)
src/motor/                   motor determinístico (ESM, sin dependencias) ← Fase 3 ✔
src/ui/                      capa 2.0 para el HTML (HOY, navegación, ficha, asistente)
src/puente.patch.json        reemplazos mínimos y verificados en el bundle
servidor/                    pizarra-servidor (Node): api/, ia/, aprobaciones/, auditoria/, sync/
tools/build.mjs              original + parches + src/ui + motor → version2/
tests/                       node:test (motor, servidor) + Playwright (UI, regresión)
version2/                    artefacto generado
datos/ (ignorado por git)    plan de trabajo, propuestas, auditoría, conversaciones
```

## 7. Decisiones de arquitectura (ADR resumidas)

| # | Decisión | Alternativa descartada | Motivo |
|---|---|---|---|
| 1 | Servidor local opcional, Node, solo 127.0.0.1 | Claves en el navegador; servicio en la nube | Las claves no pueden ir en el HTML; los datos quedan en el equipo |
| 2 | Motor en ESM puro compartido | Lógica dentro del bundle minificado | Probable, legible, reutilizable por la IA y la UI |
| 3 | La IA produce ChangeSets; la persona aplica en la UI | La IA escribe directamente | Control humano, trazabilidad, reutiliza reglas del store |
| 4 | Ciclo de herramientas propio (Messages API), no agentes gestionados | Agente alojado por el proveedor | Aprobaciones locales, multiproveedor, datos locales, funcionamiento sin conexión con Ollama |
| 5 | Auditoría JSONL de solo agregado | Base de datos | Simple, legible, respaldable; volumen bajo |
| 6 | Concurrencia optimista por revisión | Último en guardar gana | Requisito explícito: no sobrescribir en silencio |
