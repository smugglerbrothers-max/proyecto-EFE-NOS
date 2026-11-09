import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  blindWaitReason,
  isChildEscalation,
  isDelegatedChild,
  isProducingShellCommand,
  longForegroundReason,
  sensitiveDelegationReason,
} from '../orchestrator/orchestrator-readonly-policy-v2.js'

test('read-only commands stay allowed', () => {
  for (const cmd of [
    'ls -la', 'cat README.md', 'grep -rn foo src', 'sed -n 1,20p a.js', 'git diff', 'git status',
    'git log --oneline', 'node --test test/x.test.mjs 2>&1', 'cmd > /dev/null', 'cmd >/tmp/out.txt',
    "awk '$1 > 5' data", 'find . -name "*.js"', 'find . -exec grep -l foo {} +', 'git branch --list',
    'python3 -c "print(1)"', 'jq . file.json',
  ]) assert.equal(isProducingShellCommand(cmd), false, cmd)
})

test('producing commands are denied', () => {
  for (const cmd of [
    'echo hi > out.md', 'cat x >> ./notes/a', 'rm -rf build', 'ls && mv a b', 'sed -i s/a/b/ f',
    'git commit -m x', 'git switch main', 'git cherry-pick abc', 'git -C repo reset --hard',
    'git branch -D old', 'npm install', 'pip install x', 'find . -name "*.tmp" -delete',
    'find . -exec rm {} \;', `python3 -c "open('a.txt','w').write('x')"`,
    'node -e "require(\'fs\').writeFileSync(\'a\',\'b\')"',
    "python3 - <<'PY'\nopen('x','w')\nPY",
  ]) assert.equal(isProducingShellCommand(cmd), true, cmd)
})

test('child escalation detection', () => {
  for (const cmd of [
    'sudo ls', 'systemctl restart foo', 'systemd-run x', 'timeout 5 sudo x', 'timeout -s KILL 5 sudo x',
    'run0 id', 'bash -c "sudo rm x"', 'echo $(pkexec id)', 'FOO=1 nohup sudo x', '(sudo x)',
  ]) assert.equal(isChildEscalation(cmd), true, cmd)
  for (const cmd of [
    'systemctl --user restart hf-studio-g2', 'grep systemctl README.md', 'bash scripts/serve.sh',
    'echo sudo', 'curl -s localhost:3002',
  ]) assert.equal(isChildEscalation(cmd), false, cmd)
})

test('blind waits over 120 s are denied, both spellings', () => {
  assert.ok(blindWaitReason({ name: 'job_output', arguments: { wait: true, timeout_ms: 600000 } }))
  assert.ok(blindWaitReason({ name: 'job_output', arguments: { wait: true, timeoutMs: 600000 } }))
  assert.equal(blindWaitReason({ name: 'job_output', arguments: { wait: true, timeout_ms: 120000 } }), undefined)
  assert.equal(blindWaitReason({ name: 'job_output', arguments: { wait: false, timeout_ms: 600000 } }), undefined)
})

test('long foreground commands are denied unless backgrounded', () => {
  assert.ok(longForegroundReason({ name: 'bash', arguments: { command: 'x', timeoutMs: 600000 } }))
  assert.equal(longForegroundReason({ name: 'bash', arguments: { command: 'x', timeoutMs: 600000, run_in_background: true } }), undefined)
})

test('secrets never reach the free providers', () => {
  const call = (prompt) => sensitiveDelegationReason({ name: 'omniroute_code', arguments: { prompt } })
  assert.ok(call('usa la clave sk-abcdefghijklmnopqrstuvwx'))
  assert.ok(call('lee el archivo .env y'))
  assert.ok(call('password: hunter2hunter2hunter2'))
  assert.equal(call('Editá /home/u/proj/src/app.js y corré node --test'), undefined)
  assert.equal(sensitiveDelegationReason({ name: 'bash', arguments: { prompt: '.env' } }), undefined)
})

test('child detection uses the session header', () => {
  assert.equal(isDelegatedChild({ session: { header: { parentSession: 's1' } } }), true)
  assert.equal(isDelegatedChild({ session: { header: { delegationDepth: 1 } } }), true)
  assert.equal(isDelegatedChild({ session: { header: {} } }), false)
  assert.equal(isDelegatedChild({}), false)
})
