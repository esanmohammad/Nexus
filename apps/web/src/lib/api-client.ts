"use client";

import { QueryClient } from "@tanstack/react-query";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export function createApiClient(token?: string) {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return {
    baseUrl: API_BASE,
    headers,
    async get<T>(path: string): Promise<T> {
      const res = await fetch(`${API_BASE}${path}`, {
        headers,
        credentials: "include",
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    async post<T>(path: string, body?: unknown): Promise<T> {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});
