import { CreativeBrief, MediaItem, VideoTimeline, VideoTimelineSchema, VoiceOverResult } from "../domain";
import { createVideoConceptProfile, scoreClipForConcept } from "../creative/conceptProfile";

export function createTimeline(brief: CreativeBrief, media: MediaItem[], voice: VoiceOverResult, subtitles: Array<{ start: number; end: number; text: string }>): VideoTimeline {
  const sourceVideos = media.filter((item) => item.type === "video");
  if (sourceVideos.length === 0) throw new Error("Timeline requires at least one video clip.");
  const profile = createVideoConceptProfile(brief.topic);
  const duration = Math.min(32, Math.max(24, Number((voice.durationSeconds + 0.65).toFixed(2))));
  const desiredSceneCount = Math.min(8, Math.max(6, Math.round(duration / 4)));
  const sceneSeeds = Array.from({ length: desiredSceneCount }, (_item, index) => {
    const slot = duration / desiredSceneCount;
    const start = Number((index * slot).toFixed(2));
    const end = Number(((index + 1) * slot).toFixed(2));
    const nearby = subtitles.find((subtitle) => subtitle.start >= start && subtitle.start < end) ?? subtitles[index % Math.max(1, subtitles.length)];
    return { start, end, text: nearby?.text ?? brief.story };
  });
  const scenes = sceneSeeds
    .filter((segment) => segment.start < duration)
    .map((segment, index) => {
      const ranked = sourceVideos
        .map((item) => ({ item, score: scoreClipForConcept(item, profile, segment.text, index) }))
        .sort((a, b) => b.score.finalScore - a.score.finalScore);
      const chosen = ranked[0];
      const end = Math.min(duration, Math.max(segment.end, segment.start + 1.2));
      return {
        start: Number(segment.start.toFixed(2)),
        end: Number(end.toFixed(2)),
        mediaId: chosen.item.id,
        operation: index === 0 ? "crop_vertical" as const : "trim" as const,
        transition: "cut" as const,
        reason: `Title-aware ${profile.primaryEmotion} scene. ${chosen.score.reason}`
      };
    });
  return VideoTimelineSchema.parse({
    duration,
    tracks: {
      video: scenes,
      voiceOver: voice.durationSeconds > 0.2 ? [{ start: 0, end: duration, source: voice.path }] : [],
      music: [],
      soundEffects: [],
      subtitles,
      text: brief.hook ? [{ start: 0, end: Math.min(3, duration), text: brief.hook, style: "minimal" }] : []
    }
  });
}
