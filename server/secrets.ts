import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(rootDir, ".env.local");

export const secretRequirements: Record<string, string[]> = {
  telegram: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_ALLOWED_USER_IDS"],
  instagram: [],
  facebook: [],
  youtube: [],
  tiktok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REDIRECT_URI"],
  buffer: ["BUFFER_API_KEY", "BUFFER_TIKTOK_CHANNEL_ID", "BUFFER_INSTAGRAM_CHANNEL_ID", "BUFFER_FACEBOOK_CHANNEL_ID", "BLOB_READ_WRITE_TOKEN"],
  ai: ["OPENAI_API_KEY"],
  storage: [],
  videoWorker: [],
  website: []
};

const optionalSecretKeys: Record<string, string[]> = {
  tiktok: ["TIKTOK_ACCESS_TOKEN", "TIKTOK_REFRESH_TOKEN"]
};

const allowedKeys = new Set([
  ...Object.values(secretRequirements).flat(),
  ...Object.values(optionalSecretKeys).flat()
]);

export function loadLocalEnv(): void {
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: true, quiet: true });
}

function parseEnvFile(): Record<string, string> {
  if (!fs.existsSync(envPath)) return {};
  return dotenv.parse(fs.readFileSync(envPath));
}

function serializeEnv(values: Record<string, string>): string {
  return Object.entries(values)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join("\n") + "\n";
}

export function saveSecrets(values: Record<string, string>): { saved: string[]; ignored: string[] } {
  const current = parseEnvFile();
  const saved: string[] = [];
  const ignored: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (!allowedKeys.has(key)) {
      ignored.push(key);
      continue;
    }
    if (!value.trim()) continue;
    current[key] = value.trim();
    process.env[key] = value.trim();
    saved.push(key);
  }
  fs.writeFileSync(envPath, serializeEnv(current));
  return { saved, ignored };
}

export function getSecretStatus(service?: string): Record<string, Record<string, boolean>> {
  loadLocalEnv();
  const services = service ? [service] : Object.keys(secretRequirements);
  const status: Record<string, Record<string, boolean>> = {};
  for (const name of services) {
    status[name] = {};
    for (const key of [...(secretRequirements[name] ?? []), ...(optionalSecretKeys[name] ?? [])]) {
      status[name][key] = Boolean(process.env[key]);
    }
  }
  return status;
}
