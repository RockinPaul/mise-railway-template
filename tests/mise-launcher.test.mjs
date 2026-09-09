import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const image = process.env.WORKSPACE_IMAGE || 'mise-workspace:test';
test('mise refuses inherited CI auto-approval without executing configuration', () => {
  const result = spawnSync('docker', ['run', '--rm', '--platform', 'linux/amd64', '--network', 'none',
    '-e', 'CI=true', '--entrypoint', '/usr/local/bin/mise', image, '--version'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refuses CI/);
});

test('new shims retain the trusted launcher and cannot bypass its CI guard', () => {
  const result = spawnSync('docker', ['run', '--rm', '--platform', 'linux/amd64', '--network', 'none',
    '--entrypoint', '/bin/bash', image, '-euc',
    'mkdir -p /root/.local/share /root/.config/mise; cp -a /opt/workspace-seed/mise-data /root/.local/share/mise; cp -a /opt/workspace-seed/home/.config/mise/. /root/.config/mise/; cd /root; mise reshim; test "$(readlink /root/.local/share/mise/shims/node)" = /usr/local/bin/mise; CI=true /root/.local/share/mise/shims/node --version'],
    { encoding: 'utf8', timeout: 60000 });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refuses CI/);
});
