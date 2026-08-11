import metadata from '../../server.json' with { type: 'json' };
export const getServerJson = () => structuredClone(metadata);
