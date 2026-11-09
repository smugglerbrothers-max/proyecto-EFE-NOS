# Publicar UMBRAL como app (Vercel + Supabase)

El juego es una **app web instalable (PWA)**: desde el celular se abre el enlace y se elige
«Agregar a pantalla de inicio» / «Instalar app». Funciona sin conexión y guarda la partida en la nube con Supabase.

## 1. Supabase (base de datos y cuentas)

1. Crea un proyecto en https://supabase.com (plan gratuito).
2. Ve a **SQL Editor → New query**, pega el contenido de
   `supabase/migrations/20261109000000_partidas.sql` y pulsa **Run**.
   Crea la tabla `partidas` (una partida por jugador, protegida con RLS) y la función del ranking.
3. **Authentication → Sign In / Providers**:
   - Activa **Email** (enlace mágico, viene activo por defecto).
   - Activa **Allow anonymous sign-ins** para el botón «Entrar como invitado».
4. **Project Settings → API**: copia la **Project URL** y la **anon public key**.

## 2. Vercel (publicación)

1. En https://vercel.com → **Add New → Project** → importa el repositorio de GitHub
   `smugglerbrothers-max/proyecto-EFE-NOS` (rama que quieras publicar).
2. Framework preset: **Other**. No cambies nada más: `vercel.json` ya define el build.
3. En **Environment Variables** agrega:
   - `SUPABASE_URL` = la Project URL
   - `SUPABASE_ANON_KEY` = la anon public key
4. **Deploy**. Te dará una dirección como `https://umbral.vercel.app`.

## 3. Conectar ambos

En Supabase → **Authentication → URL Configuration**:
- **Site URL**: tu dirección de Vercel (p. ej. `https://umbral.vercel.app`).
- **Redirect URLs**: agrega `https://umbral.vercel.app/**`.

Listo. En el juego aparecerá **☁ Cuenta en la nube** en el título y **☁ Nube y ranking** en el menú.

## Notas

- Sin las variables de Supabase el juego funciona igual, solo con guardado local.
- La anon key es pública por diseño; la seguridad la dan las políticas RLS (cada jugador solo ve su partida).
- El ranking muestra solo alias, número de criaturas selladas y si venció al jefe; el servidor calcula esos valores.
- Tras agregar ilustraciones nuevas: `python3 tools/empaquetar_sprites.py` y sube los cambios; Vercel redepliega solo.
  Si cambias archivos del juego, sube también el número de `CACHE` en `sw.js` para que los celulares se actualicen.
