import fs from "node:fs";
import path from "node:path";

function timecode(seconds: number): string {
  const date = new Date(seconds * 1000);
  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  const ms = String(date.getUTCMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss},${ms}`;
}

function wrapSubtitle(text: string, maxLineLength = 52): string {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLineLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2).join("\n");
}

function phraseGroups(script: string): string[] {
  const sentences = script
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/[.!?]+$/g, "").trim())
    .filter(Boolean);
  const groups: string[] = [];
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).map((word) => word.trim()).filter(Boolean);
    if (words.length <= 7) {
      groups.push(words.join(" "));
      continue;
    }
    for (let index = 0; index < words.length; index += 5) {
      groups.push(words.slice(index, index + 5).join(" "));
    }
  }
  return groups.length ? groups : [script];
}

export function writeSrtFromScript(script: string, durationSeconds: number, outputPath: string): Array<{ start: number; end: number; text: string }> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const phrases = phraseGroups(script);
  const segmentLength = durationSeconds / Math.max(1, phrases.length);
  const segments = phrases.map((text, index) => ({
    start: Number((index * segmentLength).toFixed(2)),
    end: Number(Math.min(durationSeconds, (index + 1) * segmentLength).toFixed(2)),
    text: wrapSubtitle(text)
  }));
  const body = segments.map((segment, index) => `${index + 1}\n${timecode(segment.start)} --> ${timecode(segment.end)}\n${segment.text}\n`).join("\n");
  fs.writeFileSync(outputPath, body);
  return segments;
}
