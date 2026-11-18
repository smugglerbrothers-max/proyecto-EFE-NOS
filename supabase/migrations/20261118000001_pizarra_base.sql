-- Pizarra Operativa Inteligente 2.0 — esquema base (Fase 10/11, adelantado por Vercel + Supabase)
-- PENDIENTE DE REVISIÓN: no aplicado. Ver MODELO_DATOS.md y SEGURIDAD_Y_AUTORIZACIONES.md.
--
-- Principios:
--  * RLS activo en todas las tablas; sin acceso anónimo.
--  * El plan se guarda como JSON completo (mismo formato que el HTML) con número de revisión:
--    compatibilidad total con la pizarra original y control de conflictos sin sobrescritura silenciosa.
--  * La IA NUNCA escribe el plan: solo crea propuestas. Aprobar es exclusivo del rol jefe_terreno.
--  * Auditoría de solo agregado: no se puede editar ni borrar (ni siquiera con permisos de tabla).

-- ───────────────────────── Roles de aplicación ─────────────────────────
create type public.rol_pizarra as enum ('jefe_terreno', 'planificador', 'consulta');

create table public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null,
  rol         public.rol_pizarra not null default 'consulta',
  creado_en   timestamptz not null default now()
);
comment on table public.perfiles is 'Usuarios de la pizarra y su rol. Lo asigna un jefe_terreno.';

-- Rol del usuario actual. SECURITY DEFINER con search_path fijo para evitar recursión de RLS.
create function public.rol_actual() returns public.rol_pizarra
language sql stable security definer set search_path = '' as $$
  select rol from public.perfiles where id = (select auth.uid())
$$;
revoke all on function public.rol_actual() from public;
grant execute on function public.rol_actual() to authenticated;

-- ───────────────────────── Plan (copia de trabajo) ─────────────────────────
create table public.planes (
  id               text primary key,                -- p.ej. 'lmt' (un plan por pizarra)
  datos            jsonb not null,                  -- mismo JSON que window.__PLAN_INICIAL
  revision         integer not null default 1 check (revision > 0),
  actualizado_por  uuid references auth.users (id),
  actualizado_en   timestamptz not null default now()
);
comment on column public.planes.revision is 'Se incrementa en cada guardado; guardar_plan() rechaza revisiones desactualizadas.';

-- ───────────────────────── Propuestas (ChangeSets) ─────────────────────────
create type public.estado_propuesta as enum ('propuesta', 'aprobada', 'aplicada', 'rechazada', 'revertida');
create type public.tipo_actor as enum ('humano', 'ia', 'sistema');

create table public.propuestas (
  id              uuid primary key default gen_random_uuid(),
  plan_id         text not null references public.planes (id),
  titulo          text not null,
  motivo          text,
  nivel           smallint not null check (nivel in (2, 3)),
  autor_tipo      public.tipo_actor not null,
  autor_usuario   uuid references auth.users (id),
  autor_ia        jsonb,                            -- {proveedor, modelo} cuando autor_tipo = 'ia'
  cambios         jsonb not null,                   -- [{entidad, id, campo, antes, despues}]
  simulacion      jsonb,                            -- conflictos nuevos/resueltos del motor
  base_revision   integer not null,
  estado          public.estado_propuesta not null default 'propuesta',
  decidido_por    uuid references auth.users (id),
  decidido_en     timestamptz,
  comentario      text,
  creado_en       timestamptz not null default now()
);
create index propuestas_plan_estado on public.propuestas (plan_id, estado);

-- ───────────────────────── Auditoría (solo agregado) ─────────────────────────
create table public.auditoria (
  id             bigint generated always as identity primary key,
  ts             timestamptz not null default now(),
  actor_tipo     public.tipo_actor not null,
  actor_id       text,                              -- uuid de usuario o 'claude/claude-opus-5-5'
  accion         text not null,                     -- 'plan.guardado', 'propuesta.aprobada', 'ia.llamada', ...
  entidad        text,
  ids            text[],
  antes          jsonb,
  despues        jsonb,
  propuesta_id   uuid references public.propuestas (id),
  revision       integer,
  resultado      text
);
create index auditoria_ts on public.auditoria (ts desc);

create function public.auditoria_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'La auditoría es de solo agregado: % no permitido', tg_op;
end $$;
create trigger auditoria_sin_update_delete
  before update or delete on public.auditoria
  for each row execute function public.auditoria_inmutable();
-- TRUNCATE no dispara triggers de fila: se revoca explícitamente.
revoke truncate on public.auditoria from anon, authenticated;

-- ───────────────────────── Guardado con control de concurrencia ─────────────────────────
-- Guarda el plan solo si base_revision coincide con la revisión actual. Si no, error 'conflicto_revision'
-- y el cliente debe mostrar el conflicto (nunca sobrescribe en silencio).
create function public.guardar_plan(p_id text, p_base_revision integer, p_datos jsonb)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_rol public.rol_pizarra := public.rol_actual();
  v_rev integer;
