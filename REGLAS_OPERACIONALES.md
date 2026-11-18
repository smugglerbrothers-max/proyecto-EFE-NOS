# REGLAS OPERACIONALES — Motor determinístico (Fase 3)

Código: `src/motor/` (ESM, sin dependencias, corre en navegador y en Node). Pruebas: `tests/motor.test.mjs`.

**Garantías:**
- Funciones puras: no modifican el plan recibido (probado con objetos congelados).
- Determinismo: mismas entradas → misma salida, en el mismo orden.
- Sin supuestos: un valor no configurado se devuelve como `faltante`.
- Cada resultado incluye `origen` o `motivo` en texto, para que la UI o la IA lo expliquen.

## 1. Reglas reproducidas del original (verificadas)

| Regla | Módulo · función | Fuente en el original | Verificación |
|---|---|---|---|
| Días hábiles (máscara lun→dom `'0000011'`, feriados) | `calendario.sumarDiasHabiles` | `Be()` | Comparación con la función original extraída del bundle: 2.000 casos con feriados reales, todos idénticos |
| Duración de partida = `ceil(cantidad / (rendimiento × equipos))`; hito = 0 | `reglas.duracionPartida` | `Ve()` | 282 de 282 partidas igual a la columna `duracion` del Programa |
| Requiere preventiva: campo explícito; si no, disciplina vía, zona vías o equipo ferroviario | `reglas.requierePreventiva` | `Ar()` / `kr()` | prueba unitaria |
| Mismo recurso en 2 o más actividades, misma fecha y turno | `disponibilidad.conflictos` | `Mr()` | 217 combinaciones en todo el plan (mismo número que la auditoría) |
| Descanso: persona en turno nocturno y luego diurno (mismo día o el siguiente) | `disponibilidad.conflictos` | `Mr()` | detecta el caso real del 18-11 |
| Tramos LMT y faja vía por rango de postes | `catalogo.TRAMOS_LMT`, `reglas.tramosDe` | `yt` | prueba con P59–P65 (faja) y P71–P80 (Estancilla) |
| Catálogo de tipos (categoría, mando, ferroviario, propiedad) | `catalogo.TIPOS_RECURSO` | `Je`, `qe` | copia literal |

## 2. Reglas nuevas

| Regla | Función | Comportamiento | Nivel |
|---|---|---|---|
| Uso simultáneo con horario | `conflictos` | Si **todas** las actividades del grupo tienen `horaIni/horaFin` y no se solapan, no hay conflicto. Si no, se aplica la regla por turno | alta |
| Mando en varios frentes | `conflictos` | Supervisor, jefe de terreno o capataz en varias actividades → `supervision_multiple`, **info** (reduce ruido: hoy marcaría 3 alertas altas falsas el 18-11) | info |
| Actividades cerradas | `conflictos` | Terminada, Reprogramada o Suspendida no generan conflicto de uso | — |
| Recurso inexistente | `conflictos` | `recursos[].unidad` no está en `unidades` | alta |
| Recurso inactivo asignado | `conflictos` | `activo === false` | media |
| Cuadrilla incompleta | `cuadrillasIncompletas` | Integrantes inexistentes o inactivos (hoy: 7 de 8, 30 referencias) | media |
| Requiere cortada | `requiereCortada` | Campo `requiereCortada` si existe; si no: **sí** con equipo ferroviario; **posible** en tramo faja vía (o zona vías en CHENA/NOS); **nunca** "autorizada" | — |
| Necesidades por actividad | `necesidadesActividad` | Un ítem por recurso asignado + preventiva + cortada + materiales vinculados (`abast.requerimientos.actividad`) | — |
| Fecha límite de gestión | `necesidadesActividad` | `fechaEjecución − plazo` en **días hábiles** del turno. Estado: `vencido`, `hoy`, `pendiente`, `sin_plazo` (plazo no configurado) o `con_respaldo` (preventiva o cortada vinculada) | — |
| Tipo de plazo por recurso | `necesidadesActividad` | personal → `personal`; maquinaria propia → `maquinaria_propia`; arriendo → `maquinaria_arriendo`; equipos → `material` | — |
| Horario | `necesidadesActividad` | 1) horario de la actividad; 2) horario configurado del turno; 3) `faltante` | — |
| Calendario consolidado | `calendarioNecesidades` | Ordenado por urgencia (vencido → hoy → pendiente → sin plazo → con respaldo) y fecha límite; agrega los faltantes con el número de actividades afectadas | — |
| Carga de recursos | `cargaRecursos` | Personas, máquinas y equipos distintos por fecha y turno | — |
| Simulación | `simular` | Operaciones `mover`, `reasignar`, `quitarRecurso` y `agregarRecurso` sobre una **copia**. Devuelve diff (antes → después) y conflictos nuevos, resueltos y persistentes (rango ±1 día por la regla de descanso). Cualquier otra operación se rechaza | — |
| Trisemanal | `resumenTrisemanal` | Semana de la fecha + 2 (lunes→domingo); por día y turno, partida y estado; conflictos; carga; faltantes | — |

## 3. Configuración (`config.mjs`) — todo vacío por defecto

| Parámetro | Ejemplo de valor | Si falta |
|---|---|---|
| `horarios.Diurno` / `Nocturno` | `{ini: '08:00', fin: '20:00'}` | "Horario del turno X no configurado" |
| `plazos.material` | días hábiles | `sin_plazo` + faltante |
| `plazos.maquinaria_propia` / `maquinaria_arriendo` | días hábiles | idem |
| `plazos.transporte`, `personal`, `preventiva`, `cortada` | días hábiles | idem |
| `tiempos.preparacion` / `traslado` / `devolucion` | horas por categoría | `null` en la necesidad |
| `responsables.*` | nombre o rol | `null` |

**Datos que necesito del jefe de terreno:** plazos reales de anticipación (por ejemplo, ¿con cuántos días se pide una cortada a EFE? ¿y un arriendo de camión grúa?), horarios de referencia de cada turno y responsables de coordinación. Las tarjetas de preventivas usan 08:00–20:00 (diurno) y 21:00–05:00 (nocturno), y las cortadas 23:00–05:00. **No** los adopté como horarios de actividad sin tu confirmación.

## 4. Limitaciones conocidas

- La regla de dependencias (predecesoras del Programa) aún no está en el motor; el original la tiene en `Mr` y se portará en Fase 6 con el planificador.
- Los tiempos de traslado entre frentes no tienen datos de origen (no hay distancias ni ubicaciones geográficas); quedan como configuración por categoría.
- `requiereCortada = 'posible'` es una advertencia, no una conclusión: depende del gálibo y del método, que el sistema no conoce.
