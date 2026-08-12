import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { MediaItem, VideoTimeline } from "../domain";
import { uploadDir } from "../../server/localDb";

export interface BackgroundScenePlan {
  start: number;
  end: number;
  backgroundType: "REAL_REUSABLE_FILM_SCENE" | "PROGRAMMATIC_VIDEO";
  description: string;
  camera: "slow_push_forward" | "drift" | "data_flow";
  outputPath: string;
  sourceMediaId?: string;
  sourceTitle?: string;
  sourceLicense?: string;
  rightsVerified: boolean;
  clipStart?: number;
  clipEnd?: number;
}

function backgroundFilter(index: number) {
  const palette = index % 3;
  const red = palette === 0
    ? "18+26*sin((X+T*72)/118)+18*sin((Y-T*42)/154)"
    : palette === 1
      ? "12+18*sin((X+Y+T*70)/145)"
      : "24+34*sin((Y+T*60)/128)";
  const green = palette === 0
    ? "42+58*sin((X+Y+T*94)/172)"
    : palette === 1
      ? "55+70*sin((X-T*86)/136)"
      : "30+42*sin((X+Y-T*74)/155)";
  const blue = palette === 0
    ? "82+92*sin((Y-T*88)/132)"
    : palette === 1
      ? "72+110*sin((Y+T*78)/118)"
      : "95+95*sin((X-T*95)/162)";
  return [
    `geq=r='${red}':g='${green}':b='${blue}'`,
    "gblur=sigma=1.8",
    "eq=contrast=1.16:saturation=1.24:brightness=-0.02",
    "noise=alls=7:allf=t+u",
    `drawbox=x='mod(t*96\\,1280)-220':y=0:w=150:h=1920:color=white@0.055:t=fill`,
    `drawbox=x=0:y='mod(t*130\\,2140)-220':w=1080:h=140:color=0x38bdf8@0.045:t=fill`,
    `drawbox=x='520+330*sin(t*0.45+${index})':y='460+380*cos(t*0.37+${index})':w=210:h=210:color=0x14b8a6@0.075:t=fill`,
    `drawbox=x='220+500*cos(t*0.34+${index})':y='1010+260*sin(t*0.51+${index})':w=520:h=4:color=white@0.18:t=fill`,
    "vignette=PI/4",
    "format=yuv420p"
  ].join(",");
}

function sourcePathFor(item: MediaItem) {
  return item.storageUrl.startsWith("/uploads/")
    ? path.join(uploadDir, item.storageUrl.replace("/uploads/", ""))
    : item.storageUrl;
}

function isRightsClearedVideo(item: MediaItem) {
  const ledger = `${item.tags.join(" ")} ${item.description}`.toLowerCase();
  const blocked = /\b(esrb|rating|inappropriate for children|dark souls|gotham|pocket champs|trailer)\b/.test(ledger);
  const rights = /\b(public domain|cc0|cc by|cc-by|cc by-sa|creative commons|wikimedia|reusable)\b/.test(ledger);
  const archivalFilm = /\b(public domain|film|silent|movie)\b/.test(ledger);
  const usableSize = archivalFilm
    ? (item.width ?? 0) >= 300 && (item.height ?? 0) >= 220
    : (item.width ?? 0) >= 480 && (item.height ?? 0) >= 360;
  return item.type === "video" && item.status === "READY" && rights && usableSize && !blocked && fs.existsSync(sourcePathFor(item));
}

function licenseFrom(item: MediaItem) {
  const match = item.description.match(/License:\s*([^.;]+)/i);
  return match?.[1]?.trim() || "Rights metadata stored in media description";
}

function renderFilmScene(ffmpeg: string, item: MediaItem, outputPath: string, clipStart: number, duration: number, index: number) {
  const pan = index % 3 === 0 ? "iw*0.08*sin(t*0.18)" : index % 3 === 1 ? "iw*0.05*cos(t*0.22)" : "0";
  const lowResolutionArchive = (item.width ?? 0) < 720 || (item.height ?? 0) < 540;
  const foreground = lowResolutionArchive
    ? [
      `[fg]scale=980:-2:force_original_aspect_ratio=decrease,setsar=1,eq=contrast=1.18:saturation=1.02:brightness=0.035,unsharp=5:5:0.55:3:3:0.22[film]`,
      `[blur]drawbox=x=44:y=286:w=992:h=1348:color=black@0.45:t=fill[matte]`,
      `[matte][film]overlay=x=(W-w)/2:y=330,drawbox=x=56:y=300:w=968:h=1318:color=white@0.10:t=3,vignette=PI/5,format=yuv420p[v]`
    ]
    : [
      `[fg]scale=1280:1920:force_original_aspect_ratio=increase,crop=1080:1920:x='(iw-1080)/2+${pan}':y='(ih-1920)/2',eq=contrast=1.22:saturation=1.04:brightness=0.035,unsharp=5:5:0.55:3:3:0.25[film]`,
      `[blur][film]blend=all_mode=normal:all_opacity=0.88,vignette=PI/6,format=yuv420p[v]`
    ];
  execFileSync(ffmpeg, [
    "-y",
    "-ss",
    clipStart.toFixed(2),
    "-stream_loop",
    "-1",
    "-i",
    sourcePathFor(item),
    "-t",
    duration.toFixed(2),
    "-filter_complex",
    [
      `[0:v]split=2[base][fg]`,
      `[base]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=12,eq=contrast=1.06:saturation=0.82:brightness=-0.015[blur]`,
      ...foreground
    ].join(";"),
    "-map",
    "[v]",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    outputPath
  ], { stdio: "pipe" });
}

