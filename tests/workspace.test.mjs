import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import test from 'node:test';

const image = process.env.WORKSPACE_IMAGE || 'mise-workspace:test';
function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: 'pipe', timeout: 180000 }).trim();
}

async function workspace(t) {
  const name = `mise-test-${randomUUID()}`;
  const volume = `${name}-home`;
  docker('volume', 'create', volume);
  t.after(() => {
    spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
    docker('volume', 'rm', volume);
  });
  async function start(network = 'none') {
    docker('run', '-d', '--name', name, '--platform', 'linux/amd64', '--network', network,
      '--mount', `type=volume,src=${volume},dst=/root,volume-nocopy`, image);
    for (let attempt = 0; attempt < 100; attempt++) {
      const ready = spawnSync('docker', ['exec', name, 'test', '-f', '/root/.mise-workspace-initialized']);
      if (ready.status === 0 && docker('exec', name, 'ps', '-o', 'comm=', '--ppid', '1') === 'sleep') return;
      if (docker('inspect', '--format', '{{.State.Running}}', name) !== 'true') {
        throw new Error(`Workspace failed: ${docker('logs', name)}`);
      }
      await setTimeout(100);
    }
    throw new Error('Workspace initialization timed out');
  }
  const shell = command => docker('exec', name, '/bin/bash', '--noprofile', '--norc', '-euc', command);
  return { name, start, shell, async recreate(network = 'none') {
    docker('stop', '--time', '5', name);
    docker('rm', name);
    await start(network);
  }};
}

test('empty mounted home starts offline and provides interactive and one-shot tools', async t => {
  const w = await workspace(t);
  await w.start();
  assert.equal(w.shell('node --version; python --version; uv --version'), 'v24.21.0\nPython 3.13.15\nuv 0.12.11 (x86_64-unknown-linux-gnu)');
  assert.equal(docker('exec', w.name, '/bin/bash', '-lic', 'node --version'), 'v24.21.0');
  assert.equal(w.shell('id -u; printf "%s\\n" "$HOME"; test -d /root/projects; stat -c %a /root/.mise-workspace-initialized'), '0\n/root\n600');
  assert.equal(w.shell('ps -p 1 -o comm='), 'tini');
});

test('project, venv, user config and additional tool survive offline replacement', async t => {
  const w = await workspace(t);
  await w.start('bridge');
  w.shell('mkdir -p /root/projects/proof; printf persistent > /root/projects/proof/data; printf custom > /root/.owner-dotfile; python -m venv /root/projects/proof/.venv; mise use --global --pin uv@0.12.10');
  const config = w.shell('sha256sum /root/.config/mise/config.toml');
  const installed = w.shell('uv --version');
  assert.equal(installed, 'uv 0.12.10 (x86_64-unknown-linux-gnu)');
  // Removing a seeded profile is an intentional owner choice, not corruption.
  w.shell('rm /root/.bash_profile');
  await w.recreate();
  assert.equal(w.shell('cat /root/projects/proof/data; cat /root/.owner-dotfile'), 'persistentcustom');
  assert.equal(w.shell('/root/projects/proof/.venv/bin/python --version'), 'Python 3.13.15');
  assert.equal(w.shell('uv --version'), installed);
  assert.equal(w.shell('sha256sum /root/.config/mise/config.toml'), config);
  w.shell('test ! -e /root/.bash_profile');
});

test('project trust blocks execution, including CI and changed previously trusted config', async t => {
  const w = await workspace(t);
  await w.start();
  w.shell(`mkdir -p /root/projects/untrusted; printf '%s\\n' '[env]' 'PROOF = """{{ exec(command="touch /root/untrusted-ran") }}"""' > /root/projects/untrusted/mise.toml`);
  const run = (ci = 'false') => spawnSync('docker', ['exec', '-e', `CI=${ci}`, '-w', '/root/projects/untrusted', w.name,
    '/usr/local/bin/mise', 'exec', '--', 'true'], { encoding: 'utf8' });
  const untrusted = run();
  assert.notEqual(untrusted.status, 0);
  assert.match(untrusted.stderr, /not trusted|untrusted/i);
  assert.notEqual(run('true').status, 0);
  w.shell('test ! -e /root/untrusted-ran');
  // Use an ordinary non-executing config to prove content-change reapproval.
  w.shell(`printf '%s\\n' '[env]' 'APP_ENV = "accepted"' > /root/projects/untrusted/mise.toml; cd /root/projects/untrusted; mise trust`);
  assert.equal(w.shell('cd /root/projects/untrusted; mise exec -- printenv APP_ENV'), 'accepted');
  w.shell(`printf '%s\\n' '[env]' 'APP_ENV = "changed"' > /root/projects/untrusted/mise.toml`);
  assert.notEqual(run().status, 0);
  assert.notEqual(run('true').status, 0);
  assert.equal(w.shell('cd /root/projects/untrusted; /bin/bash --noprofile --norc -c "echo repair-ready"'), 'repair-ready');
  await w.recreate();
  w.shell('test ! -e /root/untrusted-ran');
});

test('tmux survives disconnection but not replacement; stop is graceful', async t => {
  const w = await workspace(t);
  await w.start();
  w.shell('tmux new-session -d -s proof "sleep infinity"');
  assert.equal(w.shell('tmux list-sessions -F "#{session_name}"'), 'proof');
  assert.equal(w.shell('tmux list-sessions -F "#{session_name}"'), 'proof');
  docker('stop', '--time', '5', w.name);
  const state = JSON.parse(docker('inspect', w.name))[0].State;
  assert.equal(state.ExitCode, 143);
  assert.equal(state.OOMKilled, false);
  docker('rm', w.name);
  await w.start();
  assert.notEqual(spawnSync('docker', ['exec', w.name, 'tmux', 'has-session', '-t', 'proof']).status, 0);
  assert.equal(w.shell('ps -o comm= --ppid 1'), 'sleep');
});
