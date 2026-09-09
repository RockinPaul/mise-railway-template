import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

const image = 'debian:13-slim@sha256:d7e12182ce18b85b93007c1dedf31f2d29e01ccf3182cc4017c709b6259bc132';
const entrypoint = resolve('workspace-entrypoint.sh');
const marker = '/root/.mise-workspace-initialized';

function docker(args, timeout = 60000) {
  return spawnSync('docker', args, { encoding: 'utf8', timeout });
}

function dockerOutput(args) {
  return execFileSync('docker', args, { encoding: 'utf8', timeout: 60000 }).trim();
}

function makeSeed() {
  const root = mkdtempSync(`${tmpdir()}/mise-bootstrap-seed-`);
  mkdirSync(`${root}/mise-data/installs/node`, { recursive: true });
  mkdirSync(`${root}/mise-data/downloads`, { recursive: true });
  mkdirSync(`${root}/home/.config/mise`, { recursive: true });
  writeFileSync(`${root}/mise-data/installs/node/version`, '24.21.0\n');
  writeFileSync(`${root}/mise-data/downloads/archive`, 'seed archive\n');
  writeFileSync(`${root}/home/.config/mise/config.toml`, '[tools]\nnode = "24.21.0"\n');
  writeFileSync(`${root}/home/.config/mise/mise.lock`, 'node = "24.21.0"\n');
  writeFileSync(`${root}/home/.bashrc`, 'export SEEDED_BASHRC=1\n');
  writeFileSync(`${root}/home/.bash_profile`, 'export SEEDED_PROFILE=1\n');
  return root;
}

function fixture(t) {
  const suffix = `${process.pid}-${randomUUID()}`;
  const volume = `mise-bootstrap-${suffix}`;
  const seed = makeSeed();
  const containers = [];
  assert.equal(docker(['volume', 'create', volume]).status, 0);
  t.after(() => {
    for (const name of containers) docker(['rm', '-f', name]);
    docker(['volume', 'rm', '-f', volume]);
    rmSync(seed, { recursive: true, force: true });
  });

  function args(name, { mountRoot = true, readOnly = false, extra = [], env = [], command = [] } = {}) {
    const result = ['run', '--platform', 'linux/amd64', '--network', 'none', '--name', name];
    if (mountRoot) {
      result.push('--mount', `type=volume,src=${volume},dst=/root,volume-nocopy${readOnly ? ',readonly' : ''}`);
    }
    result.push(
      '--mount', `type=bind,src=${entrypoint},dst=/usr/local/bin/workspace-entrypoint,readonly`,
      '--mount', `type=bind,src=${seed},dst=/opt/workspace-seed,readonly`,
    );
    for (const value of env) result.push('--env', value);
    result.push(...extra, '--entrypoint', '/usr/local/bin/workspace-entrypoint', image, ...command);
    return result;
  }

  function start(options = {}) {
    const name = `mise-bootstrap-container-${suffix}-${containers.length}`;
    containers.push(name);
    const result = docker(['run', '-d', ...args(name, options).slice(1)]);
    assert.equal(result.status, 0, result.stderr);
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const ready = docker(['exec', name, '/bin/sh', '-c',
        `test -f ${marker} && test "$(/usr/bin/readlink /proc/1/exe)" = /usr/bin/sleep`]);
      if (ready.status === 0) return name;
      const running = dockerOutput(['inspect', '-f', '{{.State.Running}}', name]);
      if (running !== 'true') break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
    const logs = docker(['logs', name]);
    assert.fail(`bootstrap did not become ready:\n${logs.stdout}${logs.stderr}`);
  }

  function fail(options = {}) {
    const name = `mise-bootstrap-container-${suffix}-${containers.length}`;
    containers.push(name);
    return docker(['run', '--rm', ...args(name, options).slice(1)]);
  }

  function shell(command) {
    return dockerOutput([
      'run', '--rm', '--platform', 'linux/amd64', '--network', 'none',
      '--mount', `type=volume,src=${volume},dst=/root,volume-nocopy`,
      '--entrypoint', '/bin/sh', image, '-euc', command,
    ]);
  }

  function exec(name, command) {
    return dockerOutput(['exec', name, '/bin/sh', '-euc', command]);
  }

  return { exec, fail, seed, shell, start, volume };
}

test('first boot atomically installs the complete private seed and fixed idle process', (t) => {
  const f = fixture(t);
  const name = f.start({ command: ['/bin/sh', '-c', 'touch /root/arbitrary-command-ran'] });
  assert.equal(f.exec(name, `
    test "$(cat ${marker})" = 1
    test "$(stat -c %a ${marker})" = 600
    test "$(cat /root/.local/share/mise/installs/node/version)" = 24.21.0
    test "$(cat /root/.config/mise/config.toml)" = '[tools]
node = "24.21.0"'
    test "$(stat -c %a /root/.bashrc)" = 600
    test -d /root/projects
    test ! -e /root/arbitrary-command-ran
    test "$(readlink /proc/1/exe)" = /usr/bin/sleep
    tr '\\0' '\\n' </proc/1/cmdline | tail -n 1 | grep -qx infinity
    test -z "$(find /root/.local/share/mise -perm /077 -print -quit)"
    printf seeded
  `), 'seeded');
});

