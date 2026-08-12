import { AuditLog } from "../../audit/auditLog";
import { AutopilotSettings, BrandProfile, MediaItem, Platform, VideoEditPlan } from "../../domain";
import { JobQueue } from "../../jobs/jobQueue";
import { PermissionService } from "../../permissions/permissionService";
import { MockPublisher, SocialPublisher } from "../../social/publisher";
import { validateVideoEditPlan } from "../../video/validator";

export interface TopicState {
  topic: string;
  source: "telegram" | "scheduled_campaign" | "website_update" | "calendar" | "fallback";
}

export class InMemoryTopicStore {
  private stopped = false;
  private paused = false;
  private topics = new Map<string, TopicState>();

  setTopic(date: "today" | "tomorrow", topic: string, source: TopicState["source"]): void {
    this.topics.set(date, { topic, source });
  }

  getTodayTopic(): TopicState {
    return this.topics.get("today") ?? { topic: "lifestyle vlog", source: "calendar" };
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.stopped = false;
  }

  emergencyStop(): void {
    this.stopped = true;
    this.paused = true;
  }

  canPublish(): boolean {
    return !this.stopped && !this.paused;
  }

  status(): string {
    const topic = this.getTodayTopic();
    return `AUTOPILOT ${this.stopped ? "STOPPED" : this.paused ? "PAUSED" : "READY"}\nToday's Topic: ${topic.topic}\nSource: ${topic.source}`;
  }
}

export class SocialManagerAgent {
  private readonly publishers: Map<Platform, SocialPublisher>;

  constructor(
    private readonly permissions: PermissionService,
    private readonly audit: AuditLog,
    private readonly jobs: JobQueue,
    private readonly topicStore: InMemoryTopicStore,
    publishers: SocialPublisher[] = [new MockPublisher("instagram"), new MockPublisher("youtube"), new MockPublisher("tiktok")]
  ) {
    this.publishers = new Map(publishers.map((publisher) => [publisher.platform, publisher]));
  }

  createEditPlan(topic: string, media: MediaItem[]): VideoEditPlan {
    this.permissions.requirePermission("AI_GENERATION");
    this.permissions.requirePermission("VIDEO_RENDERING");
    const selected = media
      .filter((item) => item.type === "video" && item.status === "READY")
      .sort((a, b) => a.usedCount - b.usedCount)
      .slice(0, 3);
    if (selected.length === 0) throw new Error("No ready video media available.");
    return validateVideoEditPlan({
      topic,
      aspectRatio: "9:16",
      resolution: "1080x1920",
      targetDurationSeconds: Math.min(35, selected.reduce((sum, item) => sum + Math.floor(item.duration ?? 10), 0)),
      clips: selected.map((item) => ({
        mediaId: item.id,
        start: 0,
        end: Math.min(12, item.duration ?? 10),
        reason: `Relevant available clip for ${topic}`
      })),
      subtitles: true,
      removeSilence: true,
      normalizeAudio: true,
      hookText: `Today: ${topic}`,
      outroText: "Follow for the next update",
      transitionStyle: "cut",
      pace: "standard",
      musicMood: "calm upbeat"
    }, media);
  }

  async runDaily(ownerId: string, brand: BrandProfile, media: MediaItem[], settings: AutopilotSettings): Promise<string[]> {
    const topicState = this.topicStore.getTodayTopic();
    const plan = this.createEditPlan(topicState.topic, media);
    const renderJob = this.jobs.enqueue(ownerId, "RENDER_VIDEO", plan, `render:${ownerId}:${topicState.topic}:${new Date().toISOString().slice(0, 10)}`);
    this.audit.record({
      actor: "system",
      agent: "SocialManagerAgent",
      action: "create_daily_plan",
      resource: brand.website,
      inputSummary: topicState.topic,
      result: renderJob.id,
      permissionUsed: "AI_GENERATION"
    });
    if (!settings.enabled || settings.mode !== "AUTOPILOT" || !settings.autoPublishEnabled || !this.topicStore.canPublish()) {
      return [`Render queued in non-publishing mode: ${renderJob.id}`];
    }
    const results: string[] = [];
    for (const platform of settings.allowedPlatforms) {
      this.permissions.requirePermission("SOCIAL_PUBLISH", platform);
      const publisher = this.publishers.get(platform);
      if (!publisher) {
        results.push(`${platform}: PLATFORM_RESTRICTION`);
        continue;
      }
      const idempotencyKey = `publish:${ownerId}:${platform}:${topicState.topic}:${new Date().toISOString().slice(0, 10)}`;
      this.jobs.enqueue(ownerId, "PUBLISH_POST", { platform, topic: topicState.topic }, idempotencyKey);
      const request = {
        ownerId,
        platform,
        caption: `${brand.brandName}: ${topicState.topic}\n${brand.preferredHashtags.join(" ")}`,
        mediaUrl: "mock://render/final.mp4",
        idempotencyKey
      };
      const validation = await publisher.validate(request);
      if (!validation.passed) {
        results.push(`${platform}: validation failed`);
        continue;
      }
      const published = await publisher.publish(request);
      results.push(`${platform}: ${published.status}`);
    }
    return results;
  }
}
