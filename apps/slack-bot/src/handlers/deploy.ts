import { buildDeploySuccessMessage, buildDeployFailureMessage } from "../lib/blocks.js";

export async function handleDeploy(args: {
  name: string;
  files?: { url: string; name: string }[];
  say: (msg: any) => Promise<void>;
  threadTs?: string;
}) {
  const { name, files, say, threadTs } = args;

  if (!files || files.length === 0) {
    await say({
      text: "Please attach a ZIP file with your source code",
      thread_ts: threadTs,
    });
    return;
  }

  await say({
    text: ":hourglass_flowing_sand: Deploying...",
    thread_ts: threadTs,
  });

  try {
    // In real implementation: download ZIP, call SDK deployVersion
    const sandbox = {
      id: "existing-sandbox",
      name,
      cloud_run_url: `https://sandbox-${name}.nexus.app`,
      state: "running",
      current_version: 2,
    };
    const version = { number: 2, status: "live" };

    const msg = buildDeploySuccessMessage(sandbox, version);
    await say({ ...msg, thread_ts: threadTs });
  } catch (err: any) {
    const sandbox = { id: "", name, state: "failed" };
    const msg = buildDeployFailureMessage(sandbox, err.message);
    await say({ ...msg, thread_ts: threadTs });
  }
}
