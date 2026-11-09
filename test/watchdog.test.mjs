import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { extractTargetPaths, failureFromEvents, inFlightTool } from '../orchestrator/orchestrator-job-watchdog.js'

test('inFlightTool honours the declared deadline', () => {
  const now = 1_000_000
  const events = [{ type: 'tool/call', time: now - 60_000, data: { callId: 'a', name: 'bash', arguments: { timeoutMs: 120_000 } } }]
  assert.equal(inFlightTool(events, now)?.name, 'bash')
  assert.equal(inFlightTool(events, now + 200_000), undefined)
  assert.equal(inFlightTool([...events, { type: 'tool/result', data: { callId: 'a' } }], now), undefined)
})

test('failureFromEvents takes the last error', () => {
  const events = [
    { type: 'turn/end', data: { reason: { kind: 'error', error: { message: 'old' } } } },
    { type: 'assistant/attempt', data: { stream: [{ chunk: { type: 'finish', reason: { kind: 'error', failure: { message: '401 no key' } } } }] } },
  ]
  assert.equal(failureFromEvents(events), '401 no key')
  assert.equal(failureFromEvents([]), undefined)
})

test('target paths resolve against the absolute project dir named in the prompt', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'wd-'))
  const project = path.join(cwd, 'Gradient Descente')
  mkdirSync(path.join(project, 'src'), { recursive: true })
  writeFileSync(path.join(project, 'src', 'a.js'), '')
  const prompt = `Proyecto: ${project}\nEditá src/a.js y escribí el informe en src/report.md`
  const found = extractTargetPaths(prompt, cwd)
  assert.ok(found.includes(path.join(project, 'src', 'a.js')), found.join(','))
  assert.ok(found.includes(path.join(project, 'src', 'report.md')), found.join(','))
  assert.ok(found.every((p) => p.startsWith(cwd)))
})
