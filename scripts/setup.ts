import { ensureLocalFiles, readState } from "../server/localDb";

ensureLocalFiles();
const state = readState();
console.log("LOCAL SETUP COMPLETE");
console.log("Database: data/db.json");
console.log("Uploads: uploads/");
console.log(`Publishing mode: ${process.env.SOCIAL_PUBLISH_MODE ?? "mock"}`);
console.log(`Brand profile: ${state.brandProfile ? "configured" : "not configured"}`);
