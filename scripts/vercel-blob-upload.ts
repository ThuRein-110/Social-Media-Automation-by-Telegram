import fs from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "../server/secrets";
import { readState } from "../server/localDb";
import { uploadVideoToVercelBlob } from "../server/bufferPublisher";

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function latestVideoPath() {
  const explicit = argValue("--video");
  if (explicit) return path.resolve(explicit);

  const latest = readState().productions[0];
  if (!latest) throw new Error("No video has been created yet. Run the agent first.");
  const exports = latest.platformExports as Record<string, string> | undefined;
  return path.resolve(exports?.tiktok ?? latest.renderPath);
}

async function main() {
  const videoPath = latestVideoPath();
  if (!fs.existsSync(videoPath)) throw new Error(`Video file not found: ${videoPath}`);
  const url = await uploadVideoToVercelBlob(videoPath);
  console.log(JSON.stringify({ ok: true, videoPath, url }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Vercel Blob upload failed.");
  process.exit(1);
});
