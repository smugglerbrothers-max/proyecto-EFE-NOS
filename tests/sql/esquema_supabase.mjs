// Prueba del esquema Supabase en Postgres local (PGlite) con un auth simulado. Uso: npm run test:sql
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db = new PGlite();
// Simulación mínima de Supabase: roles, auth.users, auth.uid() y privilegios por defecto de public.
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
await db.exec(readFileSync(process.argv[2], 'utf8'));
const U = { jefe: '11111111-1111-1111-1111-111111111111', plan: '22222222-2222-2222-2222-222222222222',
  cons: '33333333-3333-3333-3333-333333333333', sin: '44444444-4444-4444-4444-444444444444' };
await db.exec(`insert into auth.users values ${Object.values(U).map((u) => `('${u}')`).join(',')};
  insert into public.perfiles (id, nombre, rol) values ('${U.jefe}','Jefe','jefe_terreno'),('${U.plan}','Plan','planificador'),('${U.cons}','Cons','consulta');`);

let ok = 0, fallos = 0;
const como = async (rol, uid, sql) => {
  await db.exec(`reset role; set request.jwt.claim.sub = '${uid ?? ''}'; set role ${rol};`);
  try { return { r: await db.query(sql) }; } catch (e) { return { e: e.message }; } finally { await db.exec('reset role;'); }
};
const check = (nombre, cond, info) => { cond ? ok++ : fallos++; console.log(`${cond ? 'OK  ' : 'FALLA'} ${nombre}${cond ? '' : ' → ' + JSON.stringify(info)}`); };
const plan = `'{"actividades":[]}'::jsonb`;

let x = await como('anon', null, 'select * from public.planes'); check('anon no puede leer planes', x.e, x);
x = await como('authenticated', U.sin, `select public.guardar_plan('lmt',0,${plan})`); check('usuario sin perfil no guarda', /sin_permiso/.test(x.e), x);
x = await como('authenticated', U.cons, `select public.guardar_plan('lmt',0,${plan})`); check('consulta no guarda', /sin_permiso/.test(x.e), x);
x = await como('authenticated', U.plan, `select public.guardar_plan('lmt',0,${plan}) as r`); check('planificador crea plan rev 1', x.r?.rows[0].r === 1, x);
x = await como('authenticated', U.plan, `select public.guardar_plan('lmt',1,${plan}) as r`); check('guardado con revisión correcta → 2', x.r?.rows[0].r === 2, x);
x = await como('authenticated', U.jefe, `select public.guardar_plan('lmt',1,${plan}) as r`); check('revisión desactualizada → conflicto (no sobrescribe)', /conflicto_revision/.test(x.e), x);
x = await como('authenticated', U.cons, 'select id, revision from public.planes'); check('consulta lee el plan', x.r?.rows.length === 1 && x.r.rows[0].revision === 2, x);
x = await como('authenticated', U.sin, 'select id from public.planes'); check('sin perfil no ve el plan', x.r?.rows.length === 0, x);
x = await como('authenticated', U.plan, `update public.planes set revision = 99 returning id`); check('update directo de planes bloqueado por RLS', x.r?.rows.length === 0, x);

const prop = (autor) => `insert into public.propuestas (plan_id, titulo, nivel, autor_tipo, autor_usuario, autor_ia, cambios, base_revision)
  values ('lmt','Mover L3',2,'ia','${autor}','{"proveedor":"claude"}','[]',2) returning id`;
x = await como('authenticated', U.plan, prop(U.jefe)); check('no se crea propuesta a nombre de otro', /row-level security/.test(x.e ?? ''), x);
x = await como('authenticated', U.cons, prop(U.cons)); check('consulta no crea propuestas', /row-level security/.test(x.e ?? ''), x);
x = await como('authenticated', U.plan, prop(U.plan)); check('planificador crea propuesta', x.r?.rows.length === 1, x);
const pid = x.r?.rows[0].id;
x = await como('authenticated', U.plan, `update public.propuestas set estado='aprobada' where id='${pid}' returning id`); check('autoaprobación directa bloqueada', x.r?.rows.length === 0, x);
x = await como('authenticated', U.plan, `select public.decidir_propuesta('${pid}', true)`); check('planificador no puede aprobar', /solo_jefe_terreno/.test(x.e), x);
x = await como('authenticated', U.jefe, `select public.decidir_propuesta('${pid}', true) as r`); check('jefe aprueba', x.r?.rows[0].r === 'aprobada', x);
x = await como('authenticated', U.jefe, `select public.decidir_propuesta('${pid}', false)`); check('no se decide dos veces', /propuesta_no_pendiente/.test(x.e), x);

x = await como('authenticated', U.jefe, 'select accion from public.auditoria order by id'); check('auditoría registra guardados y decisión', x.r?.rows.map((r) => r.accion).join() === 'plan.guardado,plan.guardado,propuesta.aprobada', x);
x = await como('authenticated', U.jefe, `update public.auditoria set resultado='x'`); check('auditoría: update bloqueado', /solo agregado|row-level/.test(x.e ?? '') || x.r?.affectedRows === 0, x);
x = await como('authenticated', U.jefe, `delete from public.auditoria`); check('auditoría: delete bloqueado', /solo agregado/.test(x.e ?? '') || x.r?.affectedRows === 0, x);
x = await como('authenticated', U.jefe, `truncate public.auditoria`); check('auditoría: truncate bloqueado', /permission denied/.test(x.e ?? ''), x);
try { await db.exec(`delete from public.auditoria`); check('auditoría: ni el superusuario borra', false, 'borró'); } catch (e) { check('auditoría: ni el superusuario borra', /solo agregado/.test(e.message), e.message); }
x = await como('authenticated', U.plan, `insert into public.auditoria (actor_tipo, actor_id, accion) values ('humano','${U.jefe}','falso') returning id`); check('no se registra auditoría a nombre de otro', /row-level security/.test(x.e ?? ''), x);
x = await como('authenticated', U.plan, `update public.perfiles set rol='jefe_terreno' where id='${U.plan}' returning id`); check('planificador no se autopromueve', x.r?.rows.length === 0, x);
console.log(`\n${ok} OK, ${fallos} fallas`); process.exit(fallos ? 1 : 0);
