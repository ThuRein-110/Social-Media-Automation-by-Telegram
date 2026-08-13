import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { BrandProfileSchema, JobSchema, MediaItem, MediaItemSchema, Platform } from "../src/domain";
import { analyzeWebsite } from "../src/brand/websiteAnalyzer";
import { parseTelegramCommand } from "../src/telegram/commands";
import { validateVideoEditPlan } from "../src/video/validator";
import { addEvent, AppState, outputDir, readState, updateState, uploadDir } from "./localDb";
import { bufferAutomationReady, scheduleBufferTikTokPost } from "./bufferPublisher";
import { analyzeTrends } from "../src/trends/trendIntelligence";
import { createCreativeBrief } from "../src/creative/creativeDirector";
import { writeScript } from "../src/creative/scriptWriter";
import { VoiceDirector } from "../src/voice/voiceDirector";
import { writeSrtFromScript } from "../src/subtitles/subtitleEngine";
import { createTimeline } from "../src/video/timelinePlanner";
import { renderProfessionalVideo } from "../src/video/professionalRenderer";
import { generateBackgroundVideos } from "../src/video/backgroundVideoGenerator";
import { createVideoQualityReport, scoreProduction, validateRenderedVideo } from "../src/quality/qualityControl";
import { reviewRenderedFrames } from "../src/quality/renderReviewer";
import ffmpegStaticPath from "ffmpeg-static";
import { loadLocalEnv, secretRequirements } from "./secrets";
import { createVisualPlan } from "../src/visuals/visualDirector";
import { createThumbnail } from "../src/thumbnail/thumbnailDirector";
import { analyzeLocalMedia } from "../src/media/mediaAnalyzer";
import { createVideoConceptProfile, scoreClipForConcept } from "../src/creative/conceptProfile";
import { choosePremiumProfile } from "../src/video/premiumProfiles";
import { exportPlatformMasters } from "../src/platform/platformExporters";
import { scorePremiumVideo } from "../src/quality/premiumQuality";

export interface UploadedMediaFile {
  originalname: string;
  mimetype: string;
  path: string;
}

const topicKeywords: Record<string, string[]> = {
  reading: ["reading", "book", "desk", "study", "coffee", "library", "pages"],
  coding: ["coding", "code", "computer", "desk", "keyboard", "technology"],
  coffee: ["coffee", "cafe", "shop", "cup", "morning"],
  study: ["study", "desk", "notes", "reading", "productivity"]
};

function createJob(ownerId: string, type: AppState["jobs"][number]["type"], payload: unknown, idempotencyKey: string) {
  return JobSchema.parse({
    id: crypto.randomUUID(),
    ownerId,
    type,
    status: "COMPLETED",
    payload,
    attemptCount: 1,
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    idempotencyKey
  });
}

export async function analyzeAndSaveWebsite(url: string) {
  addEvent("Website analysis started");
  const profile = await analyzeWebsite(url).catch(() => {
    const parsed = new URL(url);
    const brandName = parsed.hostname.replace(/^www\./, "").split(".")[0].replace(/[-_]/g, " ");
    return BrandProfileSchema.parse({
      website: parsed.toString(),
      brandName: brandName.replace(/\b\w/g, (letter) => letter.toUpperCase()),
      description: `Brand profile generated from ${parsed.hostname}.`,
      industry: "",
      targetAudience: ["website visitors", "social followers"],
      languages: ["en"],
      tone: "clear, helpful, brand-safe",
      brandColors: [],
      contentCategories: ["behind the scenes", "product updates", "educational", "daily vlog"],
      preferredTopics: [],
      restrictedTopics: [],
      preferredHashtags: [],
      bannedWords: [],
      ctaStyle: "soft call to action",
      postingStyle: "short-form educational and behind-the-scenes posts",
      socialAccounts: {}
    });
  });
  updateState((state) => {
    state.brandProfile = profile;
    state.connections.website = "connected";
    state.jobs.unshift(createJob("local", "WEBSITE_SCAN", { website: profile.website }, `website:${profile.website}`));
  });
  addEvent(`Brand Profile created for ${profile.brandName}`);
  return profile;
}

