# ROADMAP — Pizarra Operativa Inteligente 2.0

Las etapas de UI de `PROPUESTA.md` (HOY, ficha, navegación, alertas) se integran en estas fases.

| Fase | Contenido | Entregable verificable | Estado |
|---|---|---|---|
| 1 | Auditoría completa | `AUDITORIA.md` (+ anexo de brechas para IA) | ✔ |
| 2 | Arquitectura y modelo de datos | `ARQUITECTURA.md`, `MODELO_DATOS.md`, `AI_INTEGRATION.md`, `SEGURIDAD_Y_AUTORIZACIONES.md` | ✔ (pendiente tu validación) |
| 3 | Motor operacional | `src/motor/` + `REGLAS_OPERACIONALES.md` + 15 pruebas | ✔ núcleo; falta la regla de predecesoras (→ Fase 6) |
| 3b | **Pizarra 2.0 sin IA** (Etapas 3–6 de `PROPUESTA.md`): HOY, ficha, 5 módulos, Gestión persistente, alertas con el motor | `version2/Pizarra_Operativa_2.0.html` + Playwright | siguiente |
| 4 | Servidor local + AI Provider Manager (Claude, Gemini, Ollama) + Context Manager + credenciales | `servidor/`, pruebas con proveedores simulados | — |
| 5 | Asistente conversacional (Orchestrator, herramientas de nivel 1–2) | panel lateral en la 2.0 | — |
| 6 | Planificador trisemanal y semanal (dependencias, distribución, programación semanal) | módulo PROGRAMA | — |
| 7 | Recursos y calendario de necesidades (UI sobre `calendarioNecesidades`) | módulo RECURSOS | — |
| 8 | EPF y cortadas integradas (vínculos, pendientes, consolidado por fecha y tramo) | módulo GESTIÓN | — |
| 9 | Centro de Decisiones (escenarios A/B/C a partir de simulaciones) | módulo CONTROL | — |
| 10 | Approval Manager + Audit Manager (ChangeSets, nivel 3, reversión) | — | — |
| 11 | Sincronización y modo híbrido (revisiones, conflictos, cola sin conexión) | — | — |
| 12 | Pruebas integrales y validación en terreno | `PRUEBAS.md` completo | — |

**Por qué 3b antes de 4:** el motor ya entrega valor sin IA (conflictos reales, plazos, necesidades). Llevarlo a la pantalla HOY y hacer persistente la Gestión resuelve los dos riesgos operativos más altos de la auditoría (Preventivas, PM y Cortadas se pierden; la pantalla no muestra la situación del día) sin depender de cuentas ni claves de IA.
