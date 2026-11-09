/**
 * OmniRoute limit observer for the Orquestador preset.
 *
 * OmniRoute already records request metadata in SQLite, but the raw history is
 * hard to scan when a free provider starts returning 429/404/5xx. This plugin
 * keeps a small JSONL audit stream and a durable per-model quarantine ledger.
 * It never retries a failed model itself: the companion quarantine controller
 * handles combo admission, while this file preserves the evidence needed to
 * understand the otherwise undocumented limits.
 *
 * Quarantine policy: rate limits/quotas, unavailable models, timeouts, 5xx and
 * empty 200s put the model in a 5 h cooldown. A plain 4xx (`request_error`) is
 * logged but NOT quarantined: it is usually the request's fault (context too
 * long, bad schema), and benching a healthy model for 5 h over it starves the
 * combo for nothing.
 *
 * @module omniroute-limit-observer
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const name = 'omniroute-limit-observer'
export const inject = ['tools']

const HOME = os.homedir()
const DB_FILE = path.join(HOME, '.omniroute', 'storage.sqlite')
const LOG_DIR = path.join(HOME, '.dsh', 'logs')
const EVENT_LOG = path.join(LOG_DIR, 'omniroute-limit-events.jsonl')
/** Rotate the event log past this size (one `.1` generation is kept). */
const EVENT_LOG_MAX_BYTES = 5 * 1024 * 1024
const STATE_FILE = path.join(HOME, '.dsh', '.agent-presets', 'orchestrator', '.omniroute-limit-state.json')
const CONTROLLER_STATE_FILE = path.join(HOME, '.omniroute', 'quarantine-state.json')
const COOLDOWN_MS = 5 * 60 * 60 * 1000
const MAX_ROWS_PER_TICK = 500
const POLL_MS = 15_000
const TARGET_PROVIDERS = new Set(['openrouter', 'gemini', 'ocwrap'])
const RELEVANT_TOOLS = new Set(['omniroute_code'])
/** Reasons that do NOT bench a model (see module doc). */
const NON_QUARANTINE_REASONS = new Set(['request_error'])

/**
 * The `code` combo, in priority order. MUST match `omniroute-code-combo.json`
 * at the bundle root (a test enforces it). Only used to decide whether the
 * whole combo is cooling down.
 */
export const CODE_COMBO = [
  { model: 'ocwrap/big-pickle', providerId: 'ocwrap' },
  { model: 'ocwrap/longcat-2.5-preview-free', providerId: 'ocwrap' },
  { model: 'cohere/north-mini-code:free', providerId: 'openrouter' },
  { model: 'nex-agi/nex-n2.5-pro:free', providerId: 'openrouter' },
  { model: 'gemini/gemini-flash-lite-latest', providerId: 'gemini' },
]

