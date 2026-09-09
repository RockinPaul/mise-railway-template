import { execFileSync } from 'node:child_process';
import { preserve } from 'railway/iac';

function readRailway(args) {
  return execFileSync('railway', args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000, maxBuffer: 4 * 1024 * 1024,
  });
}

function connectionNodes(connection, fields) {
  if (!Array.isArray(connection?.edges) || connection.edges.some(edge =>
    fields.some(field => typeof edge?.node?.[field] !== 'string' || !edge.node[field]))) {
    throw new Error('Incomplete Railway status; refusing to risk deleting owner variables.');
  }
  return connection.edges.map(edge => edge.node);
}

export function preserveOwnerVariables(context, read = readRailway) {
  const { projectId, environmentId } = context ?? {};
  if (typeof projectId !== 'string' || !projectId || typeof environmentId !== 'string' || !environmentId) {
    throw new Error('Railway projectId and environmentId are required to preserve owner variables.');
  }
  const readJson = args => {
    try {
      return JSON.parse(read(args));
    } catch {
      // Native variable-list output and subprocess errors can contain secrets.
      throw new Error('Cannot read Railway state; refusing to risk deleting owner variables.');
    }
  };
  const status = readJson(['status', '--project', projectId, '--environment', environmentId, '--json']);
  if (status?.id !== projectId) throw new Error('Railway project mismatch while preserving owner variables.');
  const services = connectionNodes(status.services, ['id', 'name']);
  const environments = connectionNodes(status.environments, ['id']);
  const environment = environments.find(item => item.id === environmentId);
  if (!environment || environment.canAccess !== true || environment.deletedAt) {
    throw new Error('Railway target environment is unavailable; refusing to risk deleting owner variables.');
  }
  const instances = connectionNodes(environment.serviceInstances, ['serviceId', 'environmentId']);
  if (instances.some(instance => instance.environmentId !== environmentId)) {
    throw new Error('Railway environment mismatch while preserving owner variables.');
  }
  const matches = services.filter(item => item.name === 'workspace');
  if (matches.length > 1) throw new Error('Ambiguous Railway workspace service.');
  const workspace = matches[0];
  // A verified new service/environment has no existing variable names to preserve.
  if (!workspace || !instances.some(instance => instance.serviceId === workspace.id)) return {};
  const variables = readJson(['variable', 'list', '--project', projectId, '--environment', environmentId,
    '--service', workspace.id, '--json']);
  if (!variables || typeof variables !== 'object' || Array.isArray(variables) ||
      Object.values(variables).some(value => value !== null && typeof value !== 'string')) {
    throw new Error('Invalid Railway variable listing; refusing to risk deleting owner variables.');
  }
  return Object.fromEntries(Object.keys(variables).map(name => [name, preserve()]));
}
