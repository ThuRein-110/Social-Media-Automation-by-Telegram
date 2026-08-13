import fs from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "../server/secrets";
import { addEvent, readState } from "../server/localDb";

type TikTokInitResponse = {
  data?: {
    publish_id?: string;
    upload_url?: string;
  };
  error?: {
    code?: string;
    message?: string;
    log_id?: string;
  };
};

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function latestProductionDefaults() {
  const latest = readState().productions[0];
  if (!latest) return {};
  const exports = latest.platformExports as Record<string, string> | undefined;
  return {
    videoPath: exports?.tiktok ?? latest.renderPath,
    caption: latest.caption ?? latest.voiceoverScript ?? latest.topic
  };
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing. TikTok auto-upload needs an OAuth user access token with video.publish or video.upload scope.`);
  return value;
}

async function tiktokJson(endpoint: string, token: string, body: unknown) {
  const response = await fetch(`https://open.tiktokapis.com${endpoint}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=UTF-8"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({})) as TikTokInitResponse;
  if (!response.ok || data.error?.code) {
    const message = data.error?.message || data.error?.code || `TikTok request failed with HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function uploadBinary(uploadUrl: string, videoPath: string, size: number) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": "video/mp4",
      "content-length": String(size),
      "content-range": `bytes 0-${size - 1}/${size}`
    },
    body: fs.readFileSync(videoPath)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`TikTok binary upload failed with HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
}

async function main() {
  loadLocalEnv();
  const defaults = latestProductionDefaults();
  const videoPath = path.resolve(argValue("--video") ?? defaults.videoPath ?? "");
  const caption = (argValue("--caption") ?? defaults.caption ?? "New video").slice(0, 2200);
  const mode = (argValue("--mode") ?? process.env.TIKTOK_POST_MODE ?? "direct").toLowerCase();
  const token = requiredEnv("TIKTOK_ACCESS_TOKEN");

  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error("Video file not found. Use --video path\\to\\video.mp4 or create a video first.");
  }

  const size = fs.statSync(videoPath).size;
  const sourceInfo = {
    source: "FILE_UPLOAD",
    video_size: size,
    chunk_size: size,
    total_chunk_count: 1
  };

  const endpoint = mode === "draft" || mode === "upload"
    ? "/v2/post/publish/inbox/video/init/"
    : "/v2/post/publish/video/init/";

  const body = endpoint.includes("/inbox/")
    ? { source_info: sourceInfo }
    : {
      post_info: {
        title: caption,
        privacy_level: process.env.TIKTOK_PRIVACY_LEVEL ?? "SELF_ONLY",
        disable_duet: false,
        disable_stitch: false,
        disable_comment: false,
        video_cover_timestamp_ms: 1000,
        brand_content_toggle: false,
        brand_organic_toggle: false,
        is_aigc: (process.env.TIKTOK_IS_AIGC ?? "true").toLowerCase() !== "false"
      },
      source_info: sourceInfo
    };

  const init = await tiktokJson(endpoint, token, body);
  const uploadUrl = init.data?.upload_url;
  if (!uploadUrl) throw new Error("TikTok did not return an upload_url. Check app scope approval and access token permissions.");

  await uploadBinary(uploadUrl, videoPath, size);
  addEvent(`TikTok ${endpoint.includes("/inbox/") ? "draft upload" : "direct post"} sent: ${path.basename(videoPath)}`);
  console.log(JSON.stringify({
    ok: true,
    mode: endpoint.includes("/inbox/") ? "draft" : "direct",
    publishId: init.data?.publish_id,
    videoPath
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "TikTok upload failed.");
  process.exit(1);
});