export function configureMock(service: string) {
  updateState((state) => {
    if (service in state.connections) state.connections[service] = "mock";
    state.connectionIssues[service] = [];
    if (["instagram", "facebook", "youtube", "tiktok"].includes(service)) {
      const platform = service as Platform;
      if (!state.autopilot.allowedPlatforms.includes(platform)) state.autopilot.allowedPlatforms.push(platform);
    }
  });
  addEvent(`${service} configured in mock mode`);
  return readState();
}

export function configureLive(service: string) {
  loadLocalEnv();
  const required = secretRequirements[service] ?? [];
  const missing = required.filter((key) => !process.env[key]);
  updateState((state) => {
    if (!(service in state.connections)) return;
    if (missing.length === 0) {
      state.connections[service] = "connected";
      state.connectionIssues[service] = [];
      if (["instagram", "facebook", "youtube", "tiktok"].includes(service)) {
        const platform = service as Platform;
        if (!state.autopilot.allowedPlatforms.includes(platform)) state.autopilot.allowedPlatforms.push(platform);
      }
    } else {
      state.connections[service] = "action_required";
      state.connectionIssues[service] = missing;
    }
  });
  addEvent(missing.length === 0 ? `${service} live configuration detected` : `${service} needs live setup values`, missing.length === 0 ? "info" : "warning");
  return readState();
}

export function syncSavedConnectionStatus() {
  loadLocalEnv();
  updateState((state) => {
    for (const [service, required] of Object.entries(secretRequirements)) {
      if (!(service in state.connections) || required.length === 0) continue;
      const missing = required.filter((key) => !process.env[key]);
      if (missing.length === 0) {
        state.connections[service] = "connected";
        state.connectionIssues[service] = [];
      } else if (state.connections[service] === "connected") {
        state.connections[service] = "action_required";
        state.connectionIssues[service] = missing;
      }
    }
    if (state.connections.storage === "not_configured") state.connections.storage = "mock";
    if (state.connections.videoWorker === "action_required") state.connections.videoWorker = "mock";
  });
  return readState();
}

export function unmock(service: string) {
  updateState((state) => {
    if (service in state.connections) state.connections[service] = "not_configured";
    state.connectionIssues[service] = [];
  });
  addEvent(`${service} returned to unconfigured state`);
  return readState();
}

function inferTags(filename: string): string[] {
  const lower = filename.toLowerCase();
  const tags = new Set<string>();
  for (const words of Object.values(topicKeywords)) {
    for (const word of words) if (lower.includes(word)) tags.add(word);
  }
  if (tags.size === 0) tags.add("general");
  return [...tags];
}

export function saveUploadedMedia(file: UploadedMediaFile): MediaItem {
  const tags = inferTags(file.originalname);
  const analysis = file.mimetype.startsWith("video/") ? analyzeLocalMedia(file.path) : undefined;
  const item = MediaItemSchema.parse({
    id: crypto.randomUUID(),
    ownerId: "local",
    filename: file.originalname,
    storageUrl: `/uploads/${path.basename(file.path)}`,
    type: file.mimetype.startsWith("video/") ? "video" : file.mimetype.startsWith("image/") ? "image" : "audio",
    duration: analysis?.duration ?? (file.mimetype.startsWith("video/") ? 10 : undefined),
    width: analysis?.width,
    height: analysis?.height,
    createdAt: new Date().toISOString(),
    uploadedAt: new Date().toISOString(),
    tags: [],
    aiTags: tags,
    description: `Local media analyzed from filename and file type (${file.mimetype}).`,
    transcript: file.mimetype.startsWith("video/") ? "Transcript pending. Local low-cost mode stores this once generated." : undefined,
    usedCount: 0,
    platformUsage: {},
    topics: tags,
    technicalMetadata: analysis?.technicalMetadata,
    quality: analysis?.quality,
    status: "READY"
  });
  updateState((state) => {
    state.media.unshift(item);
    state.connections.storage = state.connections.storage === "not_configured" ? "mock" : state.connections.storage;
    state.jobs.unshift(createJob("local", "ANALYZE_MEDIA", { mediaId: item.id }, `media:${item.id}:analysis`));
  });
  addEvent(`Media uploaded and analyzed: ${item.filename}`);
  return item;
}

