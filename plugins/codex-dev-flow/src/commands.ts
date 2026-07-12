import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function discoverVerificationCommands(root: URL) {
  const path = fileURLToPath(root);
  const agents = path + "/AGENTS.md";
  const guided = existsSync(agents) ? readFileSync(agents, "utf8").match(/npm run [\w:-]+|npm test/g) ?? [] : [];
  const manifest = path + "/package.json";
  const scripts = existsSync(manifest) ? JSON.parse(readFileSync(manifest, "utf8")).scripts ?? {} : {};
  if (guided.length) return { source: "AGENTS.md", commands: [...guided, ...(scripts.test ? ["npm test"] : [])] };
  return { source: "limited", commands: [] };
}
