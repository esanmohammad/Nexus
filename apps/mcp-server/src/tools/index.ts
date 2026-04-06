import { sandboxCreate } from "./sandbox-create.js";
import { sandboxDeploy } from "./sandbox-deploy.js";
import { sandboxRollback } from "./sandbox-rollback.js";
import { sandboxStatus } from "./sandbox-status.js";
import { sandboxShare } from "./sandbox-share.js";
import { sandboxLogs } from "./sandbox-logs.js";
import { sandboxList } from "./sandbox-list.js";
import { sandboxDestroy } from "./sandbox-destroy.js";
import { sandboxExtend } from "./sandbox-extend.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const allTools: ToolDefinition[] = [
  sandboxCreate.definition,
  sandboxDeploy.definition,
  sandboxRollback.definition,
  sandboxStatus.definition,
  sandboxShare.definition,
  sandboxLogs.definition,
  sandboxList.definition,
  sandboxDestroy.definition,
  sandboxExtend.definition,
];

export function getAllTools(): ToolDefinition[] {
  return allTools;
}

export const handlers: Record<string, (args: any) => Promise<any>> = {
  sandbox_create: sandboxCreate.handler,
  sandbox_deploy: sandboxDeploy.handler,
  sandbox_rollback: sandboxRollback.handler,
  sandbox_status: sandboxStatus.handler,
  sandbox_share: sandboxShare.handler,
  sandbox_logs: sandboxLogs.handler,
  sandbox_list: sandboxList.handler,
  sandbox_destroy: sandboxDestroy.handler,
  sandbox_extend: sandboxExtend.handler,
};
