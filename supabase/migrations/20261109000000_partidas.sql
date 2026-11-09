-- UMBRAL — guardado en la nube y ranking del bestiario.
-- Ejecuta este script en Supabase: SQL Editor -> New query -> Run.

create table if not exists public.partidas (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  alias       text not null default 'Sellador' check (char_length(alias) between 1 and 24),
  datos       jsonb not null,
  sellados    integer not null default 0 check (sellados between 0 and 200),
  campeon     boolean not null default false,
  actualizado timestamptz not null default now()
);

alter table public.partidas enable row level security;

-- Cada jugador solo puede leer y escribir SU partida.
drop policy if exists "leer mi partida" on public.partidas;
create policy "leer mi partida" on public.partidas
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "crear mi partida" on public.partidas;
create policy "crear mi partida" on public.partidas
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "actualizar mi partida" on public.partidas;
create policy "actualizar mi partida" on public.partidas
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "borrar mi partida" on public.partidas;
create policy "borrar mi partida" on public.partidas
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Ranking público: solo expone alias, sellados y si venció al jefe (nunca la partida completa).
create or replace function public.ranking_bestiario(limite integer default 20)
returns table (alias text, sellados integer, campeon boolean, actualizado timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.alias, p.sellados, p.campeon, p.actualizado
  from public.partidas p
  order by p.sellados desc, p.campeon desc, p.actualizado asc
  limit least(greatest(limite, 1), 100);
$$;

revoke all on function public.ranking_bestiario(integer) from public;
grant execute on function public.ranking_bestiario(integer) to anon, authenticated;

-- El servidor calcula "sellados" a partir de la partida guardada (no confía en el cliente).
create or replace function public.partidas_calcular()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.sellados := least(coalesce(jsonb_array_length(new.datos -> 'dex' -> 'caught'), 0), 102);
  new.campeon := coalesce((new.datos -> 'flags' ->> 'champion')::boolean, false);
  new.actualizado := now();
  return new;
end;
$$;

drop trigger if exists partidas_calcular on public.partidas;
create trigger partidas_calcular
  before insert or update on public.partidas
  for each row execute function public.partidas_calcular();