function searchMedia(topic: string, media: MediaItem[]): MediaItem[] {
  const profile = createVideoConceptProfile(topic);
  const topicAllowsTrailers = /\b(game|trailer|gaming)\b/i.test(topic);
  const scored = media
    .filter((item) => item.type === "video" && item.status === "READY")
    .map((item, index) => {
      const haystack = [...item.aiTags, ...item.tags, ...item.topics, item.filename, item.description, item.transcript ?? ""].join(" ").toLowerCase();
      const blockedVisual = !topicAllowsTrailers && /\b(esrb|rating|inappropriate for children|dark souls|gotham|pocket champs|trailer)\b/.test(haystack);
      const publicDomainFilm = /\b(public domain|silent film|film|movie)\b/.test(haystack);
      const conceptMismatch = profile.avoidVisualThemes.some((theme) => haystack.includes(theme)) || /\b(aircraft|helicopter|landing|take-off|terahertz|spectral|billboard|tested|contagious)\b/.test(haystack);
      const lowResolution = (item.width ?? 0) < 480 || (item.height ?? 0) < 480 || (item.duration ?? 0) < 3;
      const relevance = scoreClipForConcept(item, profile, profile.coreIdea, index);
      const rightsBoost = publicDomainFilm ? 0.2 : 0;
      const repeatPenalty = Math.min(0.9, item.usedCount * 0.18);
      const score = relevance.finalScore + rightsBoost - repeatPenalty - (blockedVisual ? 2 : 0) - (conceptMismatch ? 1.2 : 0) - (lowResolution && !publicDomainFilm ? 0.7 : 0);
      return { item, score, relevance };
    })
    .sort((a, b) => b.score - a.score)
    .filter(({ relevance }) => relevance.rightsScore > 0);
  const candidates = scored.filter(({ score }) => score >= 0.45);
  const usable = candidates.length ? candidates : scored;
  return usable
    .map(({ item }) => item)
    .slice(0, 8);
}

function minimumTargetDuration() {
  return 20;
}

function buildCaption(brandName: string, topic: string) {
  const hashtags = topic.toLowerCase().split(/\W+/).filter(Boolean).map((word) => `#${word}`);
  return `${brandName} - ${topic}\n\n${hashtags.join(" ")} #shorts`;
}

function writeFinalArtifacts(outputRoot: string, payload: {
  renderedPath: string;
  caption: string;
  hashtags: string[];
  timeline: unknown;
  premiumQualityScore: unknown;
  qualityReport: unknown;
  backgroundScenePlan: Array<{ sourceMediaId?: string; sourceTitle?: string; sourceLicense?: string; rightsVerified: boolean; clipStart?: number; clipEnd?: number; backgroundType: string }>;
  voice: { provider: string; path: string; rightsStatus?: string; strategy?: string };
  platformExports: Record<string, string>;
}) {
  const premiumMaster = path.join(outputRoot, "master-premium.mp4");
  fs.copyFileSync(payload.renderedPath, premiumMaster);
  fs.copyFileSync(payload.platformExports.instagram, path.join(outputRoot, "instagram-reel.mp4"));
  fs.copyFileSync(payload.platformExports.tiktok, path.join(outputRoot, "tiktok.mp4"));
  if (payload.platformExports.youtubeShorts) fs.copyFileSync(payload.platformExports.youtubeShorts, path.join(outputRoot, "youtube-short.mp4"));
  fs.writeFileSync(path.join(outputRoot, "caption.txt"), payload.caption);
  fs.writeFileSync(path.join(outputRoot, "hashtags.txt"), payload.hashtags.join(" "));
  fs.writeFileSync(path.join(outputRoot, "timeline.json"), JSON.stringify(payload.timeline, null, 2));
  fs.writeFileSync(path.join(outputRoot, "quality-report.json"), JSON.stringify({ premiumQualityScore: payload.premiumQualityScore, qualityReport: payload.qualityReport }, null, 2));
  fs.writeFileSync(path.join(outputRoot, "rights-manifest.json"), JSON.stringify({
    visuals: payload.backgroundScenePlan.map((scene) => ({
      type: scene.backgroundType,
      sourceMediaId: scene.sourceMediaId,
      sourceTitle: scene.sourceTitle,
      license: scene.sourceLicense,
      rightsVerified: scene.rightsVerified,
      clipStart: scene.clipStart,
      clipEnd: scene.clipEnd
    })),
    voice: {
      provider: payload.voice.provider,
      strategy: payload.voice.strategy,
      rightsStatus: payload.voice.rightsStatus,
      path: payload.voice.path
    },
    music: { type: "generated_sine_bed", rightsVerified: true, license: "locally generated" }
  }, null, 2));
  return premiumMaster;
}

