import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { Platform, ThumbnailResult, ThumbnailResultSchema } from "../domain";

function titleText(topic: string): string {
  const words = topic.toUpperCase().split(/\W+/).filter(Boolean);
  return words.slice(0, 4).join(" ") || "TODAY";
}

export function createThumbnail(videoPath: string, topic: string, outputPath: string, platform: Platform = "youtube"): ThumbnailResult {
  if (!ffmpegPath) throw new Error("Bundled FFmpeg is unavailable.");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const text = titleText(topic);
  execFileSync(ffmpegPath, [
    "-y",
    "-ss",
    "0.6",
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-vf",
    `scale=1080:1920,drawbox=x=60:y=120:w=960:h=220:color=black@0.55:t=fill,drawtext=text='${text.replace(/'/g, "\\'")}':fontcolor=white:fontsize=64:x=90:y=180`,
    outputPath
  ], { stdio: "pipe" });
  return ThumbnailResultSchema.parse({
    path: outputPath,
    text,
    platform,
    generatedAt: new Date().toISOString()
  });
}