let DatabaseSync
try {
  ({ DatabaseSync } = await import('node:sqlite'))
} catch {
  // DSH normally runs on Node 24. The warning below makes an older runtime
  // visible instead of silently pretending that the observer is active.
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function resultText(result) {
  if (result === undefined || result === null) return ''
  if (Array.isArray(result.content)) {
    return result.content
      .map((block) => (block?.type === 'text' ? block.text : ''))
      .join('\n')
  }
  if (typeof result.value === 'string') return result.value
  return ''
}

function compact(value, max = 500) {
  return String(value ?? '').replace(/\s+/g, ' ').slice(0, max)
}

/** @returns {string|null} failure class of one call_logs row, or null on success. */
export function classify(row) {
  const status = Number(row.status) || 0
  const text = `${row.error_summary ?? ''} ${row.error_type ?? ''}`
  if (status === 429 || /rate.?limit|too many requests|quota|daily limit|free-models-per-day/i.test(text)) {
    return 'rate_limit_or_quota'
  }
  if (status === 404 || /model.*not found|not found|unavailable/i.test(text)) return 'model_unavailable'
  if (/timeout|timed out|deadline/i.test(text)) return 'timeout'
  if (status >= 500 || /upstream|server error|bad gateway/i.test(text)) return 'provider_error'
  if (status >= 400) return 'request_error'
  return null
}

export function providerOf(row) {
  const requested = String(row.requested_model ?? '').toLowerCase()
  if (requested.startsWith('ocwrap/')) return 'ocwrap'
  if (requested.startsWith('gemini/')) return 'gemini'
  if (requested.startsWith('openrouter/')) return 'openrouter'
  return String(row.provider ?? '').toLowerCase()
}

/**
 * Canonical `provider:model` key. The ledgers in the wild mix spellings —
 * `openrouter:openrouter/nex-agi/…`, `openrouter:cohere/…`, `ocwrap:ocwrap/big-pickle`,
 * `ocwrap:big-pickle` — so every key is reduced to provider + model without a
 * redundant `provider/` prefix before it is compared.
 *
 * @param {string} provider
 * @param {string} model
 */
export function canonicalModelKey(provider, model) {
  const p = String(provider ?? '').toLowerCase()
  let m = String(model ?? '').toLowerCase()
  if (p !== '' && m.startsWith(`${p}/`)) m = m.slice(p.length + 1)
  return `${p}:${m}`
}

/** Canonicalize a stored ledger key (`provider:model`, model may contain `:`). */
export function canonicalLedgerKey(key, entry) {
  if (entry && typeof entry === 'object' && entry.provider && entry.model) {
    return canonicalModelKey(entry.provider, entry.model)
  }
  const raw = String(key)
  const colon = raw.indexOf(':')
  const slash = raw.indexOf('/')
  // `provider:` prefix only when the first ':' comes before any '/'.
  if (colon > 0 && (slash < 0 || colon < slash)) {
    return canonicalModelKey(raw.slice(0, colon), raw.slice(colon + 1))
  }
  return canonicalModelKey('', raw)
}

/**
 * True when every model of the combo has an active cooldown in any of the
 * given ledgers (`{ [key]: { cooldownUntil } }`).
 */
export function comboFullyCooling(ledgers, now, combo = CODE_COMBO) {
  const cooling = new Set()
  for (const ledger of ledgers) {
    if (!ledger || typeof ledger !== 'object') continue
    for (const [key, entry] of Object.entries(ledger)) {
      if (Number(entry?.cooldownUntil) > now) cooling.add(canonicalLedgerKey(key, entry))
    }
  }
  return combo.every(({ model, providerId }) => cooling.has(canonicalModelKey(providerId, model)))
}

function qualityFailure(row) {
  if (Number(row.status) !== 200 || Number(row.has_response_body) !== 1 || !row.artifact_relpath) return null
  const file = path.join(HOME, '.omniroute', 'call_logs', row.artifact_relpath)
  if (!existsSync(file)) return null
  try {
    const payload = JSON.parse(readFileSync(file, 'utf8'))
    const choice = payload.responseBody?.choices?.[0]
    if (choice) {
      const message = choice.message ?? choice.delta ?? {}
      const content = typeof message.content === 'string' ? message.content.trim() : ''
      if (!content && !Array.isArray(message.tool_calls)) return 'quality_failure: empty assistant content'
    }
    const candidate = payload.responseBody?.candidates?.[0]
    if (candidate) {
      const visible = (candidate.content?.parts ?? []).some((part) => part?.text && part.thought !== true)
      if (!visible) return 'quality_failure: no visible assistant content'
    }
  } catch {
    return null
  }
  return null
}

function isRelevant(row) {
  const provider = providerOf(row)
  const combo = String(row.combo_name ?? '').toLowerCase()
  return combo === 'code' || combo === 'free' || TARGET_PROVIDERS.has(provider)
}

function ensureState(state) {
  if (!state || typeof state !== 'object') state = {}
  if (!state.models || typeof state.models !== 'object') state.models = {}
  if (!Number.isFinite(state.lastRowid)) state.lastRowid = 0
  return state
}

/** @param {object} ctx */
export function apply(ctx) {
  const state = ensureState(readJson(STATE_FILE, {}))
  const guarded = new WeakSet()
  let collecting = false
  let warnedNoSqlite = false
  let dirty = true

  function persist() {
    if (!dirty) return
    try {
      mkdirSync(path.dirname(STATE_FILE), { recursive: true })
      // Atomic replace: a crash mid-write must not leave a truncated ledger.
      const tmp = `${STATE_FILE}.${process.pid}.tmp`
      writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`)
      renameSync(tmp, STATE_FILE)
      dirty = false
    } catch (error) {
      ctx.logger?.warn?.(`omniroute-limit-observer: no pude guardar estado: ${error.message}`)
    }
  }

  function event(entry) {
    try {
      mkdirSync(LOG_DIR, { recursive: true })
      try {
        if (statSync(EVENT_LOG).size > EVENT_LOG_MAX_BYTES) renameSync(EVENT_LOG, `${EVENT_LOG}.1`)
      } catch {
        // No log yet.
      }
      appendFileSync(EVENT_LOG, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`)
    } catch (error) {
      ctx.logger?.warn?.(`omniroute-limit-observer: no pude guardar log: ${error.message}`)
    }
  }

  function quarantine(row, reason) {
    const provider = providerOf(row) || 'unknown'
    const model = String(row.model ?? row.requested_model ?? 'unknown')
    const key = canonicalModelKey(provider, model)
    const now = Date.now()
    const previous = state.models[key]
    const active = previous && Number(previous.cooldownUntil) > now
    const cooldownUntil = active ? previous.cooldownUntil : now + COOLDOWN_MS
    state.models[key] = {
      provider,
      model,
      firstErrorAt: previous?.firstErrorAt ?? new Date(now).toISOString(),
      lastErrorAt: new Date(now).toISOString(),
      errorCount: Number(previous?.errorCount ?? 0) + 1,
      reason,
      cooldownUntil,
      cooldownUntilIso: new Date(cooldownUntil).toISOString(),
    }
    dirty = true
    event({
      action: active ? 'error_during_cooldown' : 'quarantine',
      provider,
      model,
      status: row.status ?? null,
      reason,
      cooldownUntil: new Date(cooldownUntil).toISOString(),
      correlationId: row.correlation_id ?? null,
    })
    if (!active) {
      ctx.logger?.warn?.(
        `omniroute-limit-observer: ${provider}/${model} en cuarentena por 5h (${reason}); hasta ${new Date(cooldownUntil).toISOString()}`,
      )
    }
  }

  function collect() {
    if (collecting || !DatabaseSync) {
      if (!DatabaseSync && !warnedNoSqlite) {
        warnedNoSqlite = true
        ctx.logger?.warn?.('omniroute-limit-observer: este Node no expone node:sqlite; no habrá telemetría de límites')
      }
      return
    }
    collecting = true
    let db
    try {
      db = new DatabaseSync(DB_FILE, { readOnly: true })
      // The DB may have been recreated (reinstall, manual cleanup): rowids
      // restart, and a stale high-water mark would hide every new row forever.
      const maxRowid = Number(db.prepare('SELECT MAX(rowid) AS m FROM call_logs').get()?.m ?? 0)
      if (maxRowid < state.lastRowid) {
        event({ action: 'rowid_reset', previous: state.lastRowid, current: maxRowid })
        state.lastRowid = 0
        dirty = true
      }
      const rows = db.prepare(`
        SELECT rowid, timestamp, status, model, requested_model, provider,
               combo_name, error_summary, error_type, correlation_id,
               duration, tokens_in, tokens_out, tokens_reasoning,
               artifact_relpath, has_response_body
        FROM call_logs
        WHERE rowid > ?
        ORDER BY rowid ASC
        LIMIT ${MAX_ROWS_PER_TICK}
      `).all(state.lastRowid)
      for (const row of rows) {
        state.lastRowid = Number(row.rowid)
        dirty = true
        if (!isRelevant(row)) continue
        const reason = classify(row) ?? qualityFailure(row)
        const benched = reason !== null && !NON_QUARANTINE_REASONS.has(reason)
        event({
          action: reason ? 'observed_error' : 'success',
          timestamp: row.timestamp ?? null,
          provider: providerOf(row),
          model: row.model ?? row.requested_model ?? null,
          requestedModel: row.requested_model ?? null,
          combo: row.combo_name ?? null,
          status: row.status ?? null,
          reason,
          quarantined: benched,
          durationMs: row.duration ?? null,
          tokensIn: row.tokens_in ?? null,
          tokensOut: row.tokens_out ?? null,
          tokensReasoning: row.tokens_reasoning ?? null,
          correlationId: row.correlation_id ?? null,
          error: compact(row.error_summary),
        })
        if (benched) quarantine(row, reason)
      }
      persist()
    } catch (error) {
      if (!String(error.message).includes('no such table')) {
        ctx.logger?.warn?.(`omniroute-limit-observer: lectura de SQLite falló: ${error.message}`)
      }
    } finally {
      try { db?.close() } catch {}
      collecting = false
    }
  }

  function guardAgent(agent) {
    if (!agent || guarded.has(agent)) return
    guarded.add(agent)
    try {
      agent.ctx.inject(['tools'], (scope) => {
        scope.tools.guard((execution) => {
          if (execution.name !== 'omniroute_code') return undefined
          // Both ledgers count: the controller's (authoritative for admission)
          // and ours (which the controller may not have caught up with yet).
          const controller = readJson(CONTROLLER_STATE_FILE, {})?.models
          if (comboFullyCooling([controller, state.models], Date.now())) {
            return 'Todos los modelos del combo code están en cuarentena. Espera a que venza una cuarentena de 5 horas; no fuerces reintentos.'
          }
          return undefined
        })
      })
    } catch (error) {
      ctx.logger?.warn?.(`omniroute-limit-observer: no pude instalar guard: ${error.message}`)
    }
  }

  ctx.on?.('tools/result', (call, result) => {
    const tool = call?.toolName ?? call?.name
    if (RELEVANT_TOOLS.has(tool) || resultText(result).includes('subagent-')) collect()
  })

  ctx.on?.('agent/created', ({ agent }) => guardAgent(agent))
  ctx.on?.('agent/session-start', ({ agent }) => guardAgent(agent))
  ctx.on?.('agent/pre-step', ({ agent }, next) => {
    guardAgent(agent)
    return next()
  })

  // Bounded polling cadence while a preset session is alive. Registered as an
  // effect when the host supports it, so a plugin reload does not leak timers.
  const startTimer = () => {
    const timer = setInterval(collect, POLL_MS)
    timer.unref?.()
    return () => clearInterval(timer)
  }
  if (typeof ctx.effect === 'function') ctx.effect(startTimer, 'omniroute-limit-observer: interval')
  else startTimer()
  collect()
  persist()
}
