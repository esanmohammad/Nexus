export const SandboxState = {
  CREATING: "creating",
  RUNNING: "running",
  SLEEPING: "sleeping",
  DESTROYING: "destroying",
  DESTROYED: "destroyed",
} as const;
export type SandboxState = (typeof SandboxState)[keyof typeof SandboxState];

export const VersionStatus = {
  BUILDING: "building",
  LIVE: "live",
  ROLLED_BACK: "rolled_back",
  FAILED: "failed",
} as const;
export type VersionStatus = (typeof VersionStatus)[keyof typeof VersionStatus];

export const AccessMode = {
  OWNER_ONLY: "owner_only",
  TEAM: "team",
  ANYONE: "anyone",
  CUSTOM: "custom",
} as const;
export type AccessMode = (typeof AccessMode)[keyof typeof AccessMode];

export const Runtime = {
  NODEJS: "nodejs",
  PYTHON: "python",
  STATIC: "static",
  GO: "go",
  DOCKERFILE: "dockerfile",
} as const;
export type Runtime = (typeof Runtime)[keyof typeof Runtime];

export const DatabaseState = {
  PROVISIONING: "provisioning",
  READY: "ready",
  DESTROYING: "destroying",
  DESTROYED: "destroyed",
} as const;
export type DatabaseState = (typeof DatabaseState)[keyof typeof DatabaseState];

export const SandboxMaturity = {
  THROWAWAY: "throwaway",
  INCUBATING: "incubating",
  ESTABLISHED: "established",
  GRADUATED: "graduated",
} as const;
export type SandboxMaturity =
  (typeof SandboxMaturity)[keyof typeof SandboxMaturity];
