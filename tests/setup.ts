import { beforeEach, vi } from "vitest";

// Reset module registry and clear mock state between tests
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});
