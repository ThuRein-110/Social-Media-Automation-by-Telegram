import express from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeAndSaveWebsite, configureLive, configureMock, doctor, emergencyStop, handleTelegramText, runProfessionalWorkflow, saveUploadedMedia, syncSavedConnectionStatus, unmock } from "./workflow";
import { ensureLocalFiles, outputDir, readState, uploadDir } from "./localDb";
import { getSecretStatus, loadLocalEnv, saveSecrets, secretRequirements } from "./secrets";
import { discoverTelegramUsers, testConnection } from "./connectionTests";
import { login, requireAuth } from "./auth";
import { sendLatestPostToTelegramNow, sendSocialSetupChecklistToTelegram } from "./telegramApproval";
import { collectOnlineClips } from "./onlineClips";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const app = express();

function clientError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (message.startsWith("Command failed:")) return "Video rendering failed. The renderer log was saved in the server console. Try another clip or collect new online clips.";
  return message.length > 400 ? `${message.slice(0, 400)}...` : message;
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_request, file, cb) => {
    if (/^(video|image|audio)\//.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only video, image, and audio uploads are allowed."));
  }
});

loadLocalEnv();
ensureLocalFiles();
syncSavedConnectionStatus();

app.use(cors({ origin: [/^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/localhost:\d+$/] }));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(uploadDir));
app.use("/outputs", express.static(outputDir));

app.get("/api/health", (_request, response) => response.json(doctor()));
app.post("/api/auth/login", login);

app.use("/api", requireAuth);
app.get("/api/auth/me", (_request, response) => response.json({ username: response.locals.user }));
app.get("/api/state", (_request, response) => response.json(syncSavedConnectionStatus()));
app.get("/api/secrets/status", (_request, response) => response.json(getSecretStatus()));
app.get("/api/secrets/requirements", (_request, response) => response.json(secretRequirements));
app.post("/api/secrets/:service", (request, response) => {
  const service = request.params.service;
  const allowed = new Set(secretRequirements[service] ?? []);
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(request.body ?? {})) {
    if (allowed.has(key)) values[key] = String(value);
  }
  const result = saveSecrets(values);
  const next = configureLive(service);
  response.json({ ...result, state: next, status: getSecretStatus(service) });
});
app.post("/api/test/:service", async (request, response) => {
  try {
    response.json(await testConnection(request.params.service));
  } catch (error) {
    response.status(400).json({
      service: request.params.service,
      ok: false,
      title: "Test failed",
      message: error instanceof Error ? error.message : "Connection test failed",
      nextSteps: ["Check the saved values", "Try again"]
    });
  }
});
app.post("/api/telegram/discover-user", async (_request, response) => {
  try {
    response.json(await discoverTelegramUsers());
  } catch (error) {
    response.status(400).json({
      service: "telegram",
      ok: false,
      title: "Could not find Telegram user",
      message: error instanceof Error ? error.message : "Telegram lookup failed",
      nextSteps: ["Check the bot token", "Message the bot", "Try again"]
    });
  }
});
app.post("/api/analyze-website", async (request, response) => {
  try {
    response.json(await analyzeAndSaveWebsite(String(request.body.url ?? "")));
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Website analysis failed" });
  }
});
app.post("/api/mock/:service", (request, response) => response.json(configureMock(request.params.service)));
app.post("/api/live/:service", (request, response) => response.json(configureLive(request.params.service)));
app.post("/api/unmock/:service", (request, response) => response.json(unmock(request.params.service)));
app.post("/api/media", upload.single("media"), (request, response) => {
  if (!request.file) return response.status(400).json({ error: "No media file uploaded." });
  response.json(saveUploadedMedia(request.file));
});
app.post("/api/media/collect-online", async (request, response) => {
  try {
    response.json(await collectOnlineClips(String(request.body.topic ?? ""), Number(request.body.count ?? 2)));
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Online clip collection failed" });
  }
});
app.post("/api/topic", async (request, response) => {
  try {
    response.json(await runProfessionalWorkflow(String(request.body.topic ?? "reading vlog"), String(request.body.source ?? "dashboard")));
  } catch (error) {
    response.status(400).json({ error: clientError(error, "Workflow failed") });
  }
});
app.post("/api/telegram/mock", async (request, response) => {
  try {
    response.json(await handleTelegramText(String(request.body.text ?? "")));
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Telegram command failed" });
  }
});
app.post("/api/telegram/send-latest-preview", async (_request, response) => {
  try {
    response.json(await sendLatestPostToTelegramNow());
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Telegram preview failed" });
  }
});
app.post("/api/telegram/send-social-setup", async (_request, response) => {
  try {
    response.json(await sendSocialSetupChecklistToTelegram());
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Telegram setup checklist failed" });
  }
});
app.post("/api/emergency-stop", (_request, response) => response.json(emergencyStop()));

app.use(express.static(distDir));
app.get(/.*/, (_request, response) => response.sendFile(path.join(distDir, "index.html")));

const port = Number(process.env.PORT ?? 8787);
app.listen(port, "127.0.0.1", () => {
  console.log(`Social Agent API running at http://127.0.0.1:${port}`);
});
