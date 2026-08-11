const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL ?? ''}${path}`,
    init
  );
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
};
export const api = {
  searchImages: (params: URLSearchParams) =>
    request<any>(`/api/images?${params}`),
  getImage: (name: string) =>
    request<any>(`/api/images/${encodeURIComponent(name)}`),
  audit: (body: unknown) =>
    request<any>('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }),
  requests: (params: URLSearchParams) =>
    request<any>(`/api/image-requests?${params}`),
  pipeline: (body: unknown) =>
    request<any>('/api/image-pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }),
  prepare: (body: unknown) =>
    request<any>('/api/prepare-image-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
};
