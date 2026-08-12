import fs from "node:fs";
import path from "node:path";
import { VoiceOverResult, VoiceOverResultSchema } from "../domain";
import { defaultVoiceProfile, LocalVoiceOverProvider } from "./voiceOverService";

export type VoiceSourceMode =
  | "RECORDED_HUMAN_LIBRARY"
  | "USER_RECORDED_VOICE"
  | "LICENSED_VOICE_PACK"
  | "SYNTHETIC_TTS"
  | "NO_VOICEOVER";

export interface RecordedVoiceAsset {
  id: string;
  displayName: string;
  source: string;
  speakerPermissionStatus: "PUBLIC_DOMAIN" | "CC0" | "CC_BY" | "USER_OWNED" | "EXPLICIT_COMMERCIAL_LICENSE" | "BLOCKED";
  license: string;
  commercialUseAllowed: boolean;
  derivativeUseAllowed: boolean;
  attributionRequired: boolean;
  language: string;
  accent?: string;
  genderPresentation?: string;
  emotion: string;
  recordingQuality: "LOW" | "MEDIUM" | "HIGH";
  sampleRate?: number;
  createdAt: string;
  sourceUrl?: string;
  licenseUrl?: string;
  verifiedAt: string;
  filePath: string;
}

const voiceLibraryDir = path.resolve("voice-library");
const voiceManifestPath = path.join(voiceLibraryDir, "manifest.json");

function readManifest(): RecordedVoiceAsset[] {
  if (!fs.existsSync(voiceManifestPath)) return [];
  return JSON.parse(fs.readFileSync(voiceManifestPath, "utf8")) as RecordedVoiceAsset[];
}

function allowedForReuse(asset: RecordedVoiceAsset) {
  return asset.speakerPermissionStatus !== "BLOCKED" && asset.derivativeUseAllowed && asset.commercialUseAllowed && fs.existsSync(asset.filePath);
}

function chooseRecordedVoice(emotion: string) {
  return readManifest()
    .filter(allowedForReuse)
    .sort((a, b) => {
      const emotionScore = Number(b.emotion === emotion) - Number(a.emotion === emotion);
      const qualityScore = Number(b.recordingQuality === "HIGH") - Number(a.recordingQuality === "HIGH");
      return emotionScore || qualityScore;
    })[0];
}

function emptyVoice(strategy: VoiceSourceMode, reason: string): VoiceOverResult {
  return VoiceOverResultSchema.parse({
    provider: "none",
    path: "",
    durationSeconds: 0.1,
    characters: 0,
    estimatedCost: 0,
    strategy,
    qualityWarning: reason,
    rightsStatus: "not_required"
  });
}

export class VoiceDirector {
  private readonly localTts = new LocalVoiceOverProvider();

  async createVoice(script: string, outputPath: string, options: { topic: string; emotion: string; preferredMode?: VoiceSourceMode }): Promise<VoiceOverResult> {
    const cleanScript = script.trim();
    if (!cleanScript) return emptyVoice("NO_VOICEOVER", "No narration script was created.");

    const preferredMode = options.preferredMode ?? (process.env.VOICE_MODE as VoiceSourceMode | undefined) ?? "SYNTHETIC_TTS";
    const recorded = chooseRecordedVoice(options.emotion);

    if (preferredMode !== "SYNTHETIC_TTS" && recorded) {
      return VoiceOverResultSchema.parse({
        provider: "recorded_human_library",
        path: recorded.filePath,
        durationSeconds: 0.1,
        characters: cleanScript.length,
        estimatedCost: 0,
        strategy: recorded.speakerPermissionStatus === "USER_OWNED" ? "USER_RECORDED_VOICE" : "RECORDED_HUMAN_LIBRARY",
        qualityWarning: "Using authorized recorded voice asset; arbitrary full-script human voice requires a larger recorded phrase library.",
        rightsStatus: recorded.speakerPermissionStatus
      });
    }

    if (preferredMode === "NO_VOICEOVER") {
      return emptyVoice("NO_VOICEOVER", recorded ? "Recorded voice library is not complete enough for this script." : "No authorized recorded human voice is available.");
    }

    const result = await this.localTts.generateVoice(cleanScript, defaultVoiceProfile, outputPath);
    return VoiceOverResultSchema.parse({
      ...result,
      strategy: "SYNTHETIC_TTS",
      qualityWarning: "Using the local computer voice. Add recorded voice clips later for a more human sound.",
      rightsStatus: "synthetic_local"
    });
  }
}
