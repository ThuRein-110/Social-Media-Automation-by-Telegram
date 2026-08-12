import { describe, expect, it } from "vitest";
import { MediaItem } from "../src/domain";
import { validateVideoEditPlan } from "../src/video/validator";

const media: MediaItem[] = [{
  id: "m1",
  ownerId: "u1",
  filename: "reading.mp4",
  storageUrl: "mock://reading.mp4",
  type: "video",
  duration: 20,
  createdAt: new Date().toISOString(),
  uploadedAt: new Date().toISOString(),
  tags: [],
  aiTags: [],
  description: "",
  usedCount: 0,
  platformUsage: {},
  topics: [],
  status: "READY"
}];

describe("Video edit plan validation", () => {
  it("accepts a strict valid edit plan", () => {
    const plan = validateVideoEditPlan({
      topic: "reading vlog",
      aspectRatio: "9:16",
      resolution: "1080x1920",
      targetDurationSeconds: 15,
      clips: [{ mediaId: "m1", start: 0, end: 10, reason: "matches topic" }],
      subtitles: true,
      removeSilence: true,
      normalizeAudio: true,
      hookText: "Reading today",
      outroText: "Follow for more",
      transitionStyle: "cut",
      pace: "standard",
      musicMood: "calm"
    }, media);
    expect(plan.topic).toBe("reading vlog");
  });

  it("rejects unknown media ids", () => {
    expect(() => validateVideoEditPlan({
      topic: "reading vlog",
      aspectRatio: "9:16",
      resolution: "1080x1920",
      targetDurationSeconds: 15,
      clips: [{ mediaId: "missing", start: 0, end: 10, reason: "bad" }],
      subtitles: true,
      removeSilence: true,
      normalizeAudio: true,
      hookText: "Reading today",
      outroText: "Follow for more",
      transitionStyle: "cut",
      pace: "standard",
      musicMood: "calm"
    }, media)).toThrow("Unknown mediaId");
  });
});
