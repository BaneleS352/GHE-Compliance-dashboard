import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiPath = path.join(root, "src", "services", "api.ts");
const apiSource = fs.readFileSync(apiPath, "utf8");

// API modules are trust-boundary code. `any` here removes the compiler's
// ability to verify response and mutation contracts, so keep it forbidden.
const anyMatches = [...apiSource.matchAll(/\bany\b/g)];
if (anyMatches.length > 0) {
  const lines = apiSource.slice(0, anyMatches[0].index).split(/\r?\n/).length;
  console.error(`Quality gate failed: src/services/api.ts contains any at line ${lines}.`);
  process.exit(1);
}

console.log("Quality gate passed: API boundary contains no any types.");
