import { ContentValidationResult, Platform } from "../domain";

export interface PublishRequest {
  ownerId: string;
  platform: Platform;
  caption: string;
  mediaUrl: string;
  idempotencyKey: string;
}

export interface PublishResult {
  platform: Platform;
  externalPostId: string;
  status: "MOCK_PUBLISHED" | "PUBLISHED" | "SCHEDULED" | "PLATFORM_RESTRICTION";
}

export interface SocialPublisher {
  platform: Platform;
  validate(request: PublishRequest): Promise<ContentValidationResult>;
  publish(request: PublishRequest): Promise<PublishResult>;
  getStatus(externalPostId: string): Promise<string>;
  getAnalytics(externalPostId: string): Promise<Record<string, number>>;
}

export class MockPublisher implements SocialPublisher {
  private readonly published = new Map<string, PublishResult>();

  constructor(readonly platform: Platform) {}

  async validate(request: PublishRequest): Promise<ContentValidationResult> {
    const errors = [];
    if (!request.caption.trim()) errors.push("caption_missing");
    if (!request.mediaUrl.trim()) errors.push("media_missing");
    return { passed: errors.length === 0, checks: ["caption", "media"], warnings: [], errors };
  }

  async publish(request: PublishRequest): Promise<PublishResult> {
    const existing = this.published.get(request.idempotencyKey);
    if (existing) return existing;
    const result = {
      platform: this.platform,
      externalPostId: `mock_${this.platform}_${crypto.randomUUID()}`,
      status: "MOCK_PUBLISHED" as const
    };
    this.published.set(request.idempotencyKey, result);
    return result;
  }

  async getStatus(): Promise<string> {
    return "mock-ok";
  }

  async getAnalytics(): Promise<Record<string, number>> {
    return { views: 0, likes: 0, comments: 0, shares: 0 };
  }
}
