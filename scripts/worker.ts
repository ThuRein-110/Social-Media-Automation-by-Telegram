import { readState, addEvent } from "../server/localDb";
import { runProfessionalWorkflow } from "../server/workflow";
import { sendDueTelegramApprovals } from "../server/telegramApproval";

const state = readState();
const topic = state.topics.today?.topic ?? "daily vlog";

if (!state.brandProfile) {
  console.log("Worker idle: website is not configured.");
  process.exit(0);
}

if (state.media.filter((item) => item.type === "video" && item.status === "READY").length === 0) {
  console.log("Worker idle: no ready video media.");
  process.exit(0);
}

addEvent(`Worker started daily workflow for ${topic}`);
const result = await runProfessionalWorkflow(topic, "worker");
await sendDueTelegramApprovals().catch((error) => {
  addEvent(`Telegram approval preview failed: ${error instanceof Error ? error.message : "Unknown error"}`, "warning");
});
console.log(`Worker completed: ${result.rendered.outputPath}`);
