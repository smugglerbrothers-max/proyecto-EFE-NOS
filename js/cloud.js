// =====================================================================
//  UMBRAL — Nube (Supabase): cuenta, guardado sincronizado y ranking.
//  Si no hay configuración o no hay conexión, el juego sigue con
//  guardado local sin errores.
// =====================================================================
'use strict';

const Cloud = (() => {
  let sb = null, user = null, alias = null;
  let pending = null, timer = null;
  const listeners = [];

  function configured() {
    const c = window.UMBRAL_CONFIG || {};
    return !!(c.supabaseUrl && c.supabaseAnonKey && window.supabase && window.supabase.createClient);
  }

  async function init() {
    if (!configured()) return false;
    try {
      const c = window.UMBRAL_CONFIG;
      sb = window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      const { data } = await sb.auth.getSession();
      user = data.session ? data.session.user : null;
      sb.auth.onAuthStateChange((_e, session) => {
        user = session ? session.user : null;
        listeners.forEach(f => f(user));
      });
      if (user) await fetchAlias();
      return true;
    } catch (e) { console.warn('Nube no disponible', e); sb = null; return false; }
  }

  async function fetchAlias() {
    try {
      const { data } = await sb.from('partidas').select('alias').eq('user_id', user.id).maybeSingle();
      alias = data ? data.alias : null;
    } catch (e) { }
  }

  function cleanAlias(a) {
    return String(a || '').replace(/[^\p{L}\p{N} _\-.]/gu, '').trim().slice(0, 24) || 'Sellador';
  }

  async function loginEmail(email) {
    if (!sb) throw new Error('La nube no está configurada.');
    const redirect = location.origin + location.pathname;
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
    if (error) throw error;
  }

  async function loginAnon() {
    if (!sb) throw new Error('La nube no está configurada.');
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) throw error;
    user = data.user;
  }

  async function logout() { if (sb) await sb.auth.signOut(); user = null; alias = null; }

  async function save(data, newAlias) {
    if (!sb || !user) return false;
    if (newAlias) alias = cleanAlias(newAlias);
    const row = { user_id: user.id, datos: data, alias: alias || 'Sellador' };
    const { error } = await sb.from('partidas').upsert(row, { onConflict: 'user_id' });
    if (error) { console.warn('Error al guardar en la nube', error); return false; }
    return true;
  }

  // Guardado diferido: agrupa varios guardados seguidos en uno.
  function saveSoon(data) {
    if (!sb || !user) return;
    pending = data;
    clearTimeout(timer);
    timer = setTimeout(() => { const d = pending; pending = null; save(d); }, 1500);
  }

  async function setAlias(a) {
    if (!sb || !user) return false;
    alias = cleanAlias(a);
    const { data, error } = await sb.from('partidas').update({ alias }).eq('user_id', user.id).select('user_id');
    if (error) throw error;
    if (!data || !data.length) {
      const r = await sb.from('partidas').insert({ user_id: user.id, alias, datos: { party: [], dex: { seen: [], caught: [] }, flags: {} } });
      if (r.error) throw r.error;
    }
    return true;
  }

  async function load() {
    if (!sb || !user) return null;
    const { data, error } = await sb.from('partidas').select('datos, alias, actualizado').eq('user_id', user.id).maybeSingle();
    if (error) { console.warn(error); return null; }
    if (data) alias = data.alias;
    return data;
  }

  async function ranking(n = 20) {
    if (!sb) return [];
    const { data, error } = await sb.rpc('ranking_bestiario', { limite: n });
    if (error) { console.warn(error); return []; }
    return data || [];
  }

  return {
    init, loginEmail, loginAnon, logout, save, saveSoon, load, ranking, cleanAlias, setAlias,
    get enabled() { return !!sb; },
    get user() { return user; },
    get alias() { return alias; },
    onChange(f) { listeners.push(f); },
  };
})();
