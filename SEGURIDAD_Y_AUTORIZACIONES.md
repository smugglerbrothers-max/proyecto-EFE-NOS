# SEGURIDAD Y AUTORIZACIONES

Diseño (Fase 2). Implementación en Fase 10 (Approval y Audit) y Fase 4 (credenciales).

## 1. Credenciales

- Las claves (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) viven **solo** en el entorno o en el archivo `.env` del servidor local, con permisos `600`. `.env` está en `.gitignore`.
- **Nunca** en el HTML, en localStorage, en el plan guardado, en exportaciones ni en registros. Una prueba automática recorre `version2/` y el plan exportado buscando patrones de clave (`sk-ant-`, `AIza`).
- La UI solo ve "configurado / no configurado" por proveedor.
- El servidor escucha en `127.0.0.1`. Para abrirlo en red primero habrá que agregar autenticación y TLS (fuera del alcance actual).

## 2. Niveles de operación de la IA

| Nivel | Puede | No puede |
|---|---|---|
| **1 · Consulta** | Leer el plan (según la política de datos), consultar el motor y el historial | Cualquier escritura |
| **2 · Propuesta** | Simular; crear propuestas (ChangeSets) y borradores (programa, preventiva, cortada, PM, compromisos, listas de recursos); comparar escenarios | Modificar el plan oficial |
| **3 · Ejecución autorizada** | Pedir la ejecución de una acción de la lista blanca; se aplica **solo** tras la confirmación de una persona en la UI | Saltarse la confirmación; acciones fuera de la lista |

El nivel máximo es configurable por usuario (por defecto: 2).

## 3. Lista blanca (nivel 3, siempre con confirmación humana)

| Acción | Registros afectados | Reversible |
|---|---|---|
| Cambiar estado de actividad (excepto a "Terminada" sin respaldo de avance) | 1 actividad | sí |
| Mover actividad (fecha, turno u horario) | actividades indicadas | sí |
| Reasignar, agregar o quitar recurso de una actividad | asignaciones indicadas | sí |
| Vincular actividad ↔ tarjeta preventiva / solicitud de cortada (como borrador) | vínculo | sí |
| Crear o actualizar borradores en Gestión | borrador | sí |
| Registrar compromiso en Agenda | nota | sí |
| Registrar restricción en Last Planner (estado "Detectada") | restricción | sí |

## 4. Prohibido para la IA (no existe herramienta para hacerlo)

- Aprobar cortadas o marcarlas como autorizadas.
- Autorizar trabajos o declarar preventivas aprobadas o ejecutadas.
- Aprobar documentación preventiva.
- Comprometer recursos externos (arriendos, pedidos a proveedores).
- Enviar comunicaciones oficiales (correo, WhatsApp, portales de EFE).
- Eliminar registros (actividades, recursos, tarjetas, solicitudes).
- Cambiar configuración, política de datos o permisos.
- Marcar "Terminada" sin respaldo.

El orquestador valida **dos veces**: al exponer las herramientas (solo las del nivel del usuario) y al ejecutarlas (lista blanca y esquema).

## 5. ChangeSet: requisitos para cada operación

Cada propuesta de nivel 3 muestra, antes de confirmar:

1. Qué se modificará (descripción en lenguaje simple).
2. Registros afectados (ids y nombres; enlace al registro).
3. Estado anterior → nuevo, campo por campo.
4. Conflictos nuevos, resueltos y persistentes (simulación del motor).
5. Datos faltantes.

**Al confirmar se registra:** `aprobadoPor`, fecha y hora, origen (`ia: claude/claude-opus-5-5` o `humano`), `changeSetId`, `baseRevision`.

**Reversión:** se genera el ChangeSet inverso a partir de los valores "antes" y requiere nueva confirmación. Si el registro cambió después (revisión distinta), se informa el conflicto en lugar de revertir a ciegas.

## 6. Auditoría

- `datos/auditoria/AAAA-MM.jsonl`, de solo agregado; se rota por mes.
- Eventos: `plan.cambio` (humano), `propuesta.creada|aprobada|rechazada|aplicada|revertida`, `ia.llamada` (proveedor, modelo, tokens, error), `ia.herramienta` (nombre, nivel, resultado), `sync.conflicto`, `config.cambio`.
- Cada evento distingue `actor.tipo = humano | ia | sistema`.
- La auditoría no guarda claves ni el contenido completo de datos personales; usa ids y resúmenes.

## 7. Identidad y permisos (mínimo viable)

- En el servidor, usuarios locales con rol: `jefe_terreno` (aprueba nivel 3), `planificador` (propone y aprueba borradores), `consulta` (solo lectura).
- En modo archivo no hay usuarios; las acciones humanas se registran como `humano:local`.

## 8. Instrucciones maliciosas en documentos importados

Ver `AI_INTEGRATION.md` §5. Resumen: los datos se tratan como datos, la lista blanca es cerrada y nada oficial cambia sin una persona.
