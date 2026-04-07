"use client";

import { useState, useEffect, useCallback } from "react";

export interface AuthUser {
  email: string;
  name: string;
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const DEV_TOKEN = "valid-token";

export function login(): void {
  // In dev mode, set a dev session cookie and redirect home
  try {
    document.cookie = `session=${DEV_TOKEN}; path=/; max-age=86400; SameSite=Lax`;
    window.location.assign("/");
  } catch (e) {
    console.error("Login failed:", e);
  }
}

export function logout(): void {
  document.cookie = "session=; path=/; max-age=0";
  window.location.href = "/login";
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
    const token = getSession();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
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
