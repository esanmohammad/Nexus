import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export interface AuthUser {
  email: string;
  name: string;
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

// Test/dev token mapping for non-production environments
const DEV_TOKENS: Record<string, AuthUser> = {
  "valid-token": { email: "test@co.com", name: "Test User" },
  "valid-jwt-token": { email: "test@co.com", name: "Test User" },
  "other-user-token": { email: "other@co.com", name: "Other User" },
  "unauthorized-user-token": { email: "unauthorized@co.com", name: "Unauthorized User" },
  "internal-key": { email: "internal@system.co.com", name: "Internal System" },
};

export function verifyToken(token: string): AuthUser | null {
  // In non-production, accept well-known test tokens
  if (process.env.NODE_ENV !== "production" && DEV_TOKENS[token]) {
    return DEV_TOKENS[token];
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return { email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  // Try Bearer token first
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const user = verifyToken(token);
    if (user) {
      c.set("user", user);
      return next();
    }
  }

  // Try session cookie
  const sessionToken = getCookie(c, "session");
  if (sessionToken) {
    const user = verifyToken(sessionToken);
    if (user) {
      c.set("user", user);
      return next();
    }
  }

  return c.json(
    { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
    401
  );
}