function renderProgrammaticBackground(ffmpeg: string, outputPath: string, duration: number, index: number) {
  execFileSync(ffmpeg, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `nullsrc=s=1080x1920:r=30:d=${duration.toFixed(2)}`,
    "-vf",
    backgroundFilter(index),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    outputPath
  ], { stdio: "pipe" });
}

function renderReadingBackground(ffmpeg: string, outputPath: string, duration: number, index: number) {
  const pageOffset = index % 2 === 0 ? "18*sin(t*1.2)" : "12*cos(t*1.05)";
  execFileSync(ffmpeg, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `nullsrc=s=1080x1920:r=30:d=${duration.toFixed(2)}`,
    "-vf",
    [
      "geq=r='18+12*sin((X+T*35)/180)':g='22+14*sin((Y+T*30)/150)':b='24+10*sin((X+Y+T*25)/210)'",
      "gblur=sigma=0.9",
      "drawbox=x=0:y=0:w=1080:h=1920:color=0x0b0f13@0.16:t=fill",
      "drawbox=x=130:y=320:w=820:h=1160:color=0xf4ead8@0.92:t=fill",
      "drawbox=x=520:y=320:w=28:h=1160:color=0x6f5b45@0.42:t=fill",
      `drawbox=x='165+${pageOffset}':y=380:w=315:h=18:color=0x493827@0.38:t=fill`,
      `drawbox=x='165+${pageOffset}':y=430:w=300:h=13:color=0x493827@0.28:t=fill`,
      `drawbox=x='595-${pageOffset}':y=395:w=275:h=15:color=0x493827@0.32:t=fill`,
      `drawbox=x='595-${pageOffset}':y=445:w=300:h=13:color=0x493827@0.24:t=fill`,
      "drawbox=x=760:y=1180:w=150:h=96:color=0x2b2119@0.78:t=fill",
      "drawbox=x=785:y=1205:w=96:h=46:color=0x7a4f35@0.52:t=fill",
      "drawbox=x=110:y=230:w=860:h=6:color=white@0.08:t=fill",
      "drawbox=x='140+80*sin(t*0.45)':y=170:w=650:h=2:color=0xfff3c4@0.18:t=fill",
      "noise=alls=4:allf=t",
      "eq=contrast=1.12:saturation=0.88:brightness=-0.015",
      "vignette=PI/4",
      "format=yuv420p"
    ].join(","),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    outputPath
  ], { stdio: "pipe" });
}

export function generateBackgroundVideos(timeline: VideoTimeline, outputRoot: string, topic: string, media: MediaItem[]): BackgroundScenePlan[] {
  if (!ffmpegPath) throw new Error("Bundled FFmpeg is unavailable.");
  const ffmpeg = ffmpegPath;
  const bgDir = path.join(outputRoot, "backgrounds");
  fs.mkdirSync(bgDir, { recursive: true });
  const reusableFilmPool = media.filter(isRightsClearedVideo);
  const readingTopic = /\b(reading|book|library|page)\b/i.test(topic);
  const hasReadingVisual = media.some((item) => {
    const ledger = `${item.filename} ${item.description} ${item.tags.join(" ")}`.toLowerCase();
    return isRightsClearedVideo(item) && /\b(reading|book|library|page|desk|coffee)\b/.test(ledger);
  });
  return timeline.tracks.video.map((shot, index) => {
    const duration = Math.max(0.5, shot.end - shot.start);
    const outputPath = path.join(bgDir, `background-${String(index + 1).padStart(2, "0")}.mp4`);
    const directItem = media.find((candidate) => candidate.id === shot.mediaId);
    const item = directItem && isRightsClearedVideo(directItem)
      ? directItem
      : reusableFilmPool[index % Math.max(1, reusableFilmPool.length)];
    if (readingTopic && !hasReadingVisual) {
      renderReadingBackground(ffmpeg, outputPath, duration, index);
      return {
        start: shot.start,
        end: shot.end,
        backgroundType: "PROGRAMMATIC_VIDEO" as const,
        description: `Original rights-safe animated reading scene for ${topic}`,
        camera: index % 3 === 0 ? "slow_push_forward" : index % 3 === 1 ? "data_flow" : "drift",
        outputPath,
        rightsVerified: true
      };
    }
    if (item && isRightsClearedVideo(item)) {
      const minStart = Math.min(8, Math.max(0, (item.duration ?? duration) - duration - 1));
      const maxStart = Math.max(minStart, (item.duration ?? duration) - duration - 1);
      const clipStart = maxStart > minStart ? minStart + ((index * 5.7) % (maxStart - minStart)) : minStart;
      renderFilmScene(ffmpeg, item, outputPath, clipStart, duration, index);
      return {
        start: shot.start,
        end: shot.end,
        backgroundType: "REAL_REUSABLE_FILM_SCENE" as const,
        description: `Reusable cinematic scene for ${topic}: ${item.filename}`,
        camera: index % 3 === 0 ? "slow_push_forward" : index % 3 === 1 ? "data_flow" : "drift",
        outputPath,
        sourceMediaId: item.id,
        sourceTitle: item.filename,
        sourceLicense: licenseFrom(item),
        rightsVerified: true,
        clipStart,
        clipEnd: clipStart + duration
      };
    }
    renderProgrammaticBackground(ffmpeg, outputPath, duration, index);
    return {
      start: shot.start,
      end: shot.end,
      backgroundType: "PROGRAMMATIC_VIDEO" as const,
      description: `Full-screen moving cinematic background for ${topic}`,
      camera: index % 3 === 0 ? "slow_push_forward" : index % 3 === 1 ? "data_flow" : "drift",
      outputPath,
      rightsVerified: true
    };
  });
}