export function runTopicWorkflow(): never {
  throw new Error("Use runProfessionalWorkflow for topic execution.");
}

export async function runProfessionalWorkflow(topic: string, source = "telegram") {
  const state = readState();
  if (state.autopilot.emergencyStopped) throw new Error("Emergency stop is active.");
  if (!state.brandProfile) throw new Error("Analyze a website before running the agent.");
  const selected = searchMedia(topic, state.media);
  if (selected.length === 0) throw new Error("Upload at least one video before running the agent.");
  const trend = analyzeTrends(topic, state.events.map((event) => event.message));
  const platforms = state.autopilot.allowedPlatforms.filter((platform) => state.connections[platform] === "mock" || state.connections[platform] === "connected");
  const creativeBrief = createCreativeBrief(topic, state.brandProfile, trend, selected, platforms.length ? platforms : ["instagram"]);
  const premiumProfile = choosePremiumProfile(topic, creativeBrief);
  const script = writeScript(creativeBrief, state.brandProfile.brandName);
  const visualDirection = createVisualPlan(creativeBrief, script.voiceoverScript, selected);
  const safeTopic = topic.toLowerCase().replace(/\W+/g, "-") || "topic";
  const outputRoot = path.join(outputDir, `${safeTopic}-${Date.now()}`);
  fs.mkdirSync(outputRoot, { recursive: true });
  const voicePath = path.join(outputRoot, "voiceover.wav");
  const subtitlePath = path.join(outputRoot, "subtitles.srt");
  const renderPath = path.join(outputRoot, "master.mp4");
  const thumbnailPath = path.join(outputRoot, "cover.jpg");
  const hasVoiceOver = Boolean(script.voiceoverScript.trim());
  const voice = await new VoiceDirector().createVoice(hasVoiceOver ? script.voiceoverScript : "", voicePath, {
    topic,
    emotion: creativeBrief.voiceOver.emotion
  });
  const subtitleText = hasVoiceOver ? script.voiceoverScript : script.textOverlays.join(". ");
  const measuredTargetDuration = Math.min(32, Math.max(minimumTargetDuration(), Number((voice.durationSeconds + 0.65).toFixed(2))));
  const subtitles = writeSrtFromScript(subtitleText || creativeBrief.hook, measuredTargetDuration, subtitlePath);
  const timeline = createTimeline(creativeBrief, selected, voice, subtitles);
  const backgroundScenePlan = generateBackgroundVideos(timeline, outputRoot, topic, selected);
  const rendered = renderProfessionalVideo(timeline, state.media, renderPath, subtitlePath, backgroundScenePlan);
  const validation = validateRenderedVideo(rendered.outputPath);
  const frameReview = reviewRenderedFrames(rendered.outputPath, outputRoot, rendered.durationSeconds);
  const words = script.voiceoverScript.trim().split(/\s+/).filter(Boolean).length;
  const premiumQualityScore = scorePremiumVideo({
    videoPath: rendered.outputPath,
    timeline,
    backgroundScenePlan,
    frameReview,
    words,
    voiceDuration: voice.durationSeconds,
    renderDuration: rendered.durationSeconds,
    voiceWarning: voice.qualityWarning
  });
  if (premiumQualityScore.rights === "FAIL") throw new Error("PREMIUM_RENDER_BLOCKED: rights validation failed.");
  const platformExportResult = exportPlatformMasters(rendered.outputPath, outputRoot, premiumProfile);
  const platformExports = {
    instagram: platformExportResult.instagram,
    tiktok: platformExportResult.tiktok,
    youtubeShorts: platformExportResult.youtubeShorts
  };
  const thumbnail = createThumbnail(rendered.outputPath, topic, thumbnailPath, platforms[0] ?? "youtube");
  const qualityScore = scoreProduction(rendered.outputPath, visualDirection.storyboard, visualDirection.visualPlan, Boolean(voice.path));
  const qualityReport = createVideoQualityReport(rendered.outputPath, timeline, selected, qualityScore, validation, Boolean(voice.path), voice.qualityWarning);
  const caption = script.socialCaption || buildCaption(state.brandProfile.brandName, topic);
  const premiumMasterPath = writeFinalArtifacts(outputRoot, {
    renderedPath: rendered.outputPath,
    caption,
    hashtags: script.hashtags,
    timeline,
    premiumQualityScore,
    qualityReport,
    backgroundScenePlan,
    voice,
    platformExports
  });
  const createdAt = new Date();
  const scheduledPublishAt = new Date(createdAt.getTime() + 60 * 60 * 1000).toISOString();
  const telegramApprovalDueAt = createdAt.toISOString();
  const posts = platforms.map((platform) => ({
    id: crypto.randomUUID(),
    platform,
    topic,
    caption,
    mediaId: selected[0].id,
    status: "scheduled" as "scheduled" | "published" | "blocked",
    idempotencyKey: `mock:${platform}:${topic}:${new Date().toISOString().slice(0, 10)}`,
    scheduledPublishAt,
    telegramApprovalDueAt,
    createdAt: createdAt.toISOString()
  }));
  let bufferTikTokPost: { postId: string; dueAt?: string; videoUrl: string } | null = null;
  if (bufferAutomationReady()) {
    try {
      const scheduled = await scheduleBufferTikTokPost({
        videoPath: platformExports.tiktok,
        caption,
        dueAt: scheduledPublishAt
      });
      bufferTikTokPost = {
        postId: scheduled.postId,
        dueAt: scheduled.dueAt,
        videoUrl: scheduled.videoUrl
      };
      for (const post of posts) {
        if (post.platform === "tiktok") {
          post.status = "published";
          post.idempotencyKey = `buffer:${scheduled.postId}`;
        }
      }
    } catch (error) {
      addEvent(`Buffer auto-schedule failed: ${error instanceof Error ? error.message : "Unknown Buffer error"}`, "warning");
    }
  }
  updateState((next) => {
    next.topics.today = { topic, source };
    next.jobs.unshift(createJob("local", "WEBSITE_UPDATE_CHECK", trend, `trend:${topic}`));
    next.jobs.unshift(createJob("local", "GENERATE_CONTENT", { creativeBrief, script, visualDirection }, `creative:${topic}`));
    next.jobs.unshift(createJob("local", "RENDER_VIDEO", { timeline, renderPath }, `render:${topic}`));
    next.jobs.unshift(createJob("local", "VALIDATE_CONTENT", { validation, qualityScore, premiumQualityScore, qualityReport, frameReview, premiumProfile, platformValidations: platformExportResult.validations }, `validate:${topic}`));
    next.productions.unshift({
      id: crypto.randomUUID(),
      topic,
      creativeBrief,
      productionMode: visualDirection.mode,
      visualPlan: visualDirection.visualPlan,
      storyboard: visualDirection.storyboard,
      backgroundScenePlan,
      premiumProfile,
      voiceoverScript: script.voiceoverScript,
      caption,
      voicePath: voice.path,
      voiceStrategy: voice.strategy,
      voiceQualityWarning: voice.qualityWarning,
      subtitlePath,
      renderPath: rendered.outputPath,
      platformExports,
      premiumMasterPath,
      thumbnailPath: thumbnail.path,
      qualityScore,
      premiumQualityScore,
      qualityReport,
      frameReview,
      validation,
      createdAt: new Date().toISOString()
    });
    for (const post of posts) if (!next.posts.some((existing) => existing.idempotencyKey === post.idempotencyKey)) next.posts.unshift(post);
    for (const media of next.media) {
      if (selected.some((item) => item.id === media.id)) {
        media.usedCount += 1;
        media.lastUsedAt = new Date().toISOString();
      }
    }
  });
  addEvent(`Trend/context research completed for ${topic}`);
  addEvent(`Storyboard and visual plan created in ${visualDirection.mode} mode`);
  addEvent(`Generated ${backgroundScenePlan.length} full-screen background video scenes`);
  addEvent(`Creative brief, hook, script, and voice-over generated`);
  addEvent(`Professional MP4 rendered: ${rendered.outputPath}`);
  addEvent(`Thumbnail generated: ${thumbnail.path}`);
  addEvent(`Quality validation ${validation.passed ? "passed" : "failed"}`);
  if (bufferTikTokPost) addEvent(`TikTok scheduled in Buffer: ${bufferTikTokPost.postId}`);
  addEvent(`Premium V3 review ${premiumQualityScore.passed ? "passed" : "needs revision"}${premiumQualityScore.revisionPlan.length ? `: ${premiumQualityScore.revisionPlan[0]}` : ""}`, premiumQualityScore.passed ? "info" : "warning");
  addEvent(`Frame review extracted ${frameReview.frames.length} inspection frames`);
  return { topic, trend, creativeBrief, premiumProfile, visualDirection, script, voice, subtitles, timeline, backgroundScenePlan, rendered, platformExports, thumbnail, validation, qualityScore, premiumQualityScore, qualityReport, frameReview, posts, bufferTikTokPost };
}

