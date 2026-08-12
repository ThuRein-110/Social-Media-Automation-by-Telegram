import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

export interface RenderFrameReview {
  checkedAt: string;
  frameDir: string;
  frames: string[];
  checks: Array<{ name: string; passed: boolean; detail: string }>;
}

export function reviewRenderedFrames(videoPath: string, outputDir: string, durationSeconds: number): RenderFrameReview {
  if (!ffmpegPath) throw new Error("Bundled FFmpeg is unavailable.");
  const ffmpeg = ffmpegPath;
  const frameDir = path.join(outputDir, "frame-review");
  fs.mkdirSync(frameDir, { recursive: true });
  const timestamps = [0.25, durationSeconds * 0.25, durationSeconds * 0.5, durationSeconds * 0.75, Math.max(0.5, durationSeconds - 0.35)];
  const frames: string[] = [];
  timestamps.forEach((time, index) => {
    const framePath = path.join(frameDir, `frame-${String(index + 1).padStart(2, "0")}.jpg`);
    execFileSync(ffmpeg, [
      "-y",
      "-ss",
      time.toFixed(2),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      framePath
    ], { stdio: "pipe" });
    frames.push(framePath);
  });
  const missing = frames.filter((frame) => !fs.existsSync(frame) || fs.statSync(frame).size < 2048);
  return {
    checkedAt: new Date().toISOString(),
    frameDir,
    frames,
    checks: [
      { name: "Representative frames extracted", passed: missing.length === 0, detail: `${frames.length - missing.length}/${frames.length} usable frames` },
      { name: "First-frame inspection available", passed: fs.existsSync(frames[0]), detail: frames[0] },
      { name: "Ending-frame inspection available", passed: fs.existsSync(frames[frames.length - 1]), detail: frames[frames.length - 1] }
    ]
  };
}
