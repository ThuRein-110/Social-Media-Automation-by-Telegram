import fs from "node:fs";
import { execFileSync } from "node:child_process";
import ffprobe from "ffprobe-static";

export interface MediaAnalysisResult {
  duration?: number;
  width?: number;
  height?: number;
  technicalMetadata: {
    codec?: string;
    bitrate?: number;
    fps?: number;
    hasAudio: boolean;
    fileSizeBytes: number;
  };
  quality: {
    score: number;
    checks: string[];
    warnings: string[];
  };
}

function parseFps(rate?: string): number | undefined {
  if (!rate || rate === "0/0") return undefined;
  const [num, den] = rate.split("/").map(Number);
  if (!num || !den) return undefined;
  return Number((num / den).toFixed(2));
}

export function analyzeLocalMedia(filePath: string): MediaAnalysisResult {
  const fileSizeBytes = fs.statSync(filePath).size;
  const raw = execFileSync(ffprobe.path, [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath
  ], { encoding: "utf8" });
  const parsed = JSON.parse(raw) as {
    format?: { duration?: string; bit_rate?: string };
    streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; avg_frame_rate?: string }>;
  };
  const video = parsed.streams?.find((stream) => stream.codec_type === "video");
  const audio = parsed.streams?.some((stream) => stream.codec_type === "audio") ?? false;
  const duration = parsed.format?.duration ? Number(parsed.format.duration) : undefined;
  const fps = parseFps(video?.avg_frame_rate);
  const warnings: string[] = [];
  const checks = ["ffprobe_readable", "duration_detected", "resolution_detected"];
  if (!duration || duration < 2) warnings.push("video_too_short");
  if (duration && duration > 600) warnings.push("video_very_long");
  if (!video?.width || !video.height) warnings.push("missing_video_dimensions");
  if (video?.width && video.height && Math.max(video.width, video.height) < 720) warnings.push("low_resolution");
  if (!audio) warnings.push("no_audio_track");
  const score = Math.max(1, 10 - warnings.length * 1.5);
  return {
    duration,
    width: video?.width,
    height: video?.height,
    technicalMetadata: {
      codec: video?.codec_name,
      bitrate: parsed.format?.bit_rate ? Number(parsed.format.bit_rate) : undefined,
      fps,
      hasAudio: audio,
      fileSizeBytes
    },
    quality: {
      score: Number(score.toFixed(1)),
      checks,
      warnings
    }
  };
}
