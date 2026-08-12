import fs from "node:fs";
import { execFileSync } from "node:child_process";
import ffprobeStatic from "ffprobe-static";
import { ContentValidationResult, MediaItem, ProductionQualityScore, ProductionQualityScoreSchema, Storyboard, VideoTimeline, VisualPlan } from "../domain";

export interface VideoQualityCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface VideoQualityReport {
  ready: boolean;
  score: number;
  summary: string;
  outputPath: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  codec?: string;
  hasAudio: boolean;
  checks: VideoQualityCheck[];
  improvements: string[];
}

interface ProbeInfo {
  duration?: number;
  width?: number;
  height?: number;
  codec?: string;
  hasAudio: boolean;
}

function probeVideo(outputPath: string): ProbeInfo {
  if (!ffprobeStatic.path || !fs.existsSync(outputPath)) return { hasAudio: false };
  try {
    const raw = execFileSync(ffprobeStatic.path, [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,codec_name,width,height",
      "-of",
      "json",
      outputPath
    ], { encoding: "utf8" });
    const data = JSON.parse(raw) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number }>;
    };
    const video = data.streams?.find((stream) => stream.codec_type === "video");
    return {
      duration: Number(data.format?.duration) || undefined,
      width: video?.width,
      height: video?.height,
      codec: video?.codec_name,
      hasAudio: Boolean(data.streams?.some((stream) => stream.codec_type === "audio"))
    };
  } catch {
    return { hasAudio: false };
  }
}

export function validateRenderedVideo(outputPath: string): ContentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!fs.existsSync(outputPath)) errors.push("render_missing");
  else if (fs.statSync(outputPath).size < 1024) errors.push("render_too_small");
  else if (ffprobeStatic.path) {
    try {
      const duration = Number(execFileSync(ffprobeStatic.path, [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        outputPath
      ], { encoding: "utf8" }).trim());
      if (duration < 24) errors.push("render_too_short");
    } catch {
      warnings.push("duration_check_failed");
    }
  }
  return {
    passed: errors.length === 0,
    checks: ["file_exists", "non_empty_mp4", "mock_rights_ledger"],
    warnings,
    errors
  };
}

export function scoreProduction(outputPath: string, storyboard: Storyboard, visualPlan: VisualPlan[], hasVoiceOver: boolean): ProductionQualityScore {
  const fileOk = fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1024;
  const hasIntentionalHook = storyboard.scenes.some((scene) => scene.purpose === "HOOK" && scene.text);
  const visualVariety = new Set(visualPlan.map((plan) => plan.visualType)).size;
  const score = ProductionQualityScoreSchema.parse({
    story: storyboard.scenes.length >= 3 ? 8 : 6,
    hook: hasIntentionalHook ? 8 : 5,
    visualRelevance: visualPlan.every((plan) => plan.reason.length > 0) ? 8 : 6,
    visualVariety: Math.min(10, 5 + visualVariety),
    editing: storyboard.scenes.length >= 3 ? 7 : 6,
    narration: hasVoiceOver ? 8 : 5,
    audio: hasVoiceOver ? 7 : 5,
    subtitles: 8,
    brandConsistency: 7,
    technicalQuality: fileOk ? 8 : 2,
    passed: fileOk && hasIntentionalHook && storyboard.scenes.length >= 3,
    notes: [
      fileOk ? "Rendered MP4 exists and is non-empty." : "Rendered MP4 missing or too small.",
      `${visualVariety} visual treatment type${visualVariety === 1 ? "" : "s"} used.`,
      hasVoiceOver ? "Voice-over track planned." : "No voice-over track."
    ]
  });
  return score;
}

export function createVideoQualityReport(
  outputPath: string,
  timeline: VideoTimeline,
  media: MediaItem[],
  qualityScore: ProductionQualityScore,
  validation: ContentValidationResult,
  hasVoiceOver: boolean,
  voiceWarning?: string
): VideoQualityReport {
  const fileExists = fs.existsSync(outputPath);
  const fileSize = fileExists ? fs.statSync(outputPath).size : 0;
  const probe = probeVideo(outputPath);
  const duration = probe.duration ?? timeline.duration;
  const sourceCount = new Set(timeline.tracks.video.map((shot) => shot.mediaId)).size;
  const reusableSources = media.every((item) => {
    const text = `${item.storageUrl} ${item.description ?? ""} ${item.tags.join(" ")}`.toLowerCase();
    return !text.includes("copyrighted") && !text.includes("unknown rights");
  });
  const captionBeats = timeline.tracks.text.length + timeline.tracks.subtitles.length;

  const checks: VideoQualityCheck[] = [
    { name: "File created", passed: fileExists && fileSize > 1024, detail: fileExists ? `${Math.round(fileSize / 1024 / 1024)} MB` : "Missing render file" },
    { name: "Reel length", passed: duration >= 25 && duration <= 35, detail: `${duration.toFixed(1)} seconds, target is about 30` },
    { name: "Vertical format", passed: probe.width === 1080 && probe.height === 1920, detail: probe.width && probe.height ? `${probe.width}x${probe.height}` : "Could not read size" },
    { name: "Posting codec", passed: probe.codec === "h264", detail: probe.codec ? `${probe.codec} video` : "Could not read codec" },
    { name: "Audio track", passed: probe.hasAudio, detail: probe.hasAudio ? (hasVoiceOver ? "Voice/music track present" : "Music bed present") : "No audio stream found" },
    { name: "Shot variety", passed: timeline.tracks.video.length >= 5 && sourceCount >= 2, detail: `${timeline.tracks.video.length} shots from ${sourceCount} source clip${sourceCount === 1 ? "" : "s"}` },
    { name: "Readable captions", passed: captionBeats >= 3, detail: `${captionBeats} caption beats` },
    { name: "Rights-safe source", passed: reusableSources, detail: reusableSources ? "Using local/reusable sources" : "Some sources need manual rights review" },
    { name: "Validation", passed: validation.passed, detail: validation.errors.length ? validation.errors.join(", ") : "Core validation passed" }
  ];
  const passedCount = checks.filter((check) => check.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const improvements = checks
    .filter((check) => !check.passed)
    .map((check) => `${check.name}: ${check.detail}`);
  if (!hasVoiceOver && voiceWarning) improvements.push(voiceWarning);
  if (!qualityScore.passed) improvements.push(...qualityScore.notes.filter((note) => /missing|no voice|too small/i.test(note)));

  return {
    ready: score >= 80 && validation.passed,
    score,
    summary: score >= 90 ? "Ready for manual upload." : score >= 75 ? "Almost ready, review the notes first." : "Needs fixes before upload.",
    outputPath,
    durationSeconds: duration,
    width: probe.width,
    height: probe.height,
    codec: probe.codec,
    hasAudio: probe.hasAudio,
    checks,
    improvements: [...new Set(improvements)].slice(0, 8)
  };
}
