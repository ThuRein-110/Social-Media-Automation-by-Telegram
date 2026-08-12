import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { analyzeAndSaveWebsite, configureMock, runProfessionalWorkflow, saveUploadedMedia } from "../server/workflow";
import { dataDir, defaultState, outputDir, readState, uploadDir, writeState } from "../server/localDb";

function createTestVideo(outputPath: string, color: string) {
  if (!ffmpegPath) throw new Error("ffmpeg-static unavailable");
  execFileSync(ffmpegPath, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${color}:s=1080x1920:d=3`,
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
    outputPath
  ], { stdio: "ignore" });
}

describe("local end-to-end workflow", () => {
  beforeEach(() => {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(uploadDir, { recursive: true });
    writeState(defaultState());
  });

  afterEach(() => {
    writeState(defaultState());
    fs.rmSync(uploadDir, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(uploadDir, { recursive: true });
  });

  it("goes from website URL to Telegram topic to mock scheduled posts", async () => {
    await analyzeAndSaveWebsite("https://example.com");
    for (const service of ["telegram", "ai", "storage", "videoWorker", "instagram", "youtube"]) {
      configureMock(service);
    }
    const fakePath = path.join(uploadDir, "reading-desk-book.mp4");
    createTestVideo(fakePath, "0x334155");
    saveUploadedMedia({
      originalname: "reading-desk-book.mp4",
      mimetype: "video/mp4",
      path: fakePath
    });
    const result = await runProfessionalWorkflow("reading vlog", "telegram");
    const state = readState();
    expect(result.creativeBrief.topic).toBe("reading vlog");
    expect(result.timeline.duration).toBe(30);
    expect(result.timeline.tracks.video.length).toBeGreaterThan(0);
    expect(fs.existsSync(result.rendered.outputPath)).toBe(true);
    expect(result.visualDirection.storyboard.scenes.length).toBeGreaterThan(0);
    expect(result.visualDirection.visualPlan.length).toBeGreaterThan(0);
    expect(fs.existsSync(result.thumbnail.path)).toBe(true);
    expect(result.qualityScore.passed).toBe(true);
    expect(state.topics.today?.source).toBe("telegram");
    expect(state.posts.some((post) => post.platform === "instagram")).toBe(true);
    expect(state.jobs.some((job) => job.type === "RENDER_VIDEO")).toBe(true);
  }, 60000);

  it("does not duplicate mock posts for the same topic retry", async () => {
    await analyzeAndSaveWebsite("https://example.com");
    for (const service of ["instagram", "ai", "storage", "videoWorker"]) configureMock(service);
    const fakePath = path.join(uploadDir, "reading-book.mp4");
    createTestVideo(fakePath, "0x1f2937");
    saveUploadedMedia({
      originalname: "reading-book.mp4",
      mimetype: "video/mp4",
      path: fakePath
    });
    await runProfessionalWorkflow("reading vlog", "telegram");
    await runProfessionalWorkflow("reading vlog", "telegram");
    const instagramPosts = readState().posts.filter((post) => post.platform === "instagram" && post.topic === "reading vlog");
    expect(instagramPosts).toHaveLength(1);
  }, 90000);
});
