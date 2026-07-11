import { pathToFileURL } from "node:url";
import { EXIT_CODES } from "./exit-codes.js";
import { InvocationError, parseInvocation } from "./parse.js";

export { EXIT_CODES } from "./exit-codes.js";
export { InvocationError, parseInvocation } from "./parse.js";

export function main(argv = process.argv.slice(2)): void {
  try {
    process.stdout.write(JSON.stringify({ command: "dev-flow", status: "parsed", data: parseInvocation(argv) }) + "\n");
  } catch (error) {
    const exitCode = error instanceof InvocationError ? error.exitCode : EXIT_CODES.INTERNAL_ERROR;
    process.stderr.write((error instanceof Error ? error.message : "Unexpected error.") + "\n");
    process.exitCode = exitCode;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
