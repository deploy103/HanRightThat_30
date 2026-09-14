import type { Booth, BoothInput, FestivalData, FestivalMeta, Show } from '../../shared/types';

const ADMIN_KEY_STORAGE = 'hanbit30.adminKey';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getAdminKey(): string {
  try {
    return localStorage.getItem(ADMIN_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setAdminKey(key: string): void {
  try {
    if (key) localStorage.setItem(ADMIN_KEY_STORAGE, key);
    else localStorage.removeItem(ADMIN_KEY_STORAGE);
  } catch {
    /* localStorage 사용 불가 환경은 무시한다. */
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const key = getAdminKey();
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'x-admin-key': key } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `요청이 실패했습니다. (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* 본문이 JSON 이 아니면 기본 메시지를 쓴다. */
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export const api = {
  getFestival: () => request<FestivalData>('/festival'),
  getAdminStatus: () => request<{ protected: boolean }>('/admin/status'),
  updateMeta: (meta: FestivalMeta) =>
    request<FestivalData>('/meta', { method: 'PUT', ...json(meta) }),
  createBooth: (booth: BoothInput) => request<Booth>('/booths', { method: 'POST', ...json(booth) }),
  updateBooth: (id: string, booth: BoothInput) =>
    request<Booth>(`/booths/${id}`, { method: 'PUT', ...json(booth) }),
  deleteBooth: (id: string) => request<void>(`/booths/${id}`, { method: 'DELETE' }),
  createShow: (show: Omit<Show, 'id' | 'order'>) =>
    request<Show>('/shows', { method: 'POST', ...json(show) }),
  updateShow: (id: string, show: Omit<Show, 'id' | 'order'>) =>
    request<Show>(`/shows/${id}`, { method: 'PUT', ...json(show) }),
  deleteShow: (id: string) => request<void>(`/shows/${id}`, { method: 'DELETE' }),
  reorderShows: (ids: string[]) =>
    request<Show[]>('/shows/order', { method: 'PUT', ...json({ ids }) }),
};
