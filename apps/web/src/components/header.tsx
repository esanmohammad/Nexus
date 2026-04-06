"use client";

import Link from "next/link";
import { useAuth, login, logout } from "../lib/auth";

export function Header() {
  const { user, isLoading, isAuthenticated } = useAuth();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-gray-900">
          Nexus
        </Link>

        <div className="flex items-center gap-3">
          {isLoading ? (
            <span className="text-sm text-gray-400">Loading...</span>
          ) : isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
                  {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                </div>
                <span className="text-sm text-gray-700">{user.email}</span>
              </div>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700 min-h-[44px] px-2"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 min-h-[44px]"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
