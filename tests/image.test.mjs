import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const image = process.env.WORKSPACE_IMAGE || 'mise-workspace:test';
function shell(command) {
  return execFileSync('docker', ['run', '--rm', '--platform', 'linux/amd64', '--network', 'none',
    '--entrypoint', '/bin/bash', image, '-euc', command], { encoding: 'utf8', stdio: 'pipe', timeout: 60000 }).trim();
}

test('image has pinned immutable tools and root owner', () => {
  assert.equal(shell('id -u; printf "%s\\n" "$HOME"; command -v mise; mise --version'),
    '0\n/root\n/usr/local/bin/mise\n2026.10.9 linux-x64 (2026-10-13)');
});

test('baseline seed works at its final prefix without networking', () => {
  const versions = shell('mkdir -p /root/.local/share /root/.config/mise; cp -a /opt/workspace-seed/mise-data /root/.local/share/mise; cp -a /opt/workspace-seed/home/.config/mise/. /root/.config/mise/; cd /root; mise exec -- node --version; mise exec -- python --version; mise exec -- uv --version');
  assert.equal(versions, 'v24.21.0\nPython 3.13.15\nuv 0.12.11 (x86_64-unknown-linux-gnu)');
});

test('seed contains global lock and defensive configuration', () => {
  const config = shell('cat /opt/workspace-seed/home/.config/mise/config.toml');
  for (const setting of ['jobs = 2', 'paranoid = true', 'not_found_auto_install = false', 'exec_auto_install = false', 'compile = false']) {
    assert.ok(config.includes(setting), setting);
  }
  const lock = shell('cat /opt/workspace-seed/home/.config/mise/mise.lock');
  for (const version of ['24.21.0', '3.13.15', '0.12.11']) assert.ok(lock.includes(version), version);
  assert.match(lock, /checksum/);
});

test('image utilities allow repairs without running user configuration', () => {
  assert.equal(shell('for tool in bash git ssh curl jq rg tmux tar unzip make cc tini mountpoint; do command -v "$tool" >/dev/null; done; test ! -e /usr/sbin/sshd; echo ready'), 'ready');
  const metadata = JSON.parse(execFileSync('docker', ['image', 'inspect', image], { encoding: 'utf8' }))[0];
  assert.deepEqual(metadata.Config.Entrypoint, ['/usr/bin/tini', '--', '/usr/local/bin/workspace-entrypoint']);
  assert.ok(!metadata.Config.ExposedPorts);
});
