import { addEvent } from "../server/localDb";
import { sendDueTelegramApprovals } from "../server/telegramApproval";

const intervalMs = Number(process.env.SCHEDULER_INTERVAL_MS ?? 60_000);

async function tick() {
  try {
    const result = await sendDueTelegramApprovals();
    if (result.sent > 0) {
      console.log(`Scheduler sent ${result.sent} due Telegram upload pack${result.sent === 1 ? "" : "s"}.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scheduler error";
    addEvent(`Scheduler failed: ${message}`, "warning");
    console.error(`Scheduler failed: ${message}`);
  }
}

console.log(`Local scheduler started. Checking due upload packs every ${Math.round(intervalMs / 1000)} seconds.`);
await tick();
setInterval(() => void tick(), intervalMs);
