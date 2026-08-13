import fs from "node:fs";
import path from "node:path";
import { addEvent, dataDir, ensureLocalFiles, readState, updateState } from "../server/localDb";
import { runProfessionalWorkflow } from "../server/workflow";

const bangkokOffsetMs = 7 * 60 * 60 * 1000;
const slots = [10, 20];
const checkIntervalMs = Number(process.env.AUTOPOST_CHECK_INTERVAL_MS ?? 60_000);
const prepMinutes = Number(process.env.AUTOPOST_PREP_MINUTES ?? 30);
const defaultTopic = process.env.AUTOPOST_TOPIC ?? "daily vlog";
const runsPath = path.join(dataDir, "autopilot-runs.json");

interface RunRecord {
  key: string;
  status: "started" | "completed" | "failed";
  topic: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

function thaiParts(date = new Date()) {
  const thai = new Date(date.getTime() + bangkokOffsetMs);
  return {
    year: thai.getUTCFullYear(),
    month: thai.getUTCMonth() + 1,
    day: thai.getUTCDate(),
    hour: thai.getUTCHours(),
    minute: thai.getUTCMinutes()
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function slotKey(slotHour: number, date = new Date()) {
  const parts = thaiParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(slotHour)}:00+07`;
}

function activePrepSlot(date = new Date()) {
  const parts = thaiParts(date);
  return slots.find((slotHour) => {
    const minutesNow = parts.hour * 60 + parts.minute;
    const slotMinutes = slotHour * 60;
    return minutesNow >= slotMinutes - prepMinutes && minutesNow < slotMinutes;
  });
}

function readRuns(): RunRecord[] {
  ensureLocalFiles();
  if (!fs.existsSync(runsPath)) return [];
  return JSON.parse(fs.readFileSync(runsPath, "utf8")) as RunRecord[];
}

function writeRuns(records: RunRecord[]) {
  ensureLocalFiles();
  fs.writeFileSync(runsPath, JSON.stringify(records.slice(-90), null, 2));
}

function topicForRun() {
  const state = readState();
  return state.topics.today?.topic ?? defaultTopic;
}

async function maybeRunSlot() {
  const slotHour = activePrepSlot();
  if (!slotHour) return;

  const key = slotKey(slotHour);
  const runs = readRuns();
  if (runs.some((run) => run.key === key && run.status !== "failed")) return;

  const state = readState();
  if (state.autopilot.emergencyStopped || state.autopilot.paused) {
    addEvent(`Autopilot skipped ${key}: paused or emergency stopped`, "warning");
    return;
  }

  const topic = topicForRun();
  const startedAt = new Date().toISOString();
  const record: RunRecord = { key, status: "started", topic, startedAt };
  writeRuns([...runs, record]);
  addEvent(`Autopilot started ${key} Buffer post workflow for ${topic}`);

  try {
    await runProfessionalWorkflow(topic, "twice-daily-autopilot");
    record.status = "completed";
    record.finishedAt = new Date().toISOString();
    addEvent(`Autopilot completed ${key} Buffer post workflow for ${topic}`);
  } catch (error) {
    record.status = "failed";
    record.finishedAt = new Date().toISOString();
    record.error = error instanceof Error ? error.message : "Unknown autopilot error";
    addEvent(`Autopilot failed ${key}: ${record.error}`, "error");
  } finally {
    const latest = readRuns().filter((run) => run.key !== key);
    writeRuns([...latest, record]);
  }
}

updateState((state) => {
  state.autopilot.enabled = true;
});

console.log(`Twice-daily autopilot started. Preparing posts ${prepMinutes} minutes before 10:00 and 20:00 Asia/Bangkok.`);
await maybeRunSlot();
setInterval(() => void maybeRunSlot(), checkIntervalMs);
