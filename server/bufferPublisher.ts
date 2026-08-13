import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { addEvent } from "./localDb";
import { loadLocalEnv } from "./secrets";

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

export interface BufferScheduleResult {
  ok: true;
  postId: string;
  dueAt?: string;
  videoUrl: string;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing.`);
  return value;
}

export function bufferAutomationReady() {
  loadLocalEnv();
  return Boolean(
    process.env.BUFFER_API_KEY &&
    process.env.BUFFER_TIKTOK_CHANNEL_ID &&
    (process.env.BLOB_READ_WRITE_TOKEN || process.env.BUFFER_PUBLIC_VIDEO_URL || process.env.BUFFER_PUBLIC_BASE_URL)
  );
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

export async function scheduleBufferTikTokPost(options: {
  videoPath: string;
  caption: string;
  dueAt: string;
  videoUrl?: string;
  channelId?: string;
}): Promise<BufferScheduleResult> {
  loadLocalEnv();
  const videoUrl = options.videoUrl ?? process.env.BUFFER_PUBLIC_VIDEO_URL ?? await uploadVideoToVercelBlob(options.videoPath);
  const channelId = options.channelId ?? requiredEnv("BUFFER_TIKTOK_CHANNEL_ID");

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
        text: options.caption.slice(0, 2200),
        channelId,
        schedulingType: "automatic",
        mode: "customScheduled",
        dueAt: options.dueAt,
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
  if (!result?.post?.id) throw new Error(result?.message ?? "Buffer did not create the scheduled post.");
  addEvent(`Buffer scheduled TikTok post ${result.post.id} for ${result.post.dueAt}`);
  return { ok: true, postId: result.post.id, dueAt: result.post.dueAt, videoUrl };
}
