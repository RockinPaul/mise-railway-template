import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Railway graph is private, persistent, always-on, and resource-bounded', () => {
  const graph = JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e',
    'import { workspaceProject } from "./.railway/railway.ts"; console.log(JSON.stringify(workspaceProject({ OWNER_SETTING: { type: "preserve" } })));'], { encoding: 'utf8' }));
  assert.equal(graph.resources.length, 2);
  const service = graph.resources.find(resource => resource.type === 'service');
  const volume = graph.resources.find(resource => resource.type === 'volume');
  assert.equal(volume.config.sizeMB, 5000);
  assert.equal(service.deploy.numReplicas, 1);
  assert.equal(service.deploy.sleepApplication, false);
  assert.equal(service.deploy.requiredMountPath, '/root');
  assert.deepEqual(service.deploy.limitOverride.containers, { cpu: 2, memoryBytes: 2147483648 });
  assert.equal(service.volumeAttachments['workspace-home'].mountPath, '/root');
  assert.deepEqual(service.volumeAttachments['workspace-home'].backupSchedules, ['DAILY']);
  assert.equal(service.networking, undefined);
  assert.deepEqual(service.variables, { OWNER_SETTING: { type: 'preserve' } });
  assert.equal(service.source.repo, 'RockinPaul/mise-railway-template');
  assert.equal(service.source.branch, 'main');
});

test('template metadata has a concise description and no application secrets', () => {
  const description = readFileSync('TEMPLATE_DESCRIPTION.txt', 'utf8').trim();
  assert.ok(description.length > 20 && description.length <= 75);
  assert.deepEqual(JSON.parse(readFileSync('.railway/template-variables.json', 'utf8')), {});
});
