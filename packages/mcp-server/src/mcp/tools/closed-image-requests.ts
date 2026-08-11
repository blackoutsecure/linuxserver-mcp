import { searchImageRequests } from '../../tools.js';

export const closedImageRequests = (
  input: Parameters<typeof searchImageRequests>[0]
) => searchImageRequests({ ...input, status: 'closed' });
