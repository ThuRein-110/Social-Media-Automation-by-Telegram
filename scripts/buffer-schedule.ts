import path from "node:path";
import { loadLocalEnv } from "../server/secrets";
import { outputDir, readState } from "../server/localDb";
import { scheduleBufferPlatformPosts, scheduleBufferPost } from "../server/bufferPublisher";
import { Platform } from "../src/domain";

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function latestProduction() {
  const latest = readState().productions[0];
  if (!latest) throw new Error("No video has been created yet. Run the agent first.");
  return latest;
}

function latestVideoPath() {
  const latest = latestProduction();
  const exports = latest.platformExports as Record<string, string> | undefined;
  return exports?.tiktok ?? latest.renderPath;
}

function publicUrlForLatestVideo() {
  const explicit = argValue("--video-url") ?? process.env.BUFFER_PUBLIC_VIDEO_URL;
  if (explicit) return explicit;

  const localPath = latestVideoPath();
  if (process.env.BLOB_READ_WRITE_TOKEN) return undefined;

  const baseUrl = process.env.BUFFER_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("Buffer needs a public MP4 URL. Set BLOB_READ_WRITE_TOKEN for Vercel Blob, or set BUFFER_PUBLIC_VIDEO_URL / BUFFER_PUBLIC_BASE_URL.");
  }

  const relative = path.relative(outputDir, localPath).split(path.sep).map(encodeURIComponent).join("/");
  if (relative.startsWith("..")) throw new Error("Latest video is not inside the outputs folder.");
  return `${baseUrl}/outputs/${relative}`;
}

function captionForLatest() {
  const explicit = argValue("--caption");
  if (explicit) return explicit;
  const latest = latestProduction();
  return latest.caption?.trim() || latest.voiceoverScript || latest.topic;
}

function dueAt() {
  const explicit = argValue("--due-at") ?? process.env.BUFFER_DUE_AT;
  if (explicit) return new Date(explicit).toISOString();
  const minutes = Number(argValue("--minutes") ?? process.env.BUFFER_SCHEDULE_MINUTES ?? "10");
  return new Date(Date.now() + Math.max(2, minutes) * 60_000).toISOString();
}

async function main() {
  loadLocalEnv();
  const platformArg = argValue("--platform");
  const base = {
    videoPath: latestVideoPath(),
    caption: captionForLatest(),
    dueAt: dueAt(),
    videoUrl: publicUrlForLatestVideo()
  };
  const result = platformArg
    ? [await scheduleBufferPost({ ...base, platform: platformArg as Platform, channelId: argValue("--channel-id") })]
    : await scheduleBufferPlatformPosts({ ...base, platforms: ["tiktok", "instagram", "facebook"] });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Buffer schedule failed.");
  process.exit(1);
});
