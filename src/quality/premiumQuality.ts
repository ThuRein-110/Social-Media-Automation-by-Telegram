import fs from "node:fs";
import { BackgroundScenePlan } from "../video/backgroundVideoGenerator";
import { VideoTimeline } from "../domain";
import { RenderFrameReview } from "./renderReviewer";

export interface PremiumVideoQualityScore {
  technicalPass: boolean;
  creativePremiumPass: boolean;
  hook: number;
  story: number;
  clipRelevance: number;
  cinematicQuality: number;
  shotSelection: number;
  verticalReframing: number;
  color: number;
  voiceNaturalness: number;
  audioMix: number;
  subtitles: number;
  pacing: number;
  technicalQuality: number;
  rights: "PASS" | "FAIL";
  passed: boolean;
  revisionRequired: boolean;
  revisionPlan: string[];
}

export function scorePremiumVideo(options: {
  videoPath: string;
  timeline: VideoTimeline;
  backgroundScenePlan: BackgroundScenePlan[];
  frameReview: RenderFrameReview;
  words: number;
  voiceDuration: number;
  renderDuration: number;
  voiceWarning?: string;
}): PremiumVideoQualityScore {
  const wpm = options.words > 0 ? options.words / options.voiceDuration * 60 : 0;
  const rightsPass = options.backgroundScenePlan.every((scene) => scene.rightsVerified);
  const semanticGeneratedFallback = options.backgroundScenePlan.every((scene) => /original rights-safe animated reading scene/i.test(scene.description));
  const firstFrameExists = Boolean(options.frameReview.frames[0] && fs.existsSync(options.frameReview.frames[0]));
  const sceneCount = options.timeline.tracks.video.length;
  const voiceFits = options.voiceDuration <= options.renderDuration + 0.4 && options.voiceDuration >= options.renderDuration - 3.5;
  const paceOk = wpm >= 155 && wpm <= 195;
  const revisions: string[] = [];
  if (!rightsPass) revisions.push("Replace any scene without verified rights metadata.");
  if (!firstFrameExists) revisions.push("Extract and review first frame before export.");
  if (sceneCount < 6) revisions.push("Add more intentional shot variety.");
  if (!voiceFits) revisions.push("Adjust script or profile so narration fills the Reel without truncation.");
  if (!paceOk) revisions.push(`Adjust narration pace. Current estimated pace is ${Math.round(wpm)} WPM.`);
  if (options.voiceWarning?.includes("local computer voice")) revisions.push("Upgrade to an authorized premium voice provider or recorded voice library for true premium delivery.");
  const technicalPass = rightsPass
    && firstFrameExists
    && fs.existsSync(options.videoPath)
    && options.renderDuration >= 20
    && options.renderDuration <= 35
    && options.timeline.tracks.subtitles.length > 0;
  const score: PremiumVideoQualityScore = {
    technicalPass,
    creativePremiumPass: false,
    hook: firstFrameExists ? 8 : 4,
    story: 8,
    clipRelevance: rightsPass ? (semanticGeneratedFallback ? 8.6 : 7.5) : 2,
    cinematicQuality: semanticGeneratedFallback ? 7.8 : 7,
    shotSelection: sceneCount >= 6 ? 8 : 5,
    verticalReframing: semanticGeneratedFallback ? 8.6 : 7,
    color: 7,
    voiceNaturalness: options.voiceWarning?.includes("local computer voice") ? 6 : 8,
    audioMix: 7,
    subtitles: options.timeline.tracks.subtitles.length ? 8 : 3,
    pacing: paceOk && voiceFits ? 8 : 5,
    technicalQuality: technicalPass ? 9 : 4,
    rights: rightsPass ? "PASS" : "FAIL",
    passed: false,
    revisionRequired: revisions.length > 0,
    revisionPlan: revisions
  };
  score.creativePremiumPass = score.hook >= 8
    && score.story >= 8
    && score.clipRelevance >= 8.5
    && score.cinematicQuality >= 8
    && score.shotSelection >= 8
    && score.verticalReframing >= 8.5
    && score.voiceNaturalness >= 8.5
    && score.audioMix >= 8
    && score.subtitles >= 8
    && score.pacing >= 8
    && score.technicalQuality >= 9;
  if (!score.creativePremiumPass) revisions.push("Creative premium gate is stricter now: improve clip specificity, voice provider quality, vertical framing, audio mix, and cinematic quality before calling the render premium.");
  score.passed = score.technicalPass && score.creativePremiumPass && score.rights === "PASS";
  return score;
}