function latestQualityMessage() {
  const latest = readState().productions[0];
  if (!latest) return "No video has been created yet. Tap Create Content first.";
  const report = latest.qualityReport as {
    ready?: boolean;
    score?: number;
    summary?: string;
    outputPath?: string;
    durationSeconds?: number;
    width?: number;
    height?: number;
    checks?: Array<{ name: string; passed: boolean; detail: string }>;
    improvements?: string[];
  } | undefined;
  if (!report) return `Latest video: ${latest.topic}\n\nThis older video has no quality report. Create one new video and check again.`;
  const passed = report.checks?.filter((check) => check.passed).length ?? 0;
  const total = report.checks?.length ?? 0;
  const failed = report.checks?.filter((check) => !check.passed).slice(0, 4) ?? [];
  const lines = [
    `Latest video quality: ${report.ready ? "READY" : "NEEDS REVIEW"}`,
    "",
    `Topic: ${latest.topic}`,
    `Score: ${report.score ?? 0}/100`,
    `Checks passed: ${passed}/${total}`,
    `Format: ${report.width ?? "?"}x${report.height ?? "?"}, ${Math.round(report.durationSeconds ?? 0)} sec`,
    `Summary: ${report.summary ?? "Report created."}`,
    `File: ${report.outputPath ?? latest.renderPath}`
  ];
  if (failed.length) {
    lines.push("", "Fix first:");
    for (const check of failed) lines.push(`- ${check.name}: ${check.detail}`);
  }
  if (report.improvements?.length) {
    lines.push("", "Notes:");
    for (const note of report.improvements.slice(0, 4)) lines.push(`- ${note}`);
  }
  return lines.join("\n");
}

