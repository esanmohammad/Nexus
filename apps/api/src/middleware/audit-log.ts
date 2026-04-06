import { Context, Next } from "hono";

// In-memory audit log store
export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  resource: string;
  details?: Record<string, any>;
  timestamp: string;
}

export const auditLogStore: AuditLogEntry[] = [];

const SENSITIVE_FIELDS = [
  "password",
  "token",
  "secret",
  "file_contents",
  "source",
];

function sanitizeBody(body: any): any {
  if (!body || typeof body !== "object") return body;
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(body)) {
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export async function auditLogMiddleware(c: Context, next: Next) {
  // Only log mutating requests
  const method = c.req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  // Run the handler first
  await next();

  // Then try to log (errors must not block the response)
  try {
    const user = c.get("user") as any;
    const actor = user?.email || "anonymous";
    const action = `${method} ${c.req.path}`;

    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      actor,
      action,
      resource: c.req.path,
      timestamp: new Date().toISOString(),
    };

    auditLogStore.push(entry);
  } catch {
    // Audit log errors must never block API responses
  }
}
