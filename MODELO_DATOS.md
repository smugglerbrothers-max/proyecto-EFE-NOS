# MODELO DE DATOS — Pizarra Operativa Inteligente 2.0

Fase 2. Parte del modelo existente (detalle y perfil en `AUDITORIA.md` §4). **Regla:** solo se agregan campos opcionales. No se renombran, borran ni reescriben `id` ni valores existentes.

## 1. Entidades existentes (sin cambios)

| Entidad | Clave | Campos principales | Relaciones |
|---|---|---|---|
| `unidades[]` (recursos) | `id` | `tipo` (catálogo `TIPOS_RECURSO`), `nombre`, `disciplina`, `activo`, `competencias[]`, `patente`, `propiedad`, `proveedor`, `cargo` | ← `actividad.recursos[].unidad`, ← `configuraciones.miembros[]` |
| `configuraciones[]` (cuadrillas) | `id` | `nombre`, `disciplina`, `miembros[]` | → `unidades.id` (30 referencias rotas hoy) |
| `actividades[]` | `id` | `fecha`, `turno`, `proyecto` (lmt/chena/nos), `posteIni/Fin`, `zona`, `actividad`, `disciplina`, `partida`, `cuadrilla` (texto), `responsable` (texto), `estado`, `recursos[{id, unidad}]`, `entregable`, `lamina`, `rendimiento`, `unidad`, `cantidad`, `observaciones`, `requierePreventiva`, `preventiva` | → unidades; `partida` → Programa / Last Planner |
| `programa.partidas{obra}[]` | `id` por obra | `cantidad`, `rendimiento`, `equipos`, `predecesora1/2`, `relacion`, `espera_dias`, `inicio/fin`, `*_real`, `*_linea_base`, `ejecutado`, `estado`, `postes` | ← `actividad.partida` |
| `programa.param` | — | `feriados[]`, `cal{turno: máscara 7 días}`, `proyectarDesde`, `noAntesDe` | calendario del motor |
| `lp` (Last Planner) | — | `tarjetas[]{cod, obra, col}`, `restricciones[]{act, t, esp, st, quien, fecha}`, `ppc[]` | `restricciones.act` = código de partida |
| `abast` | — | `requerimientos[]{id, descripcion, cantidad, unidad, necesario, actividad?}`, `pedidos[]`, `correlativo` | → actividad |
| `agenda.notas[]` | `id` | compromisos con día, hora, prioridad y vínculo | — |
| `settings` | — | `ventanaViaIni/Fin`, `ventanaNota` | referencia de cortada |
| `avance{"obra\|partida"}` | — | `ejecutado`, `fecha` | avance real |

## 2. Campos opcionales nuevos en `actividad`

Viajan dentro de la actividad, así que el serializador original (`xr`) los conserva sin cambios en el bundle. La versión original los ignora.

| Campo | Tipo | Uso | Lo calcula / lo llena |
|---|---|---|---|
| `horaIni`, `horaFin` | `"HH:MM"` | Horario real o programado; si fin ≤ inicio, termina al día siguiente | persona (UI) |
| `requiereCortada` | `boolean` | Declaración explícita; sin ella el motor deduce "sí" o "posible" | persona |
| `cortada` | `{solicitudId, estado, respaldo}` | Vínculo con la solicitud de cortada | Gestión |
| `preventiva` | `{tarjetaId, epf, estado, respaldo}` | (el campo ya existía, vacío) vínculo con la tarjeta EPF | Gestión |
| `motivoBloqueo` | `string` | Obligatorio si `estado = "Bloqueada"` | persona |
| `reprogramadaA` | `"YYYY-MM-DD"` | Destino al reprogramar | persona / ChangeSet aprobado |
| `documentos[]` | `{nombre, tipo, ref, fecha}` | Respaldo documental (referencia, no el archivo) | persona |
| `tiempos` | `{preparacionH, trasladoH, devolucionH, origen: "estimado"\|"real"}` | Distingue estimado de real | persona |

**Estados** (`actividad.estado`): `Programada`, `En curso` (se muestra "En ejecución"), `Bloqueada`*, `Terminada`, `Reprogramada`*, `Suspendida` (* = nuevos). "Con restricción" es una **condición calculada**, no un estado.

## 3. Claves nuevas de primer nivel en el plan

Requieren agregarse a `xr`, `Sr` y `Dr` del bundle (3 reemplazos verificados; ver `PROPUESTA.md` §6).

| Clave | Contenido |
|---|---|
| `gestion` | `{preventivas: Tarjeta[], cortadas: Solicitud[], pm: {datos, items[]}}`: persiste lo que hoy se pierde |
| `config2` | `{horarios, plazos, tiempos, responsables}` (ver `src/motor/config.mjs`); todo valor `null` = no configurado |
| `revision` | entero; lo incrementa el Sync Manager |

`schemaVer` → `"2026-11-18-pizarra2"`. Antes de la primera escritura con la 2.0 se guarda un respaldo JSON.

## 4. Datos del servidor local (no viajan en el HTML)

| Almacén | Formato | Contenido |
|---|---|---|
| `datos/plan.json` | JSON + `revision` | copia de trabajo sincronizada |
| `datos/propuestas/*.json` | JSON | ChangeSets: `{id, nivel, autor:{tipo:"ia"\|"humano", proveedor, modelo, usuario}, motivo, cambios:[{entidad, id, campo, antes, despues}], simulacion, estado:"propuesta"\|"aprobada"\|"aplicada"\|"rechazada"\|"revertida", baseRevision, creado, decidido:{por, fecha, comentario}}` |
| `datos/auditoria/AAAA-MM.jsonl` | JSONL de solo agregado | `{ts, actor:{tipo, id}, accion, entidad, ids[], antes, despues, changeSetId, revision, resultado}` |
| `datos/conversaciones/*.jsonl` | JSONL | mensajes, herramientas invocadas y resultados (para trazabilidad) |
| `datos/decisiones/*.json` | JSON | escenarios comparados, opción elegida, responsable y fundamento |
| `.env` (fuera de git) | clave=valor | `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_URL` |

## 5. Objetos calculados por el motor (no se guardan)

- **Conflicto** `{id, tipo, nivel, texto, origen, actividades[], unidades[], fecha}`. El `id` es estable para comparar antes y después.
- **Necesidad** `{clase: recurso|preventiva|cortada|material, tipo, unidadId, cantidad, fecha, turno, horaIni, horaFin, origenHorario, preparacionH, trasladoH, devolucionH, responsableCoordinacion, disponibilidad, accion, plazo, fechaLimite, estado: vencido|hoy|pendiente|sin_plazo|con_respaldo}`.
- **Simulación** `{plan (copia), diff[], conflictos:{nuevos, resueltos, persistentes}, rango}`.
- **Resumen trisemanal** `{semanas[3]{actividades, porDia, porPartida, porEstado, conflictos, carga}, necesidadesFaltantes}`.

## 6. Migración y reversión

1. **Migración:** solo se agregan los campos y claves de §2 y §3 cuando el usuario los usa. No hay reescritura masiva.
2. **Normalización visible:** "programada" se muestra como "Programada" sin modificar el dato.
3. **Reversión:** abrir el archivo en la versión original. Los campos de §2 se ignoran y se conservan; las claves de §3 se pierden **solo** si se guarda desde la versión original (advertido en la UI).
4. **Identificadores:** las pruebas verifican que el conjunto de `id` antes y después de cada operación sea idéntico, salvo creaciones explícitas.
