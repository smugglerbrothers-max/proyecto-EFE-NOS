import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { CODE_COMBO, canonicalLedgerKey, canonicalModelKey, classify, comboFullyCooling } from '../orchestrator/omniroute-limit-observer.js'

test('CODE_COMBO matches omniroute-code-combo.json (single source of truth)', () => {
  const file = JSON.parse(readFileSync(new URL('../omniroute-code-combo.json', import.meta.url), 'utf8'))
  assert.deepEqual(CODE_COMBO, file.models)
})

test('ledger keys with mixed spellings canonicalize to the same key', () => {
  assert.equal(canonicalLedgerKey('openrouter:openrouter/nex-agi/nex-n2.5-pro:free'), canonicalModelKey('openrouter', 'nex-agi/nex-n2.5-pro:free'))
  assert.equal(canonicalLedgerKey('openrouter:cohere/north-mini-code:free'), 'openrouter:cohere/north-mini-code:free')
  assert.equal(canonicalLedgerKey('ocwrap:ocwrap/big-pickle'), 'ocwrap:big-pickle')
  assert.equal(canonicalLedgerKey('whatever', { provider: 'gemini', model: 'gemini/gemini-flash-lite-latest' }), 'gemini:gemini-flash-lite-latest')
})

test('combo is fully cooling only when every model is, across ledgers', () => {
  const now = 1000
  const hot = { cooldownUntil: now + 1 }
  const controller = {
    'ocwrap:ocwrap/big-pickle': hot,
    'ocwrap:ocwrap/longcat-2.5-preview-free': hot,
    'openrouter:openrouter/nex-agi/nex-n2.5-pro:free': hot,
    'gemini:gemini/gemini-flash-lite-latest': hot,
  }
  assert.equal(comboFullyCooling([controller], now), false)
  const own = { 'openrouter:cohere/north-mini-code:free': { provider: 'openrouter', model: 'cohere/north-mini-code:free', cooldownUntil: now + 1 } }
  assert.equal(comboFullyCooling([controller, own], now), true)
  assert.equal(comboFullyCooling([controller, own], now + 5), false)
  assert.equal(comboFullyCooling([undefined, null], now), false)
})

test('classify', () => {
  assert.equal(classify({ status: 429 }), 'rate_limit_or_quota')
  assert.equal(classify({ status: 200, error_summary: 'free-models-per-day exceeded' }), 'rate_limit_or_quota')
  assert.equal(classify({ status: 404 }), 'model_unavailable')
  assert.equal(classify({ status: 502 }), 'provider_error')
  assert.equal(classify({ status: 400 }), 'request_error')
  assert.equal(classify({ status: 200 }), null)
})