function latestTelegramPackage() {
  const latest = readState().productions[0];
  if (!latest) return { message: "No video has been created yet. Tap Create Content first." };
  const caption = latest.caption?.trim() || latest.voiceoverScript || "Caption not created yet.";
  const instagramCaption = caption.includes("#reels") ? caption : `${caption}\n#reels`;
  const tiktokCaption = caption.includes("#tiktok") ? caption : `${caption}\n#tiktok`;
  const report = latest.qualityReport as { ready?: boolean; score?: number; durationSeconds?: number; width?: number; height?: number } | undefined;
  const summary = [
    "Manual upload pack",
    "",
    `Topic: ${latest.topic}`,
    `Quality: ${report?.ready ? "READY" : latest.validation ? "CHECKED" : "NEEDS REVIEW"}${report?.score !== undefined ? ` (${report.score}/100)` : ""}`,
    `Format: ${report?.width ?? "?"}x${report?.height ?? "?"}, ${Math.round(report?.durationSeconds ?? 30)} sec`,
    "",
    "Video is attached below. Caption and hashtags are in the next message so you can copy them easily."
  ].join("\n");
  const platformExports = latest.platformExports as Record<string, string> | undefined;
  return {
    telegramPackage: true as const,
    videoPath: platformExports?.instagram ?? platformExports?.tiktok ?? latest.renderPath,
    caption: ["Instagram caption", "", instagramCaption, "", "TikTok caption", "", tiktokCaption].join("\n"),
    summary
  };
}

