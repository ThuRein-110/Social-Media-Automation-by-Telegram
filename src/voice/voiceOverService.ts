import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { VoiceOverResult, VoiceOverResultSchema, VoiceProfile, VoiceProfileSchema } from "../domain";
import ffprobeStatic from "ffprobe-static";
import ffmpegPath from "ffmpeg-static";

export interface VoiceOverProvider {
  generateVoice(script: string, profile: VoiceProfile, outputPath: string): Promise<VoiceOverResult>;
  getVoices(): Promise<VoiceProfile[]>;
  previewVoice(profile: VoiceProfile, outputPath: string): Promise<VoiceOverResult>;
  estimateCost(script: string): number;
}

export const defaultVoiceProfile = VoiceProfileSchema.parse({
  id: "local-windows-default",
  name: "Local Windows Voice",
  provider: "windows_sapi",
  voiceId: "default",
  language: "en",
  accent: "system",
  style: "natural",
  speed: 1.25,
  tone: "calm",
  stability: 0.8,
  enabled: true
});

function estimateDuration(script: string): number {
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, words / 2.9);
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scriptToSsml(script: string): string {
  const sentences = script.match(/[^.!?]+[.!?]*/g)?.map((item) => item.trim()).filter(Boolean) ?? [script.trim()];
  const spoken = sentences.map((sentence, index) => {
    const pause = index === sentences.length - 1 ? "80ms" : index % 3 === 0 ? "180ms" : "120ms";
    return `<s>${escapeXml(sentence)}</s><break time="${pause}" />`;
  }).join("");
  return `<speak version="1.0" xml:lang="en-US"><prosody rate="+8%" volume="medium">${spoken}</prosody></speak>`;
}

function measuredDuration(outputPath: string, fallback: number) {
  try {
    const ffprobe = ffprobeStatic.path;
    const value = execFileSync(ffprobe, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      outputPath
    ], { encoding: "utf8" }).trim();
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : fallback;
  } catch {
    return fallback;
  }
}

function speedMultiplier() {
  const parsed = Number(process.env.VOICE_SPEED_MULTIPLIER ?? "1.5");
  return Number.isFinite(parsed) ? Math.min(2, Math.max(0.75, parsed)) : 1.5;
}

function atempoChain(multiplier: number) {
  const filters: string[] = [];
  let remaining = multiplier;
  while (remaining > 2) {
    filters.push("atempo=2");
    remaining /= 2;
  }
  while (remaining < 0.5) {
    filters.push("atempo=0.5");
    remaining /= 0.5;
  }
  filters.push(`atempo=${remaining.toFixed(3)}`);
  return filters.join(",");
}

function applyVoiceSpeed(outputPath: string, multiplier: number) {
  if (!ffmpegPath || Math.abs(multiplier - 1) < 0.01 || !fs.existsSync(outputPath)) return;
  const tempPath = outputPath.replace(/\.wav$/i, ".speed.wav");
  execFileSync(ffmpegPath, [
    "-y",
    "-i",
    outputPath,
    "-filter:a",
    atempoChain(multiplier),
    "-ar",
    "22050",
    "-ac",
    "1",
    tempPath
  ], { stdio: "ignore" });
  fs.copyFileSync(tempPath, outputPath);
  fs.rmSync(tempPath, { force: true });
}

function writeSilentWav(outputPath: string, seconds: number): void {
  const sampleRate = 16000;
  const samples = Math.ceil(sampleRate * seconds);
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  fs.writeFileSync(outputPath, buffer);
}

export class LocalVoiceOverProvider implements VoiceOverProvider {
  async generateVoice(script: string, profile: VoiceProfile, outputPath: string): Promise<VoiceOverResult> {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const escapedScript = scriptToSsml(script).replace(/'/g, "''");
    const escapedOutput = outputPath.replace(/'/g, "''");
    try {
      execFileSync("powershell", [
        "-NoProfile",
        "-Command",
        `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 1; $s.Volume = 92; $s.SetOutputToWaveFile('${escapedOutput}'); $s.SpeakSsml('${escapedScript}'); $s.Dispose();`
      ], { stdio: "ignore" });
    } catch {
      writeSilentWav(outputPath, estimateDuration(script));
    }
    applyVoiceSpeed(outputPath, speedMultiplier());
    const durationSeconds = measuredDuration(outputPath, estimateDuration(script));
    return VoiceOverResultSchema.parse({
      provider: profile.provider,
      path: outputPath,
      durationSeconds,
      characters: script.length,
      estimatedCost: this.estimateCost()
    });
  }

  async getVoices(): Promise<VoiceProfile[]> {
    return [defaultVoiceProfile];
  }

  async previewVoice(profile: VoiceProfile, outputPath: string): Promise<VoiceOverResult> {
    return this.generateVoice("This is your local voice-over preview.", profile, outputPath);
  }

  estimateCost(): number {
    return 0;
  }
}
