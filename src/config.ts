export interface ConfigSource {
  source: string;
  value: Record<string, unknown>;
}

export interface ResolvedConfig {
  value: Record<string, unknown>;
  provenance: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function copy(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(copy);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copy(entry)]));
  return value;
}

function merge(
  target: Record<string, unknown>,
  incoming: Record<string, unknown>,
  source: string,
  provenance: Record<string, string>,
  prefix = ""
): void {
  for (const [key, incomingValue] of Object.entries(incoming)) {
    const path = prefix ? prefix + "." + key : key;
    const targetValue = target[key];
    if (isRecord(targetValue) && isRecord(incomingValue)) {
      merge(targetValue, incomingValue, source, provenance, path);
      continue;
    }
    target[key] = copy(incomingValue);
    if (isRecord(incomingValue)) {
      for (const nested of Object.keys(incomingValue)) {
        provenance[path + "." + nested] = source;
      }
    } else {
      provenance[path] = source;
    }
  }
}

export function resolveConfig(sources: ConfigSource[]): ResolvedConfig {
  const value: Record<string, unknown> = {};
  const provenance: Record<string, string> = {};
  for (const source of sources) merge(value, source.value, source.source, provenance);
  return { value, provenance };
}
