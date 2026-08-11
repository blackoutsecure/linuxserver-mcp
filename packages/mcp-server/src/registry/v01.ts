import { getServerJson } from './server-json.js';

export function listRegistryServers() {
  return { servers: [getServerJson()], metadata: { count: 1 } };
}

export function getRegistryVersion(version = 'latest') {
  const server = getServerJson();
  return version === 'latest' || version === server.version ? server : null;
}
