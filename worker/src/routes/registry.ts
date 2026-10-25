import {
  getRegistryVersion,
  getServerJson,
  listRegistryServers
} from '@blackoutsecure/linuxserver-mcp';
import { Hono } from 'hono';
import { registryCors } from '../middleware/cors.js';

export const registryRoutes = new Hono();
const registryName = getServerJson().name;
registryRoutes.use('/v0.1/servers/*', registryCors);
registryRoutes.use('/v0.1/servers', registryCors);
registryRoutes.get('/v0.1/servers', (context) =>
  context.json(listRegistryServers())
);
registryRoutes.get('/v0.1/servers/:serverName/versions/latest', (context) => {
  if (context.req.param('serverName') !== registryName)
    return context.json({ error: 'Server not found' }, 404);
  const server = getRegistryVersion();
  return server
    ? context.json(server)
    : context.json({ error: 'Server not found' }, 404);
});
registryRoutes.get('/v0.1/servers/:serverName/versions/:version', (context) => {
  if (context.req.param('serverName') !== registryName)
    return context.json({ error: 'Server not found' }, 404);
  const server = getRegistryVersion(context.req.param('version'));
  return server
    ? context.json(server)
    : context.json({ error: 'Version not found' }, 404);
});
