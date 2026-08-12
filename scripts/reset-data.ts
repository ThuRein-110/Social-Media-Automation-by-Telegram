import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureLocalFiles } from "../server/localDb";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = ["data", "uploads", "outputs"].map((name) => path.join(rootDir, name));

for (const target of targets) {
  const relative = path.relative(rootDir, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to delete outside project: ${target}`);
  }
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

ensureLocalFiles();

console.log("LOCAL DATA RESET COMPLETE");
console.log("Deleted old app data, uploads, and renders.");
console.log("Kept code, dependencies, and .env.local secrets.");
