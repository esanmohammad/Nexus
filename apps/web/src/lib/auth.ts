"use client";

import { useState, useEffect, useCallback } from "react";

export interface AuthUser {
  email: string;
  name: string;
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const DEV_TOKEN = "valid-token";

export function login(): void {
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const token = getSession();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((res) => {
        clearTimeout(timeout);
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        setUser(data || null);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [mounted]);

  return {
    user,
    isLoading: !mounted || isLoading,
    isAuthenticated: !!user,
  };
}
