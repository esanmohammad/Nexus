import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { adminMiddleware } from "../middleware/admin.js";
import { auditLogStore } from "../middleware/audit-log.js";
import * as sandboxService from "../services/sandbox.service.js";

export const adminRoute = new Hono();

// All admin routes require auth + admin
adminRoute.use("*", authMiddleware);
adminRoute.use("*", adminMiddleware);

// GET /api/admin/stats
adminRoute.get("/stats", async (c) => {
  const all = sandboxService.listAll();

  const sandboxes_by_state: Record<string, number> = {};
  for (const s of all) {
    sandboxes_by_state[s.state] = (sandboxes_by_state[s.state] || 0) + 1;
  }

  const today = new Date().toISOString().slice(0, 10);
  const builds_today = all.filter(
    (s) => s.created_at && s.created_at.startsWith(today)
  ).length;

  const uniqueOwners = new Set(all.map((s) => s.owner_email));

  return c.json({
    sandboxes_by_state,
    total_versions: all.reduce((sum, s) => sum + (s.current_version || 0), 0),
    builds_today,
    active_users: uniqueOwners.size,
  });
});

// GET /api/admin/sandboxes
adminRoute.get("/sandboxes", async (c) => {
  let all = sandboxService.listAll();

  const owner = c.req.query("owner");
  const team = c.req.query("team");
  const state = c.req.query("state");

  if (owner) {
    all = all.filter((s) => s.owner_email === owner);
  }
  if (team) {
    all = all.filter((s) => s.team === team);
  }
  if (state) {
    all = all.filter((s) => s.state === state);
  }

  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const start = (page - 1) * limit;
  const paged = all.slice(start, start + limit);

  return c.json({
    sandboxes: paged,
    total: all.length,
    page,
    limit,
  });
});

// DELETE /api/admin/sandboxes/:id
adminRoute.delete("/sandboxes/:id", async (c) => {
  const id = c.req.param("id");
  try {
    await sandboxService.destroy(id);
    return c.json({ message: "Sandbox force-destroyed" });
  } catch (err: any) {
    if (err.status === 404) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Sandbox not found" } },
        404
      );
    }
    throw err;
  }
});

// GET /api/admin/audit-logs
adminRoute.get("/audit-logs", async (c) => {
  let entries = [...auditLogStore];

  const actor = c.req.query("actor");
  const action = c.req.query("action");
  const from = c.req.query("from");
  const to = c.req.query("to");

  if (actor) {
    entries = entries.filter((e) => e.actor === actor);
  }
  if (action) {
    entries = entries.filter((e) => e.action.includes(action));
  }
  if (from) {
    const fromDate = new Date(from).getTime();
    entries = entries.filter((e) => new Date(e.timestamp).getTime() >= fromDate);
  }
  if (to) {
    const toDate = new Date(to).getTime() + 86_400_000; // end of day
    entries = entries.filter((e) => new Date(e.timestamp).getTime() <= toDate);
  }

  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "50", 10);
  const start = (page - 1) * limit;
  const paged = entries.slice(start, start + limit);

  return c.json({
    entries: paged,
    total: entries.length,
    page,
    limit,
  });
});
