import { getConfig, saveConfig } from "./config.js";

export async function getToken(): Promise<string | null> {
  const config = await getConfig();
  return config.token || null;
}

export async function saveToken(token: string): Promise<void> {
  await saveConfig({ token });
}
