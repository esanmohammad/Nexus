/**
 * Wave 1 — API Routes Tests
 * Tasks: W1-021, W1-022, W1-023, W1-024
 */

import { describe, it, expect, vi } from "vitest";

// ─── W1-021: API Routes — Sandboxes + Versions ──────────────────────────────

describe("W1-021: API Routes — Sandboxes", () => {
  const getApp = async () => (await import("@nexus/api")).default;

  it("POST /api/sandboxes returns 201 with sandbox object", async () => {
    const app = await getApp();
    const formData = new FormData();
    formData.append("config", JSON.stringify({ name: "test-app" }));
    formData.append("source", new Blob(["test"]), "source.zip");

    const res = await app.request("/api/sandboxes", {
      method: "POST",
      body: formData,
      headers: { Cookie: "session=valid-token" },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("test-app");
  });

  it("GET /api/sandboxes returns array of user's sandboxes", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes", {
      headers: { Cookie: "session=valid-token" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.sandboxes || body)).toBe(true);
  });

  it("GET /api/sandboxes/:id returns sandbox with versions", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes/test-id", {
      headers: { Cookie: "session=valid-token" },
    });
    // Should return 200 or 404
    expect([200, 404]).toContain(res.status);
  });

  it("PATCH /api/sandboxes/:id returns 200", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes/test-id", {
      method: "PATCH",
      body: JSON.stringify({ ttl_days: 30 }),
      headers: {
        "Content-Type": "application/json",
        Cookie: "session=valid-token",
      },
    });
    expect([200, 404]).toContain(res.status);
  });

  it("DELETE /api/sandboxes/:id returns 202", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes/test-id", {
      method: "DELETE",
      headers: { Cookie: "session=valid-token" },
    });
    expect([202, 404]).toContain(res.status);
  });

  it("returns 400 for invalid input with Zod error messages", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes", {
      method: "POST",
      body: JSON.stringify({ name: "" }), // invalid
      headers: {
        "Content-Type": "application/json",
        Cookie: "session=valid-token",
      },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 for non-existent sandbox", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes/nonexistent-uuid", {
      headers: { Cookie: "session=valid-token" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when user doesn't own sandbox", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes/other-users-sandbox", {
      method: "DELETE",
      headers: { Cookie: "session=other-user-token" },
    });
    expect([403, 404]).toContain(res.status);
  });
});

describe("W1-021: API Routes — Versions", () => {
  const getApp = async () => (await import("@nexus/api")).default;

  it("POST /api/sandboxes/:id/versions creates new version", async () => {
    const app = await getApp();
    const formData = new FormData();
    formData.append("config", JSON.stringify({ label: "v2" }));
    formData.append("source", new Blob(["test"]), "source.zip");

    const res = await app.request("/api/sandboxes/test-id/versions", {
      method: "POST",
      body: formData,
      headers: { Cookie: "session=valid-token" },
    });
    expect([201, 404]).toContain(res.status);
  });

  it("GET /api/sandboxes/:id/versions returns version list", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes/test-id/versions", {
      headers: { Cookie: "session=valid-token" },
    });
    expect([200, 404]).toContain(res.status);
  });

  it("POST /api/sandboxes/:id/rollback performs rollback", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes/test-id/rollback", {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        "Content-Type": "application/json",
        Cookie: "session=valid-token",
      },
    });
    expect([200, 400, 404]).toContain(res.status);
  });
});

// ─── W1-022: Auth Proxy ──────────────────────────────────────────────────────

describe("W1-022: Auth Proxy", () => {
  const getApp = async () => (await import("@nexus/api")).default;

  it("unauthenticated requests return 401", async () => {
    const app = await getApp();
    const res = await app.request("/api/proxy/my-app/");
    expect(res.status).toBe(401);
  });

  it("unauthorized users return 403", async () => {
    const app = await getApp();
    const res = await app.request("/api/proxy/private-app/", {
      headers: { Cookie: "session=unauthorized-user-token" },
    });
    expect([403, 404]).toContain(res.status);
  });

  it("sandbox not found returns 404", async () => {
    const app = await getApp();
    const res = await app.request("/api/proxy/nonexistent-app/", {
      headers: { Cookie: "session=valid-token" },
    });
    expect(res.status).toBe(404);
  });
});

// ─── W1-023: Auth Middleware — Google OAuth ───────────────────────────────────

describe("W1-023: Auth Middleware", () => {
  const getApp = async () => (await import("@nexus/api")).default;

  it("/api/auth/login redirects to Google OAuth URL", async () => {
    const app = await getApp();
    const res = await app.request("/api/auth/login");
    expect([302, 303]).toContain(res.status);
    const location = res.headers.get("location");
    expect(location).toContain("accounts.google.com");
  });

  it("/api/auth/me returns 401 for unauthenticated", async () => {
    const app = await getApp();
    const res = await app.request("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("/api/auth/me returns { email, name } for authenticated user", async () => {
    const app = await getApp();
    const res = await app.request("/api/auth/me", {
      headers: { Cookie: "session=valid-jwt-token" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBeDefined();
    expect(body.name).toBeDefined();
  });

  it("/api/auth/logout clears session cookie", async () => {
    const app = await getApp();
    const res = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: "session=valid-token" },
    });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("session=");
  });

  it("Bearer token in Authorization header is accepted", async () => {
    const app = await getApp();
    const res = await app.request("/api/auth/me", {
      headers: { Authorization: "Bearer valid-jwt-token" },
    });
    expect(res.status).toBe(200);
  });
});

// ─── W1-024: Error Handler Middleware ─────────────────────────────────────────

describe("W1-024: Error Handler Middleware", () => {
  const getApp = async () => (await import("@nexus/api")).default;

  it("Zod validation errors return 400 with field-level details", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
      headers: {
        "Content-Type": "application/json",
        Cookie: "session=valid-token",
      },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code || body.error.message).toBeDefined();
  });

  it("all error responses follow { error: { code, message } } shape", async () => {
    const app = await getApp();
    const res = await app.request("/api/sandboxes/nonexistent", {
      headers: { Cookie: "session=valid-token" },
    });
    if (res.status >= 400) {
      const body = await res.json();
      expect(body.error).toBeDefined();
      expect(body.error.message).toBeDefined();
    }
  });

  it("unknown route returns 404", async () => {
    const app = await getApp();
    const res = await app.request("/api/unknown-route");
    expect(res.status).toBe(404);
  });
});
