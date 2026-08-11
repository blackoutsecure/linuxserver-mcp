import { searchImageRequests } from '../../tools.js';

export const pendingImageRequests = (
  input: Parameters<typeof searchImageRequests>[0]
) => searchImageRequests({ ...input, status: 'open' });
