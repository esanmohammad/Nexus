"use client";

import { useState, useEffect, useCallback } from "react";

export interface AuthUser {
  email: string;
  name: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export function login(): void {
  window.location.href = `${API_BASE}/api/auth/login`;
}

export function logout(): void {
  fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).finally(() => {
    window.location.href = "/login";
  });
}

export function getSession(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/session=([^;]+)/);
  return match ? match[1] : null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
