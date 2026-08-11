import { describe, expect, it } from 'vitest';
import packageMetadata from '../../server.json' with { type: 'json' };
import rootMetadata from '../../../../server.json' with { type: 'json' };
import { getServerJson } from '../registry/server-json.js';
import { getRegistryVersion, listRegistryServers } from '../registry/v01.js';

describe('server.json generation', () => {
  it('preserves registry identity and package metadata', () => {
    const metadata = getServerJson();
    expect(metadata.name).toBe(
      'io.github.blackoutsecure/linuxserver-mcp-registry'
    );
    expect(metadata.packages[0].identifier).toBe(
      '@blackoutsecure/linuxserver-mcp-registry'
    );
    expect(listRegistryServers().metadata.count).toBe(1);
    expect(getRegistryVersion('0.1.0')?.version).toBe('0.1.0');
  });

  it('keeps publishable package metadata aligned with the root manifest', () => {
    expect(packageMetadata).toEqual(rootMetadata);
  });
});
