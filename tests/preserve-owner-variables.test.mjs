import assert from 'node:assert/strict';
import test from 'node:test';
import { preserveOwnerVariables } from '../.railway/preserve-owner-variables.mjs';

const context = { projectId: 'target-project', environmentId: 'target-environment' };
const status = () => ({
  id: context.projectId,
  services: { edges: [{ node: { id: 'workspace-service', name: 'workspace' } }] },
  environments: { edges: [{ node: {
    id: context.environmentId, canAccess: true, deletedAt: null,
    serviceInstances: { edges: [{ node: { serviceId: 'workspace-service', environmentId: context.environmentId } }] },
  } }] },
});

test('preserves arbitrary existing names, including sealed variables, with explicit target IDs', () => {
  const calls = [];
  const variables = { OWNER_PRESERVATION_PROBE: 'secret-value', FUTURE_OWNER_KEY: 'future-value', SEALED: null };
  const result = preserveOwnerVariables(context, args => {
    calls.push(args);
    return JSON.stringify(args[0] === 'status' ? status() : variables);
  });
  assert.deepEqual(result, {
    OWNER_PRESERVATION_PROBE: { type: 'preserve' },
    FUTURE_OWNER_KEY: { type: 'preserve' },
    SEALED: { type: 'preserve' },
  });
  assert.equal(JSON.stringify(result).includes('secret-value'), false);
  assert.deepEqual(calls, [
    ['status', '--project', context.projectId, '--environment', context.environmentId, '--json'],
    ['variable', 'list', '--project', context.projectId, '--environment', context.environmentId,
      '--service', 'workspace-service', '--json'],
  ]);
});

test('requires explicit authoring context before any native read', () => {
  for (const invalid of [undefined, {}, { projectId: context.projectId }, { environmentId: context.environmentId }]) {
    assert.throws(() => preserveOwnerVariables(invalid, () => assert.fail('unexpected read')), /required/);
  }
});

test('only verified absent services or service instances skip the variable read', () => {
  for (const absent of ['service', 'instance']) {
    const current = status();
    if (absent === 'service') {
      current.services.edges = [];
      current.environments.edges[0].node.serviceInstances.edges = [];
    } else current.environments.edges[0].node.serviceInstances.edges = [];
    let reads = 0;
    assert.deepEqual(preserveOwnerVariables(context, () => {
      assert.equal(++reads, 1);
      return JSON.stringify(current);
    }), {});
  }
});

test('wrong targets, inaccessible environments, and incomplete status fail closed', () => {
  const mutations = [
    value => { value.id = 'other-project'; },
    value => { value.environments.edges[0].node.id = 'other-environment'; },
    value => { value.environments.edges[0].node.canAccess = false; },
    value => { value.environments.edges[0].node.serviceInstances.edges[0].node.environmentId = 'other-environment'; },
    value => { delete value.services; },
    value => { value.services.edges = [null]; },
    value => { delete value.environments.edges[0].node.serviceInstances; },
  ];
  for (const mutate of mutations) {
    const current = status();
    mutate(current);
    let reads = 0;
    assert.throws(() => preserveOwnerVariables(context, () => {
      assert.equal(++reads, 1);
      return JSON.stringify(current);
    }), /Railway/);
  }
});

test('read and JSON errors never expose native output or silently discard owner variables', () => {
  for (const failureAt of [1, 2]) {
    for (const malformed of [false, true]) {
      let reads = 0;
      assert.throws(() => preserveOwnerVariables(context, () => {
        if (++reads !== failureAt) return JSON.stringify(status());
        if (malformed) return 'secret-invalid-json';
        throw Object.assign(new Error('secret-error'), { stdout: 'secret-stdout', stderr: 'secret-stderr' });
      }), error => error.message === 'Cannot read Railway state; refusing to risk deleting owner variables.' &&
        !error.cause && !String(error.stack).includes('secret-'));
    }
  }
});

test('malformed variable maps fail closed', () => {
  for (const invalid of [null, [], 'value', { KEY: { value: 'secret' } }]) {
    assert.throws(() => preserveOwnerVariables(context, args =>
      JSON.stringify(args[0] === 'status' ? status() : invalid)), /Invalid Railway variable listing/);
  }
});
