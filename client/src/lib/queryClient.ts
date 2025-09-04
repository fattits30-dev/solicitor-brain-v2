import { QueryClient, QueryFunction } from '@tanstack/react-query';
import { apiClient } from './api-client';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = data ? { 'Content-Type': 'application/json' } : {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include',
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = 'returnNull' | 'throw';
export const getQueryFn = <T>(options: { on401: UnauthorizedBehavior }): QueryFunction<T | null> =>
  async ({ queryKey }) => {
    const endpoint = queryKey.join('/') as string;
    const { on401: unauthorizedBehavior } = options;

    try {
      // Use our API client which handles JWT tokens automatically
      const data = await apiClient.get<T>(endpoint);
      return data;
    } catch (error: any) {
      if (unauthorizedBehavior === 'returnNull' && error.message?.includes('401')) {
        return null;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
