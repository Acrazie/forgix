import { pathToFileURL } from "node:url";
import { EXIT_CODES } from "./exit-codes.js";

export { EXIT_CODES } from "./exit-codes.js";

export function main(): void {
  process.stdout.write(JSON.stringify({ command: "dev-flow", status: "scaffolded" }) + "\n");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
