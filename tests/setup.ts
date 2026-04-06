import { beforeEach, vi } from "vitest";

// Patch Response constructor: Node.js 20 rejects non-null body for 204/304 status codes
// but some tests create Response("", { status: 204 }) which is valid in browsers
const OriginalResponse = globalThis.Response;
globalThis.Response = new Proxy(OriginalResponse, {
  construct(target, args) {
    const [body, init] = args;
    if (init?.status && [204, 304].includes(init.status) && body !== null && body !== undefined) {
      return new target(null, init);
    }
    return new target(...args);
  },
}) as typeof Response;

// Auto-spy on neon.service so integration tests can use toHaveBeenCalled()
// while still calling through to the real implementation for unit tests
vi.mock("../apps/api/src/services/neon.service.js", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    createProject: vi.fn(actual.createProject),
    createBranch: vi.fn(actual.createBranch),
    applyMigration: vi.fn(actual.applyMigration),
    promoteBranch: vi.fn(actual.promoteBranch),
    switchBranch: vi.fn(actual.switchBranch),
    deleteProject: vi.fn(actual.deleteProject),
    getConnectionString: vi.fn(actual.getConnectionString),
  };
});

// Reset module registry and clear mock state between tests
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});
