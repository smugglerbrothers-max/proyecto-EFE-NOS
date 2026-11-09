#!/usr/bin/env node
/**
 * Quarantine controller for the Orquestador preset — the "companion" the
 * observer refers to.
 *
 * The observer (a DSH plugin) only RECORDS failures in its ledger. This
 * controller ENFORCES them, outside DSH, on a systemd --user timer:
 *
 *   1. Reads the observer ledger (`.omniroute-limit-state.json`).
 *   2. Publishes the active cooldowns to `~/.omniroute/quarantine-state.json`
 *      (the file the observer's guard reads), with canonical keys.
 *   3. Reconciles the OmniRoute `code` combo: models in cooldown are taken out,
 *      and put back when their 5 h expire. Order is always the one in
 *      CODE_COMBO. It only calls `omniroute` when the admitted set CHANGES.
 *
 * Safety rules:
 *   - Never applies an empty combo: if EVERY model is cooling, the full combo is
 *     kept (the observer's guard already refuses to delegate in that case).
 *   - If `combo create` fails, it retries once with the full combo, so the
 *     router is never left without `code`.
 *   - `--dry-run` prints the plan and changes nothing.
 *   - `ORQ_RECONCILE_COMBO=0` publishes the state file but never touches the combo.
 *
 * Usage:  node quarantine-controller.mjs [--dry-run] [--status]
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CODE_COMBO,
  CONTROLLER_STATE_FILE,
  STATE_FILE,
  canonicalLedgerKey,
  canonicalModelKey,
} from '../omniroute-limit-observer.js'

const COMBO_NAME = process.env.ORQ_COMBO_NAME || 'code'
const COMBO_STRATEGY = process.env.ORQ_COMBO_STRATEGY || 'priority'

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJsonAtomic(file, data) {
  mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`)
  renameSync(tmp, file)
}

/**
 * Pure planning step (tested).
 *
 * @param {object} ledger - observer ledger `models` map.
 * @param {number} now
 * @param {Array<{model: string, providerId: string}>} combo
 * @returns {{cooling: object, admitted: Array, allCooling: boolean}}
 */
export function planCombo(ledger, now, combo = CODE_COMBO) {
  const cooling = {}
  for (const [key, entry] of Object.entries(ledger && typeof ledger === 'object' ? ledger : {})) {
    const until = Number(entry?.cooldownUntil)
    if (!(until > now)) continue
    const canonical = canonicalLedgerKey(key, entry)
    // Keep the latest cooldown when two spellings collapse to one key.
    if (cooling[canonical] && cooling[canonical].cooldownUntil >= until) continue
    cooling[canonical] = {
      provider: entry?.provider ?? canonical.split(':')[0],
      model: entry?.model ?? canonical.slice(canonical.indexOf(':') + 1),
      reason: entry?.reason ?? null,
      cooldownUntil: until,
      cooldownUntilIso: new Date(until).toISOString(),
    }
  }
  const admitted = combo.filter(({ model, providerId }) => !cooling[canonicalModelKey(providerId, model)])
  const allCooling = admitted.length === 0
  return { cooling, admitted: allCooling ? [...combo] : admitted, allCooling }
}

/** Stable signature of an admitted list, to detect real changes. */
export function signature(models) {
  return models.map((m) => `${m.providerId}:${m.model}`).join('|')
}

function applyCombo(models) {
  const spec = JSON.stringify(models)
  try {
    execFileSync('omniroute', ['combo', 'delete', COMBO_NAME, '--yes'], { stdio: 'ignore' })
  } catch {
    // It may not exist yet.
  }
  execFileSync('omniroute', ['combo', 'create', COMBO_NAME, '--strategy', COMBO_STRATEGY, '--models', spec], {
    stdio: ['ignore', 'ignore', 'pipe'],
  })
}

function main(argv) {
  const dryRun = argv.includes('--dry-run')
  const statusOnly = argv.includes('--status')
  const reconcile = process.env.ORQ_RECONCILE_COMBO !== '0'
  const now = Date.now()

  const ledger = readJson(STATE_FILE, {})?.models ?? {}
  const previous = readJson(CONTROLLER_STATE_FILE, {})
  const plan = planCombo(ledger, now)
  const wanted = signature(plan.admitted)
  const applied = typeof previous.appliedSignature === 'string' ? previous.appliedSignature : signature(CODE_COMBO)

  const lines = [
    `combo ${COMBO_NAME}: ${plan.admitted.length}/${CODE_COMBO.length} modelos admitidos${plan.allCooling ? ' (TODOS en cuarentena: se mantiene el combo completo)' : ''}`,
    ...CODE_COMBO.map(({ model, providerId }) => {
      const c = plan.cooling[canonicalModelKey(providerId, model)]
      return c
        ? `  ✗ ${providerId}:${model} — cuarentena hasta ${c.cooldownUntilIso} (${c.reason ?? 'sin motivo'})`
        : `  ✓ ${providerId}:${model}`
    }),
  ]
  console.log(lines.join('\n'))
  if (statusOnly) return 0

  const changed = wanted !== applied
  let appliedSignature = applied
  let lastError = previous.lastError ?? null

  if (changed && reconcile && !dryRun) {
    try {
      applyCombo(plan.admitted)
      appliedSignature = wanted
      lastError = null
      console.log(`combo ${COMBO_NAME} reconfigurado`)
    } catch (error) {
      lastError = String(error.stderr || error.message).trim().slice(0, 500)
      console.error(`ERROR: no pude reconfigurar ${COMBO_NAME}: ${lastError}`)
      try {
        applyCombo(CODE_COMBO)
        appliedSignature = signature(CODE_COMBO)
        console.error(`combo ${COMBO_NAME} restaurado completo`)
      } catch (again) {
        console.error(`ERROR GRAVE: el router puede haber quedado sin combo ${COMBO_NAME}; corré scripts/configure-code-combo.sh`)
        writeJsonAtomic(CONTROLLER_STATE_FILE, { ...previous, updatedAt: new Date(now).toISOString(), models: plan.cooling, lastError })
        return 1
      }
    }
  } else if (changed) {
    console.log(dryRun ? '(dry-run) cambiaría el combo' : '(ORQ_RECONCILE_COMBO=0) no toco el combo')
  }

  if (!dryRun) {
    writeJsonAtomic(CONTROLLER_STATE_FILE, {
      updatedAt: new Date(now).toISOString(),
      combo: COMBO_NAME,
      models: plan.cooling,
      admitted: plan.admitted,
      allCooling: plan.allCooling,
      appliedSignature,
      lastError,
    })
  }
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2))
}
