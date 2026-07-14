import readline from "node:readline";

const responses = {
  initialize: { userAgent: "fixture", codexHome: "/tmp/codex", platformFamily: "test", platformOs: "test" },
  "account/read": { account: { type: "chatgpt", email: "person@example.com", planType: "pro_20x" }, requiresOpenaiAuth: true },
  "account/rateLimits/read": {
    rateLimits: {
      primary: { windowDurationMins: 300, usedPercent: 42, resetsAt: 1780000000 },
      secondary: { windowDurationMins: 10080, usedPercent: 91, resetsAt: 1780500000 }
    }
  },
  "model/list": {
    data: [
      { id: "gpt-5.6-luna", supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max"].map((reasoningEffort) => ({ reasoningEffort, description: reasoningEffort })) },
      { id: "gpt-5.6-terra", supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max"].map((reasoningEffort) => ({ reasoningEffort, description: reasoningEffort })) },
      { id: "gpt-5.6-sol", supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max", "ultra"].map((reasoningEffort) => ({ reasoningEffort, description: reasoningEffort })) },
      { id: "gpt-5.5", supportedReasoningEfforts: [{ reasoningEffort: "high", description: "high" }] }
    ]
  }
};

const input = readline.createInterface({ input: process.stdin });
input.on("line", (line) => {
  const request = JSON.parse(line);
  if (request.method === "initialized") return;
  const result = responses[request.method];
  process.stdout.write(JSON.stringify({ id: request.id, result }) + "\n");
  if (request.method === "initialize") process.stdout.write(JSON.stringify({ method: "initialized", params: {} }) + "\n");
});
