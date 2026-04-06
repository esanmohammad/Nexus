import { Context, Next } from "hono";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "admin@co.com")
  .split(",")
  .map((e) => e.trim());

export async function adminMiddleware(c: Context, next: Next) {
  const user = c.get("user");
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    return c.json(
      { error: { code: "FORBIDDEN", message: "Admin access required" } },
      403
    );
  }
  return next();
}
