import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planCombo, signature } from '../orchestrator/bin/quarantine-controller.mjs'
import { CODE_COMBO } from '../orchestrator/omniroute-limit-observer.js'

const now = 1_000_000
const hot = (extra = {}) => ({ cooldownUntil: now + 1000, reason: 'rate_limit_or_quota', ...extra })

test('no cooldowns: full combo, in order', () => {
  const plan = planCombo({}, now)
  assert.deepEqual(plan.admitted, CODE_COMBO)
  assert.equal(plan.allCooling, false)
})

test('cooling models are removed, order kept, any key spelling', () => {
  const plan = planCombo({
    'ocwrap:ocwrap/big-pickle': hot(),
    'openrouter:openrouter/nex-agi/nex-n2.5-pro:free': hot(),
    'gemini:gemini/gemini-flash-lite-latest': { cooldownUntil: now - 1 }, // expired
  }, now)
  assert.deepEqual(plan.admitted.map((m) => m.model), [
    'ocwrap/longcat-2.5-preview-free', 'cohere/north-mini-code:free', 'gemini/gemini-flash-lite-latest',
  ])
  assert.deepEqual(Object.keys(plan.cooling).sort(), ['ocwrap:big-pickle', 'openrouter:nex-agi/nex-n2.5-pro:free'])
})

test('never an empty combo', () => {
  const ledger = Object.fromEntries(CODE_COMBO.map((m) => [`${m.providerId}:${m.model}`, hot()]))
  const plan = planCombo(ledger, now)
  assert.equal(plan.allCooling, true)
  assert.deepEqual(plan.admitted, CODE_COMBO)
})

test('signature changes only when the admitted set changes', () => {
  assert.equal(signature(CODE_COMBO), signature([...CODE_COMBO]))
  assert.notEqual(signature(CODE_COMBO), signature(CODE_COMBO.slice(1)))
})
