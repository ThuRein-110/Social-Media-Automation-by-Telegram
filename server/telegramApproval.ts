import { addEvent, readState, updateState } from "./localDb";
import { getSecretStatus, loadLocalEnv } from "./secrets";
import { requireConfig, sendMessage, sendVideoFile } from "./telegramRuntime";

function latestProductionForTopic(topic: string) {
  return readState().productions.find((production) => production.topic === topic);
}

function approvalText(post: ReturnType<typeof readState>["posts"][number]) {
  const production = latestProductionForTopic(post.topic);
  return [
    "Post approval preview",
    "",
    `Platform: ${post.platform}`,
    `Topic: ${post.topic}`,
    `Planned upload: ${post.scheduledPublishAt ? new Date(post.scheduledPublishAt).toLocaleString() : "not scheduled yet"}`,
    "",
    "Caption:",
    post.caption,
    "",
    production?.renderPath ? `Video file: ${production.renderPath}` : "Video file: not created yet",
    "",
    "Tap Approve Latest or Pause below."
  ].join("\n");
}

function packageCaption(post: ReturnType<typeof readState>["posts"][number]) {
  return ["Caption and hashtags", "", post.caption].join("\n");
}

const approvalMenu = {
  keyboard: [
    [{ text: "Approve Latest" }, { text: "Pause" }],
    [{ text: "Back to Menu" }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};

export async function sendLatestPostToTelegramNow() {
  loadLocalEnv();
  const state = readState();
  const post = state.posts[0];
  const { token, allowedIds } = requireConfig();
  const sentTo: number[] = [];
  if (!post) {
    for (const userId of allowedIds) {
      await sendMessage(token, userId, "Telegram connection test works. When a post is prepared, I will send it here for approval 1 hour before upload.");
      sentTo.push(userId);
    }
    addEvent("Telegram connection test message sent");
    return {
      ok: true,
      sentTo,
      message: "Telegram test message sent."
    };
  }
  const production = latestProductionForTopic(post.topic);
  for (const userId of allowedIds) {
    if (production?.renderPath) {
      await sendVideoFile(token, userId, production.renderPath, approvalText(post), approvalMenu);
      await sendMessage(token, userId, packageCaption(post), approvalMenu);
    } else {
      await sendMessage(token, userId, approvalText(post), approvalMenu);
    }
    sentTo.push(userId);
  }
  updateState((next) => {
    const saved = next.posts.find((item) => item.id === post.id);
    if (saved) {
      saved.telegramApprovalSentAt = new Date().toISOString();
      saved.telegramApprovalStatus = "pending";
      delete saved.telegramApprovalDecidedAt;
    }
  });
  addEvent(`Telegram manual upload pack sent for ${post.platform} post: ${post.topic}`);
  return {
    ok: true,
    sentTo,
    postId: post.id,
    message: `Sent latest ${post.platform} video, caption, and hashtags to Telegram.`
  };
}

export async function sendDueTelegramApprovals() {
  loadLocalEnv();
  const state = readState();
  const duePosts = state.posts.filter((post) =>
    post.status === "scheduled" &&
    post.telegramApprovalDueAt &&
    !post.telegramApprovalSentAt &&
    new Date(post.telegramApprovalDueAt).getTime() <= Date.now()
  );
  if (duePosts.length === 0) return { ok: true, sent: 0 };

  const { token, allowedIds } = requireConfig();
  const sentPostIds: string[] = [];
  for (const post of duePosts) {
    const production = latestProductionForTopic(post.topic);
    for (const userId of allowedIds) {
      if (production?.renderPath) {
        await sendVideoFile(token, userId, production.renderPath, approvalText(post), approvalMenu);
        await sendMessage(token, userId, packageCaption(post), approvalMenu);
      } else {
        await sendMessage(token, userId, approvalText(post), approvalMenu);
      }
    }
    sentPostIds.push(post.id);
  }

  updateState((next) => {
    const sentAt = new Date().toISOString();
    for (const post of next.posts) {
      if (sentPostIds.includes(post.id)) {
        post.telegramApprovalSentAt = sentAt;
        post.telegramApprovalStatus = "pending";
        delete post.telegramApprovalDecidedAt;
      }
    }
  });
  addEvent(`Telegram manual upload packs sent for ${sentPostIds.length} due post${sentPostIds.length === 1 ? "" : "s"}`);
  return { ok: true, sent: sentPostIds.length };
}

export async function sendSocialSetupChecklistToTelegram() {
  loadLocalEnv();
  const state = readState();
  const secretStatus = getSecretStatus();
  const services = [
    ["telegram", "Telegram"],
    ["instagram", "Instagram"],
    ["facebook", "Facebook"],
    ["youtube", "YouTube"],
    ["tiktok", "TikTok"],
    ["ai", "AI"],
    ["storage", "Storage"],
    ["videoWorker", "Video Worker"]
  ] as const;

  const lines = services.map(([key, label]) => {
    const fields = Object.values(secretStatus[key] ?? {});
    const saved = fields.filter(Boolean).length;
    const total = fields.length;
    const savedText = total ? `${saved}/${total} keys saved` : "local service";
    return `${label}: ${state.connections[key]} (${savedText})`;
  });

  const text = [
    "Social media setup checklist",
    "",
    ...lines,
    "",
    "Recommended order:",
    "1. Telegram is already connected.",
    "2. Analyze your website.",
    "3. Upload raw video.",
    "4. Connect YouTube, Instagram/Facebook, TikTok only when you have their developer keys.",
    "",
    "Large videos stay local to save budget. Account keys are remembered locally and hidden after saving."
  ].join("\n");

  const { token, allowedIds } = requireConfig();
  const sentTo: number[] = [];
  for (const userId of allowedIds) {
    await sendMessage(token, userId, text);
    sentTo.push(userId);
  }
  addEvent("Social setup checklist sent to Telegram");
  return { ok: true, sentTo, message: "Social setup checklist sent to Telegram." };
}
