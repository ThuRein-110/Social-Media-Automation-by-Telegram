import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { describe, expect, it } from "vitest";
import { analyzeLocalMedia } from "../src/media/mediaAnalyzer";

describe("media analyzer", () => {
  it("extracts real video metadata with ffprobe", () => {
    if (!ffmpegPath) throw new Error("ffmpeg-static unavailable");
    const dir = path.resolve(".test-data", "outputs", "media-analyzer-test");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "sample.mp4");
    execFileSync(ffmpegPath, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=720x1280:d=2",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-shortest",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      file
    ], { stdio: "ignore" });
    const result = analyzeLocalMedia(file);
    expect(result.duration ?? 0).toBeGreaterThan(1);
    expect(result.width).toBe(720);
    expect(result.height).toBe(1280);
    expect(result.technicalMetadata.hasAudio).toBe(true);
    expect(result.quality.score).toBeGreaterThan(0);
    fs.rmSync(dir, { recursive: true, force: true });
  }, 30000);
});