test('first boot preserves existing user data and fills only missing defaults', (t) => {
  const f = fixture(t);
  f.shell(`
    mkdir -p /root/.local/share/mise/installs/custom /root/.config/mise
    printf custom > /root/.local/share/mise/installs/custom/version
    printf user-config > /root/.config/mise/config.toml
    printf user-bash > /root/.bashrc
  `);
  const name = f.start();
  assert.equal(f.exec(name, `
    test "$(cat /root/.local/share/mise/installs/custom/version)" = custom
    test ! -e /root/.local/share/mise/installs/node/version
    test "$(cat /root/.config/mise/config.toml)" = user-config
    test "$(cat /root/.bashrc)" = user-bash
    test "$(cat /root/.config/mise/mise.lock)" = 'node = "24.21.0"'
    printf preserved
  `), 'preserved');
});

test('completed boots do not resurrect intentionally removed tools or defaults', (t) => {
  const f = fixture(t);
  const first = f.start();
  docker(['rm', '-f', first]);
  f.shell('rm -rf /root/.local/share/mise /root/.config/mise; rm -f /root/.bashrc /root/.bash_profile');
  const second = f.start();
  assert.equal(f.exec(second, `
    test -f ${marker}
    test ! -e /root/.local/share/mise
    test ! -e /root/.config/mise
    test ! -e /root/.bashrc
    test ! -e /root/.bash_profile
    printf absent
  `), 'absent');
});

test('startup clearly rejects a missing or read-only root mount', (t) => {
  const f = fixture(t);
  const missing = f.fail({ mountRoot: false });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /persistent \/root mount is required/);
  const readOnly = f.fail({ readOnly: true });
  assert.notEqual(readOnly.status, 0);
  assert.match(readOnly.stderr, /persistent \/root mount must be writable/);
});

test('uninitialized conflicting and symlinked critical paths are rejected without escape', (t) => {
  for (const setup of [
    'mkdir /root/escape; touch /root/.local',
    'mkdir -p /root/.local /root/escape; ln -s /root/escape /root/.local/share',
    'mkdir -p /root/.local/share /root/escape; ln -s /root/escape /root/.local/share/mise',
    'mkdir /root/escape; ln -s /root/escape /root/.config',
    'mkdir -p /root/.config /root/escape; ln -s /root/escape /root/.config/mise',
  ]) {
    const f = fixture(t);
    f.shell(setup);
    const result = f.fail();
    assert.notEqual(result.status, 0, setup);
    assert.match(result.stderr, /unsafe or conflicting path/, setup);
    assert.equal(f.shell('test -z "$(find /root/escape -mindepth 1 -print -quit)"; printf safe'), 'safe');
  }
});

test('preexisting dotfile symlinks are preserved without writes through them', (t) => {
  const f = fixture(t);
  f.shell(`
    mkdir -p /root/.config/mise
    ln -s /tmp/escaped-bashrc /root/.bashrc
    ln -s /tmp/escaped-config /root/.config/mise/config.toml
  `);
  const name = f.start();
  assert.equal(f.exec(name, `
    test -L /root/.bashrc
    test "$(readlink /root/.bashrc)" = /tmp/escaped-bashrc
    test -L /root/.config/mise/config.toml
    test "$(readlink /root/.config/mise/config.toml)" = /tmp/escaped-config
    test ! -e /tmp/escaped-bashrc
    test ! -e /tmp/escaped-config
    printf untouched
  `), 'untouched');
});

test('an interrupted temporary store is ignored and a retry completes separately', (t) => {
  const f = fixture(t);
  f.shell('mkdir -p /root/.local/share/.mise.tmp.interrupted; printf partial > /root/.local/share/.mise.tmp.interrupted/version');
  const name = f.start();
  assert.equal(f.exec(name, `
    test "$(cat /root/.local/share/.mise.tmp.interrupted/version)" = partial
    test "$(cat /root/.local/share/mise/installs/node/version)" = 24.21.0
    test -f ${marker}
    printf retried
  `), 'retried');
});

test('a seed-copy failure leaves no marker and the same volume can retry', (t) => {
  const f = fixture(t);
  writeFileSync(`${f.seed}/mise-data/large`, Buffer.alloc(1024 * 1024, 1));
  const failed = f.fail({ extra: ['--mount', 'type=tmpfs,dst=/root/.local/share,tmpfs-size=4096'] });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /failed to copy mise seed/);
  assert.equal(f.shell(`test ! -e ${marker}; printf unmarked`), 'unmarked');
  const name = f.start();
  assert.equal(f.exec(name, `test -s /root/.local/share/mise/large; test -f ${marker}; printf recovered`), 'recovered');
});

test('malicious PATH, profiles, mise config, and command arguments never execute', (t) => {
  const f = fixture(t);
  f.shell(`
    mkdir -p /root/evil /root/.config/mise
    for tool in mountpoint id mktemp mkdir cp chmod mv; do
      printf '#!/bin/sh\ntouch /root/evil-path-ran\nexit 90\n' > "/root/evil/$tool"
      chmod 700 "/root/evil/$tool"
    done
    printf 'touch /root/profile-ran\n' > /root/.bashrc
    printf 'touch /root/profile-ran\n' > /root/.bash_profile
    printf 'touch /root/mise-config-ran\n' > /root/.config/mise/config.toml
  `);
  const name = f.start({
    env: ['PATH=/root/evil'],
    command: ['/bin/sh', '-c', 'touch /root/command-ran'],
  });
  assert.equal(f.exec(name, `
    test ! -e /root/evil-path-ran
    test ! -e /root/profile-ran
    test ! -e /root/mise-config-ran
    test ! -e /root/command-ran
    printf trusted
  `), 'trusted');
});