begin
  if v_rol is null or v_rol = 'consulta' then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;

  select revision into v_rev from public.planes where id = p_id for update;
  if v_rev is null then
    if p_base_revision <> 0 then
      raise exception 'conflicto_revision' using errcode = '40001', detail = 'El plan no existe; base_revision debe ser 0.';
    end if;
    insert into public.planes (id, datos, revision, actualizado_por) values (p_id, p_datos, 1, (select auth.uid()));
    v_rev := 1;
  elsif v_rev <> p_base_revision then
    raise exception 'conflicto_revision' using errcode = '40001',
      detail = format('Revisión actual %s, recibida %s.', v_rev, p_base_revision);
  else
    v_rev := v_rev + 1;
    update public.planes
       set datos = p_datos, revision = v_rev, actualizado_por = (select auth.uid()), actualizado_en = now()
     where id = p_id;
  end if;

  insert into public.auditoria (actor_tipo, actor_id, accion, entidad, ids, revision, resultado)
  values ('humano', (select auth.uid())::text, 'plan.guardado', 'plan', array[p_id], v_rev, 'ok');
  return v_rev;
end $$;
revoke all on function public.guardar_plan(text, integer, jsonb) from public;
grant execute on function public.guardar_plan(text, integer, jsonb) to authenticated;

-- Decidir una propuesta: solo jefe_terreno. Aplicar los cambios lo hace el navegador después (con las
-- acciones del store original) y guarda con guardar_plan(); aquí solo se registra la decisión.
create function public.decidir_propuesta(p_id uuid, p_aprobar boolean, p_comentario text default null)
returns public.estado_propuesta
language plpgsql security definer set search_path = '' as $$
declare
  v_estado public.estado_propuesta;
begin
  if public.rol_actual() is distinct from 'jefe_terreno' then
    raise exception 'solo_jefe_terreno' using errcode = '42501';
  end if;
  update public.propuestas
     set estado = case when p_aprobar then 'aprobada'::public.estado_propuesta else 'rechazada'::public.estado_propuesta end,
         decidido_por = (select auth.uid()), decidido_en = now(), comentario = p_comentario
   where id = p_id and estado = 'propuesta'
  returning estado into v_estado;
  if v_estado is null then
    raise exception 'propuesta_no_pendiente' using errcode = 'P0002';
  end if;
  insert into public.auditoria (actor_tipo, actor_id, accion, entidad, ids, propuesta_id, resultado)
  values ('humano', (select auth.uid())::text, 'propuesta.' || v_estado::text, 'propuesta', array[p_id::text], p_id, 'ok');
  return v_estado;
end $$;
revoke all on function public.decidir_propuesta(uuid, boolean, text) from public;
grant execute on function public.decidir_propuesta(uuid, boolean, text) to authenticated;

-- ───────────────────────── RLS ─────────────────────────
alter table public.perfiles   enable row level security;
alter table public.planes     enable row level security;
alter table public.propuestas enable row level security;
alter table public.auditoria  enable row level security;

-- perfiles: cada uno ve el suyo; el jefe ve y administra todos.
create policy perfiles_ver on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or (select public.rol_actual()) = 'jefe_terreno');
create policy perfiles_admin on public.perfiles for all to authenticated
  using ((select public.rol_actual()) = 'jefe_terreno')
  with check ((select public.rol_actual()) = 'jefe_terreno');

-- planes: lectura para cualquier usuario con perfil; escritura SOLO vía guardar_plan().
create policy planes_ver on public.planes for select to authenticated
  using ((select public.rol_actual()) is not null);

-- propuestas: ver con perfil; crear como planificador o jefe (la IA crea a nombre del usuario que la invoca);
-- decidir SOLO vía decidir_propuesta(). Sin update/delete directos.
create policy propuestas_ver on public.propuestas for select to authenticated
  using ((select public.rol_actual()) is not null);
create policy propuestas_crear on public.propuestas for insert to authenticated
  with check (
    (select public.rol_actual()) in ('jefe_terreno', 'planificador')
    and estado = 'propuesta'
    and autor_usuario = (select auth.uid())
  );

-- auditoría: ver con perfil; insertar solo eventos propios. Update/delete bloqueados por trigger.
create policy auditoria_ver on public.auditoria for select to authenticated
  using ((select public.rol_actual()) is not null);
create policy auditoria_agregar on public.auditoria for insert to authenticated
  with check (
    (select public.rol_actual()) is not null
    and (actor_id = (select auth.uid())::text or actor_tipo = 'ia')
  );

-- Sin acceso anónimo a nada.
revoke all on public.perfiles, public.planes, public.propuestas, public.auditoria from anon;
