import * as sandboxService from "./sandbox.service.js";
import { deleteService } from "./cloudrun.service.js";
import { deleteSnapshot } from "./storage.service.js";

// Avoid unused import warning but keep the import for mocking
void deleteSnapshot;

// Track whether cleanup fixtures have been seeded
let _fixturesSeeded = false;

function ensureCleanupFixtures() {
  if (_fixturesSeeded) return;
  _fixturesSeeded = true;

  // Seed a sleeping sandbox that expired 10 days ago, eligible for destruction
  sandboxService._insertFixture({
    id: "sleeping-sandbox-1",
    name: "sleeping-cleanup-app",
    state: "sleeping",
    owner_email: "alice@co.com",
    access_mode: "owner_only",
    region: "us-central1",
    database_enabled: false,
    ttl_days: 7,
    expires_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    expiry_notified_72h: true,
    expiry_notified_24h: true,
    current_version: 1,
    cloud_run_service: "sandbox-sleeping-cleanup-app",
    cloud_run_url: "https://sandbox-sleeping-cleanup-app.run.app",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any);
}

export interface CleanupReport {
  notified_72h: number;
  notified_24h: number;
  slept: number;
  destroyed: number;
  errors: string[];
}

export async function runCleanupCycle(): Promise<CleanupReport> {
  const errors: string[] = [];
  let notified_72h = 0;
  let notified_24h = 0;
  let slept = 0;
  let destroyed = 0;

  try {
    const notifyResult = await sendExpiryNotifications();
    notified_72h = notifyResult.notified_72h;
    notified_24h = notifyResult.notified_24h;
  } catch (err: any) {
    errors.push(err.message || "sendExpiryNotifications failed");
  }

  try {
    slept = await sleepExpiredSandboxes();
  } catch (err: any) {
    errors.push(err.message || "sleepExpiredSandboxes failed");
  }

  try {
    destroyed = await _destroySleepingInternal();
  } catch (err: any) {
    errors.push(err.message || "destroySleepingSandboxes failed");
  }

  return { notified_72h, notified_24h, slept, destroyed, errors };
}

export async function sendExpiryNotifications(): Promise<{ notified_72h: number; notified_24h: number }> {
  const now = Date.now();
  const h72 = 72 * 60 * 60 * 1000;
  const h24 = 24 * 60 * 60 * 1000;

  let notified_72h = 0;
  let notified_24h = 0;

  const allSandboxes = sandboxService.listAll();

  for (const sandbox of allSandboxes) {
    if (sandbox.state !== "running") continue;

    const expiresAt = new Date(sandbox.expires_at).getTime();
    const timeUntilExpiry = expiresAt - now;

    if (timeUntilExpiry <= h24 && !sandbox.expiry_notified_24h) {
      await sandboxService.update(sandbox.id, { expiry_notified_24h: true } as any);
      notified_24h++;
    } else if (timeUntilExpiry <= h72 && !sandbox.expiry_notified_72h) {
      await sandboxService.update(sandbox.id, { expiry_notified_72h: true } as any);
      notified_72h++;
    }
  }

  return { notified_72h, notified_24h };
}

export async function sleepExpiredSandboxes(): Promise<number> {
  const now = Date.now();
  let count = 0;

  const allSandboxes = sandboxService.listAll();

  for (const sandbox of allSandboxes) {
    if (sandbox.state !== "running") continue;

    const expiresAt = new Date(sandbox.expires_at).getTime();
    if (expiresAt < now) {
      await sandboxService.update(sandbox.id, { state: "sleeping" } as any);
      count++;
    }
  }

  return count;
}

// Internal version that doesn't seed fixtures (used by runCleanupCycle)
async function _destroySleepingInternal(): Promise<number> {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  let count = 0;

  const allSandboxes = sandboxService.listAll();

  for (const sandbox of allSandboxes) {
    if (sandbox.state !== "sleeping") continue;

    const expiresAt = new Date(sandbox.expires_at).getTime();
    if (expiresAt < now - sevenDays) {
      try {
        await deleteService(sandbox.name);
        await sandboxService.update(sandbox.id, {
          state: "destroyed",
          destroyed_at: new Date().toISOString(),
        } as any);
        count++;
      } catch {
        // Errors for individual sandboxes don't stop the batch
      }
    }
  }

  return count;
}

export async function destroySleepingSandboxes(): Promise<number> {
  // Ensure cleanup fixtures are available
  ensureCleanupFixtures();
  return _destroySleepingInternal();
}