export async function handleTelegramText(text: string) {
  const command = parseTelegramCommand(text);
  if (command.type === "SET_TOPIC") return runProfessionalWorkflow(command.topic, "telegram");
  if (command.type === "START" || command.type === "HELP") {
    return { message: "Use the buttons below to create content, review posts, check status, or control automation." };
  }
  if (command.type === "STATUS") {
    const state = readState();
    return { message: `Agent: ${state.autopilot.emergencyStopped ? "stopped" : state.autopilot.paused ? "paused" : "ready"}. Posts prepared: ${state.posts.length}. Videos created: ${state.productions.length}.` };
  }
  if (command.type === "LASTPOST") {
    const post = readState().posts[0];
    return { message: post ? `Latest ${post.platform} post\n\nTopic: ${post.topic}\nStatus: ${post.status}\n\n${post.caption}` : "No post has been created yet." };
  }
  if (command.type === "PACKAGE") return latestTelegramPackage();
  if (command.type === "QUALITY") return { message: latestQualityMessage() };
  if (command.type === "ANALYTICS") {
    const state = readState();
    const sent = state.posts.filter((post) => post.telegramApprovalSentAt).length;
    const approved = state.posts.filter((post) => post.telegramApprovalStatus === "approved").length;
    return { message: `Telegram review summary\n\nSent for review: ${sent}\nApproved: ${approved}\nWaiting: ${Math.max(0, sent - approved)}\nTotal prepared posts: ${state.posts.length}` };
  }
  if (command.type === "APPROVE") {
    let approvedPost: { platform: string; topic: string } | undefined;
    updateState((state) => {
      const post = state.posts.find((item) => item.telegramApprovalSentAt && (item.telegramApprovalStatus ?? "pending") === "pending");
      if (!post) return;
      post.telegramApprovalStatus = "approved";
      post.telegramApprovalDecidedAt = new Date().toISOString();
      approvedPost = { platform: post.platform, topic: post.topic };
    });
    if (!approvedPost) return { message: "No Telegram post is waiting for approval." };
    addEvent(`Telegram approved ${approvedPost.platform} post: ${approvedPost.topic}`);
    return { message: `Approved ${approvedPost.platform} post: ${approvedPost.topic}. It remains scheduled for its planned upload time.` };
  }
  if (command.type === "EMERGENCY_STOP") {
    emergencyStop();
    return { message: "AUTOPILOT STOPPED" };
  }
  if (command.type === "PAUSE") {
    updateState((state) => {
      state.autopilot.paused = true;
      const post = state.posts.find((item) => item.telegramApprovalSentAt && (item.telegramApprovalStatus ?? "pending") === "pending");
      if (post) {
        post.telegramApprovalStatus = "paused";
        post.telegramApprovalDecidedAt = new Date().toISOString();
      }
    });
    addEvent("Agent paused from Telegram");
    return { message: "Posting paused" };
  }
  if (command.type === "RESUME") {
    updateState((state) => { state.autopilot.paused = false; state.autopilot.emergencyStopped = false; });
    addEvent("Agent resumed from Telegram");
    return { message: "Posting resumed" };
  }
  return { message: "Command handled" };
}

export function emergencyStop() {
  updateState((state) => {
    state.autopilot.enabled = false;
    state.autopilot.emergencyStopped = true;
    state.posts = state.posts.map((post) => post.status === "scheduled" ? { ...post, status: "blocked" } : post);
  });
  addEvent("Emergency stop activated", "warning");
  return readState();
}

export function doctor() {
  const state = readState();
  const hasFfmpeg = Boolean(ffmpegStaticPath) || (() => {
    try {
      execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();
  return {
    database: "ok",
    website: state.brandProfile ? "ok" : "action_required",
    ai: state.connections.ai,
    telegram: state.connections.telegram,
    telegramConfig: process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ALLOWED_USER_IDS ? "env_present" : "missing_env",
    storage: fs.existsSync(uploadDir) ? "ok" : "error",
    ffmpeg: hasFfmpeg ? "bundled_ok" : "not_installed_mock_available",
    videoWorker: state.connections.videoWorker,
    instagram: state.connections.instagram,
    youtube: state.connections.youtube,
    tiktok: state.connections.tiktok === "connected" ? "ok" : state.connections.tiktok,
    scheduler: "local_ready",
    socialPublishMode: process.env.SOCIAL_PUBLISH_MODE ?? "mock"
  };
}
