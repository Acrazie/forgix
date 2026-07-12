import readline from "node:readline";

readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  if (request.method === "initialized") return;
  if (request.method === "initialize") {
    process.stdout.write(JSON.stringify({ id: request.id, result: {} }) + "\n");
    process.stdout.write(JSON.stringify({ method: "initialized", params: {} }) + "\n");
    return;
  }
  process.stdout.write(JSON.stringify({ id: request.id, error: { code: -1, message: "token=secret-token" } }) + "\n");
});
