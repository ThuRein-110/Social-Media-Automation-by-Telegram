import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { MediaItemSchema } from "../src/domain";
import { analyzeLocalMedia } from "../src/media/mediaAnalyzer";
import { addEvent, updateState, uploadDir } from "./localDb";

interface CommonsPage {
  title: string;
  imageinfo?: Array<{
    url?: string;
    mime?: string;
    size?: number;
    extmetadata?: Record<string, { value?: string }>;
  }>;
}

function stripHtml(value = "") {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function safeFilename(value: string) {
  return value
    .replace(/^File:/i, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);
}

function extensionFromUrl(url: string) {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname);
  return ext || ".webm";
}

async function searchCommonsVideos(query: string, limit: number) {
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  api.searchParams.set("action", "query");
  api.searchParams.set("format", "json");
  api.searchParams.set("generator", "search");
  api.searchParams.set("gsrnamespace", "6");
  api.searchParams.set("gsrlimit", String(Math.min(Math.max(limit * 4, 5), 20)));
  api.searchParams.set("gsrsearch", `${query} filetype:video`);
  api.searchParams.set("prop", "imageinfo");
  api.searchParams.set("iiprop", "url|mime|size|extmetadata");

  const response = await fetch(api, { headers: { "user-agent": "SocialAgentLocal/0.1 (local automation)" } });
  if (!response.ok) throw new Error(`Wikimedia search failed: ${response.status}`);
  const data = await response.json() as { query?: { pages?: Record<string, CommonsPage> } };
  return Object.values(data.query?.pages ?? {})
    .map((page) => ({ page, info: page.imageinfo?.[0] }))
    .filter((item) => item.info?.url && (item.info.mime?.startsWith("video/") || item.info.mime === "application/ogg"))
    .filter((item) => !item.info?.size || item.info.size < 80 * 1024 * 1024)
    .slice(0, limit);
}

async function searchWithFallbacks(topic: string, limit: number) {
  const words = topic.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  const cinematic = /movie|film|scene|cinematic|cinema/.test(topic.toLowerCase());
  const emotional = /time|yourself|alone|quiet|slow|motivation|story|vlog|reading|thinking|walking|night|rain|library/.test(topic.toLowerCase());
  const fallbacks = [
    topic,
    words.join(" "),
    words[0],
    ...(cinematic || emotional ? [
      "public domain film quiet scene",
      "silent film walking",
      "public domain film reading",
      "archive film city night",
      "public domain film person alone",
      "public domain film library",
      "public domain film",
      "silent film",
      "cinema",
      "movie scene",
      "film noir",
      "dramatic scene"
    ] : [
      "reading",
      "book",
      "study"
    ]),
    "city",
    "nature"
  ].filter(Boolean);
  const seen = new Set<string>();
  for (const query of fallbacks) {
    if (seen.has(query)) continue;
    seen.add(query);
    const found = await searchCommonsVideos(query, limit);
    if (found.length) return found;
  }
  return [];
}

async function downloadClip(url: string, filename: string) {
  fs.mkdirSync(uploadDir, { recursive: true });
  const target = path.join(uploadDir, `${crypto.randomUUID()}-${filename}`);
  const response = await fetch(url, { headers: { "user-agent": "SocialAgentLocal/0.1 (local automation)" } });
  if (!response.ok || !response.body) throw new Error(`Could not download clip: ${response.status}`);
  await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(target));
  return target;
}

export async function collectOnlineClips(topic: string, count = 2) {
  const trimmed = topic.trim();
  if (!trimmed) throw new Error("Topic is required to collect online clips.");
  const found = await searchWithFallbacks(trimmed, Math.max(count, count * 3));
  if (found.length === 0) throw new Error(`No reusable online video clips found for "${trimmed}". Try a simpler topic.`);

  const imported = [];
  for (const { page, info } of found) {
    if (imported.length >= count) break;
    if (!info?.url) continue;
    const sourceUrl = info.url;
    const filename = `${safeFilename(page.title)}${extensionFromUrl(sourceUrl)}`;
    let localPath: string;
    try {
      localPath = await downloadClip(sourceUrl, filename);
    } catch (error) {
      addEvent(`Skipped online clip download: ${error instanceof Error ? error.message : "download failed"}`, "warning");
      continue;
    }
    let analysis;
    try {
      analysis = analyzeLocalMedia(localPath);
    } catch (error) {
      addEvent(`Skipped unreadable online clip: ${filename}`, "warning");
      continue;
    }
    const license = stripHtml(info.extmetadata?.LicenseShortName?.value || info.extmetadata?.UsageTerms?.value || "See Wikimedia Commons source");
    const credit = stripHtml(info.extmetadata?.Artist?.value || info.extmetadata?.Credit?.value || "Wikimedia Commons contributor");
    const item = MediaItemSchema.parse({
      id: crypto.randomUUID(),
      ownerId: "local",
      filename,
      storageUrl: `/uploads/${path.basename(localPath)}`,
      type: "video",
      duration: analysis.duration,
      width: analysis.width,
      height: analysis.height,
      createdAt: new Date().toISOString(),
      uploadedAt: new Date().toISOString(),
      tags: ["online", "reusable", "wikimedia"],
      aiTags: [trimmed.toLowerCase(), "online-clip"],
      description: `Reusable online clip collected from Wikimedia Commons. Source: ${page.title}. License: ${license}. Credit: ${credit}. URL: ${sourceUrl}`,
      transcript: "Online clip imported for local editing. Review source/license before publishing.",
      usedCount: 0,
      platformUsage: {},
      topics: [trimmed.toLowerCase()],
      technicalMetadata: analysis.technicalMetadata,
      quality: analysis.quality,
      status: "READY"
    });
    imported.push(item);
  }

  updateState((state) => {
    state.media.unshift(...imported);
    if (state.connections.storage === "not_configured") state.connections.storage = "mock";
  });
  addEvent(`Collected ${imported.length} reusable online clip${imported.length === 1 ? "" : "s"} for ${trimmed}`);
  return { topic: trimmed, imported };
}
