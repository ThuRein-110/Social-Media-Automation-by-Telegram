import { MediaItem, VideoEditPlan, VideoEditPlanSchema } from "../domain";

export function validateVideoEditPlan(plan: unknown, media: MediaItem[]): VideoEditPlan {
  const parsed = VideoEditPlanSchema.parse(plan);
  const mediaIds = new Set(media.map((item) => item.id));
  for (const clip of parsed.clips) {
    if (!mediaIds.has(clip.mediaId)) {
      throw new Error(`Unknown mediaId in edit plan: ${clip.mediaId}`);
    }
  }
  return parsed;
}
