import { beforeEach, vi } from "vitest";

// Reset module registry between tests so dynamic imports get fresh modules
beforeEach(() => {
  vi.resetModules();
});
