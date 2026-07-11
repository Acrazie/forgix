import { createHash, randomUUID } from "node:crypto";

export interface FailureInput {
  check: string;
  stage: string;
  errorType: string;
  path: string;
  symbol: string;
  messagePattern: string;
  line?: number;
  rawMessage?: string;
}

export function fingerprintFailure(input: FailureInput) {
  const canonical = {
    check: input.check,
    stage: input.stage,
    errorType: input.errorType,
    path: input.path,
    symbol: input.symbol,
    messagePattern: input.messagePattern,
    rawMessage: "[redacted]"
  };
  const issueId = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  return { issueId, occurrenceId: randomUUID(), canonical };
}
