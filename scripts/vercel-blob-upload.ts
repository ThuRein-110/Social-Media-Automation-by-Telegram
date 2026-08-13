import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { loadLocalEnv } from "../server/secrets";
import { readState } from "../server/localDb";

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

export async function uploadVideoToVercelBlob(videoPath: string) {
  loadLocalEnv();
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is missing. Create/connect a Vercel Blob store and pull env vars locally.");
  }
  if (!fs.existsSync(videoPath)) throw new Error(`Video file not found: ${videoPath}`);

  const filename = path.basename(videoPath).replace(/[^\w.-]+/g, "-");
  const blobPath = `social-agent/videos/${Date.now()}-${filename}`;
  const blob = await put(blobPath, fs.createReadStream(videoPath), {
    access: "public",
    contentType: "video/mp4"
  });
  return blob.url;
}

async function main() {
  const videoPath = latestVideoPath();
  const url = await uploadVideoToVercelBlob(videoPath);
  console.log(JSON.stringify({ ok: true, videoPath, url }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Vercel Blob upload failed.");
  process.exit(1);
});
