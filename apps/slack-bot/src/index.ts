const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN;

if (!SLACK_BOT_TOKEN) {
  throw new Error("SLACK_BOT_TOKEN environment variable is required");
}
if (!SLACK_SIGNING_SECRET) {
  throw new Error("SLACK_SIGNING_SECRET environment variable is required");
}
if (!SLACK_APP_TOKEN) {
  throw new Error("SLACK_APP_TOKEN environment variable is required");
}

import { parseMessage } from "./lib/parser.js";
import { handleCreate } from "./handlers/create.js";
import { handleDeploy } from "./handlers/deploy.js";

// In production: initialize @slack/bolt App with socket mode
// const app = new App({ token: SLACK_BOT_TOKEN, signingSecret: SLACK_SIGNING_SECRET, socketMode: true, appToken: SLACK_APP_TOKEN });

export const config = {
  botToken: SLACK_BOT_TOKEN,
  signingSecret: SLACK_SIGNING_SECRET,
  appToken: SLACK_APP_TOKEN,
  socketMode: true,
};

export { parseMessage, handleCreate, handleDeploy };
