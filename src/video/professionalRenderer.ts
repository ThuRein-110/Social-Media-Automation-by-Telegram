import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { MediaItem, VideoTimeline } from "../domain";
import { uploadDir } from "../../server/localDb";

export interface RenderedVideo {
  outputPath: string;
  durationSeconds: number;
  mode: "ffmpeg";
}

export interface BackgroundVideoSource {
  outputPath: string;
}

function escapeSubtitlePath(input: string): string {
  return input.replace(/\\/g, "/").replace(/:/g, "\\:");
}

function sourcePathFor(item: MediaItem) {
  return item.storageUrl.startsWith("/uploads/")
    ? path.join(uploadDir, item.storageUrl.replace("/uploads/", ""))
    : item.storageUrl;
}

function parseSrtCaptions(subtitlePath: string) {
  const input = fs.readFileSync(subtitlePath, "utf8");
  return input
    .split(/\r?\n\r?\n/)
    .map((block) => {
      const lines = block.split(/\r?\n/).filter(Boolean);
      const timing = lines.find((line) => line.includes("-->"));
      if (!timing) return null;
      const [start, end] = timing.split("-->").map((value) => value.trim());
      const text = lines.slice(lines.indexOf(timing) + 1).join(" ").trim();
      return text ? { start: srtTimeToSeconds(start), end: srtTimeToSeconds(end), text } : null;
    })
    .filter((caption): caption is { start: number; end: number; text: string } => Boolean(caption));
}

function srtTimeToSeconds(value: string) {
  const [hh = "0", mm = "0", rest = "0"] = value.split(":");
  const [ss = "0", ms = "0"] = rest.split(",");
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms) / 1000;
}

function escapeDrawtextPath(input: string) {
  return input.replace(/\\/g, "/").replace(/:/g, "\\:");
}

function captionFilters(subtitlePath: string) {
  const fontFile = "C\\:/Windows/Fonts/arialbd.ttf";
  const captionDir = path.join(path.dirname(subtitlePath), "caption-text");
  fs.mkdirSync(captionDir, { recursive: true });
  return parseSrtCaptions(subtitlePath)
    .map((caption, index) => {
      const start = caption.start.toFixed(2);
      const end = Math.max(caption.start + 0.2, caption.end - 0.04).toFixed(2);
      const textPath = path.join(captionDir, `caption-${String(index + 1).padStart(2, "0")}.txt`);
      fs.writeFileSync(textPath, caption.text);
      return `drawtext=fontfile='${fontFile}':textfile='${escapeDrawtextPath(textPath)}':x=(w-text_w)/2:y=1508:fontsize=42:fontcolor=white:borderw=2:bordercolor=black@0.85:shadowx=2:shadowy=2:shadowcolor=black@0.65:box=1:boxcolor=black@0.34:boxborderw=18:enable='gte(t\\,${start})*lt(t\\,${end})'`;
    })
    .join(",");
}

function verticalShotFilter(backgroundInputIndex: number, shotIndex: number, duration: number) {
  return [
    `[${backgroundInputIndex}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,trim=duration=${duration.toFixed(2)},setpts=PTS-STARTPTS,eq=contrast=1.12:saturation=1.06:brightness=0.015,format=yuv420p[v${shotIndex}]`
  ].join(";");
}

function professionalFilter(timeline: VideoTimeline, subtitlePath: string, backgroundInputOffset: number, voiceInputIndex?: number) {
  const shotFilters = timeline.tracks.video.map((shot, index) => {
    return verticalShotFilter(backgroundInputOffset + index, index, Math.max(0.5, shot.end - shot.start));
  });
  const concatInputs = timeline.tracks.video.map((_shot, index) => `[v${index}]`).join("");
  const animatedLook = [
    "eq=contrast=1.08:saturation=1.08:brightness=0.01",
    "vignette=PI/5",
    "drawbox=x=0:y=1475:w=1080:h=145:color=black@0.16:t=fill",
    captionFilters(subtitlePath)
  ].join(",");
  const musicBed = `sine=frequency=82:sample_rate=44100:duration=${timeline.duration},volume=0.025,afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(0, timeline.duration - 1.2)}:d=1.2`;
  const audioFilter = voiceInputIndex === undefined
    ? `${musicBed}[aout]`
    : `[${voiceInputIndex}:a]apad,atrim=duration=${timeline.duration},aresample=44100,highpass=f=95,lowpass=f=8200,acompressor=threshold=-18dB:ratio=2.2:attack=20:release=250,volume=1.08,afade=t=in:st=0:d=0.25,afade=t=out:st=${Math.max(0, timeline.duration - 0.45)}:d=0.45,asetpts=PTS-STARTPTS[voice];${musicBed}[bed];[voice][bed]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=9,alimiter=limit=0.95[aout]`;
  return [
    ...shotFilters,
    `${concatInputs}concat=n=${timeline.tracks.video.length}:v=1:a=0,${animatedLook},format=yuv420p[vout]`,
    audioFilter
  ].join(";");
}

export function renderProfessionalVideo(timeline: VideoTimeline, media: MediaItem[], outputPath: string, subtitlePath: string, backgroundVideos: BackgroundVideoSource[] = []): RenderedVideo {
  if (!ffmpegPath) throw new Error("Bundled FFmpeg is unavailable.");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const videoSources = [...new Set(timeline.tracks.video.map((shot) => shot.mediaId))]
    .map((id) => media.find((item) => item.id === id))
    .filter((item): item is MediaItem => Boolean(item));
  if (videoSources.length === 0) throw new Error("Timeline references missing media.");
  if (backgroundVideos.length < timeline.tracks.video.length) throw new Error("Timeline requires one generated background video per scene.");
  const voice = timeline.tracks.voiceOver[0]?.source;
  const backgroundInputOffset = videoSources.length;
  const voiceInputIndex = videoSources.length + backgroundVideos.length;
  const args = [
    "-y",
    ...videoSources.flatMap((source) => ["-stream_loop", "-1", "-i", sourcePathFor(source)]),
    ...backgroundVideos.flatMap((source) => ["-stream_loop", "-1", "-i", source.outputPath]),
    ...(voice ? ["-i", voice] : []),
    "-t",
    String(timeline.duration),
    "-filter_complex",
    professionalFilter(timeline, subtitlePath, backgroundInputOffset, voice ? voiceInputIndex : undefined),
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-b:v",
    "8M",
    "-maxrate",
    "10M",
    "-bufsize",
    "16M",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-ar",
    "44100",
    "-t",
    String(timeline.duration),
    outputPath
  ];
  execFileSync(ffmpegPath, args, { stdio: "pipe" });
  return { outputPath, durationSeconds: timeline.duration, mode: "ffmpeg" };
}
