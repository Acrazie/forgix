// src/cli.ts
import { pathToFileURL } from "node:url";

// src/exit-codes.ts
var EXIT_CODES = {
  SUCCESS: 0,
  INVALID_INVOCATION: 2,
  INVALID_CONFIGURATION: 3,
  POLICY_CONTRADICTION: 4,
  STATE_CONFLICT: 5,
  BLOCKED: 6,
  HANDOFF_REQUIRED: 7,
  INTERNAL_ERROR: 10
};

// src/cli.ts
function main() {
  process.stdout.write(JSON.stringify({ command: "dev-flow", status: "scaffolded" }) + "\n");
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
export {
  EXIT_CODES,
  main
};
