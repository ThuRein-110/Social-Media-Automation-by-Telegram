import { VideoEditPlan } from "../domain";

export interface RenderRequest {
  plan: VideoEditPlan;
  inputByMediaId: Record<string, string>;
  outputPath: string;
}

export function buildSafeFfmpegPlan(request: RenderRequest): string[][] {
  return request.plan.clips.map((clip, index) => {
    const input = request.inputByMediaId[clip.mediaId];
    if (!input) throw new Error(`Missing input path for ${clip.mediaId}`);
    return [
      "ffmpeg",
      "-y",
      "-ss",
      String(clip.start),
      "-to",
      String(clip.end),
      "-i",
      input,
      "-vf",
      request.plan.aspectRatio === "9:16"
        ? "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
        : "scale=1920:-2",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      `${request.outputPath}.part${index}.mp4`
    ];
  });
}
