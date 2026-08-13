import path from "node:path";
import { loadLocalEnv } from "../server/secrets";
import { addEvent, outputDir, readState } from "../server/localDb";
import { uploadVideoToVercelBlob } from "./vercel-blob-upload";

type BufferCreatePostResponse = {
  createPost:
    | {
      post?: {
        id: string;
        text?: string;
        dueAt?: string;
        assets?: Array<{ id?: string; mimeType?: string; source?: string }>;
      };
      message?: string;
    }
    | null;
};

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing.`);
  return value;
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

async function publicUrlForLatestVideo() {
  const explicit = argValue("--video-url") ?? process.env.BUFFER_PUBLIC_VIDEO_URL;
  if (explicit) return explicit;

  const localPath = latestVideoPath();
  if (process.env.BLOB_READ_WRITE_TOKEN) return uploadVideoToVercelBlob(localPath);

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

async function bufferGraphql<T>(query: string, variables: Record<string, unknown>) {
  const response = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${requiredEnv("BUFFER_API_KEY")}`
    },
    body: JSON.stringify({ query, variables })
  });
  const data = await response.json() as { data?: T; errors?: Array<{ message?: string }> };
  if (!response.ok || data.errors?.length) {
    throw new Error(data.errors?.[0]?.message ?? `Buffer API failed with HTTP ${response.status}`);
  }
  return data.data as T;
}

async function main() {
  loadLocalEnv();
  const channelId = argValue("--channel-id") ?? requiredEnv("BUFFER_TIKTOK_CHANNEL_ID");
  const videoUrl = await publicUrlForLatestVideo();
  const text = captionForLatest();
  const publishAt = dueAt();

  const data = await bufferGraphql<BufferCreatePostResponse>(
    `mutation ScheduleVideoPost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
            text
            dueAt
            assets {
              id
              mimeType
              source
            }
          }
        }
        ... on MutationError {
          message
        }
      }
    }`,
    {
      input: {
        text,
        channelId,
        schedulingType: "automatic",
        mode: "customScheduled",
        dueAt: publishAt,
        aiAssisted: true,
        assets: [
          {
            video: {
              url: videoUrl,
              metadata: { thumbnailOffset: 1000 }
            }
          }
        ]
      }
    }
  );

  const result = data.createPost;
  if (!result?.post) throw new Error(result?.message ?? "Buffer did not create the scheduled post.");
  addEvent(`Buffer scheduled TikTok post ${result.post.id} for ${result.post.dueAt}`);
  console.log(JSON.stringify({
    ok: true,
    postId: result.post.id,
    dueAt: result.post.dueAt,
    videoUrl
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Buffer schedule failed.");
  process.exit(1);
});
