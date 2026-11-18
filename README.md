# Pizarra Operativa Inteligente 2.0 — LMT 1×23 kV Los Guindos–Nos

| Documento | Contenido |
|---|---|
| `AUDITORIA.md` | Fase 1: arquitectura actual, funcionalidades, datos, problemas, riesgos, brechas para IA |
| `ARQUITECTURA.md` | Fase 2: modos de ejecución, componentes, flujo de aprobación, API local, ADR |
| `MODELO_DATOS.md` | Entidades, campos opcionales nuevos, ChangeSets, auditoría, migración |
| `REGLAS_OPERACIONALES.md` | Fase 3: reglas del motor (reproducidas del original y nuevas), configuración |
| `AI_INTEGRATION.md` | Provider Manager, Context Manager (política de datos), Orchestrator, herramientas |
| `SEGURIDAD_Y_AUTORIZACIONES.md` | Credenciales, niveles 1/2/3, lista blanca, prohibiciones, auditoría |
| `PRUEBAS.md` · `ROADMAP.md` | Registro de pruebas y plan por fases |
| `PROPUESTA.md` + `propuesta/` | Diseño de la pantalla HOY y de los 5 módulos (maqueta con datos reales) |

Código:
- `original/`: pizarra original **sin modificar** (respaldo).
- `src/motor/`: motor operacional determinístico (ESM, sin dependencias).
- `tests/`: `npm test` (o `node --test tests/*.test.mjs`).
- `tools/generar_maqueta_hoy.py`: genera la maqueta HOY desde el original.
