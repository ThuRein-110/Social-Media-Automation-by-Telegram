import { describe, expect, it } from "vitest";
import { MockPublisher } from "../src/social/publisher";

describe("Publishing idempotency", () => {
  it("does not create duplicate mock posts for the same idempotency key", async () => {
    const publisher = new MockPublisher("instagram");
    const request = {
      ownerId: "u1",
      platform: "instagram" as const,
      caption: "Reading vlog",
      mediaUrl: "mock://final.mp4",
      idempotencyKey: "publish:u1:instagram:2026-08-08"
    };
    const first = await publisher.publish(request);
    const second = await publisher.publish(request);
    expect(second.externalPostId).toBe(first.externalPostId);
  });
});
