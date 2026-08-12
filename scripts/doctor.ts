import { doctor } from "../server/workflow";

const result = doctor();
console.log("SYSTEM DOCTOR");
for (const [key, value] of Object.entries(result)) {
  console.log(`${key.padEnd(18)} ${value}`);
}
