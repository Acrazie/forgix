export interface MarkerPair {
  readonly start: string;
  readonly end: string;
}

export const HTML_FORGIX_MARKERS: MarkerPair = {
  start: "<!-- forgix:start -->",
  end: "<!-- forgix:end -->",
};

export const HASH_FORGIX_MARKERS: MarkerPair = {
  start: "# forgix:start",
  end: "# forgix:end",
};

export interface MarkerConflict {
  code: "duplicate_markers" | "orphan_marker" | "reversed_markers";
  message: string;
}

export type MarkerInspection =
  | { status: "absent" }
  | {
      status: "present";
      blockStartOffset: number;
      blockEndOffset: number;
      innerContent: string;
    }
  | { status: "conflict"; conflict: MarkerConflict };

export type MarkerMutationResult =
  | { ok: true; content: string | undefined }
  | { ok: false; conflict: MarkerConflict };

interface LineSpan {
  start: number;
  end: number;
  text: string;
}

function splitLineSpans(content: string): LineSpan[] {
  const spans: LineSpan[] = [];
  let offset = 0;
  while (offset < content.length) {
    const newlineIndex = content.indexOf("\n", offset);
    if (newlineIndex === -1) {
      spans.push({
        start: offset,
        end: content.length,
        text: content.slice(offset),
      });
      break;
    }
    spans.push({
      start: offset,
      end: newlineIndex + 1,
      text: content.slice(offset, newlineIndex),
    });
    offset = newlineIndex + 1;
  }
  return spans;
}

export function inspectMarkerBlock(content: string, markers: MarkerPair): MarkerInspection {
  const spans = splitLineSpans(content);
  const startIndices: number[] = [];
  const endIndices: number[] = [];

  for (let i = 0; i < spans.length; i += 1) {
    const trimmed = spans[i]!.text.replace(/\r$/, "").trim();
    if (trimmed === markers.start) startIndices.push(i);
    if (trimmed === markers.end) endIndices.push(i);
  }

  if (startIndices.length === 0 && endIndices.length === 0) {
    return { status: "absent" };
  }

  if (startIndices.length > 1 || endIndices.length > 1) {
    return {
      status: "conflict",
      conflict: {
        code: "duplicate_markers",
        message: `Duplicate Forgix markers (${markers.start} / ${markers.end}) detected.`,
      },
    };
  }

  if (startIndices.length !== 1 || endIndices.length !== 1) {
    return {
      status: "conflict",
      conflict: {
        code: "orphan_marker",
        message: `Unmatched Forgix marker (${markers.start} / ${markers.end}) detected.`,
      },
    };
  }

  const startIdx = startIndices[0]!;
  const endIdx = endIndices[0]!;
  if (endIdx < startIdx) {
    return {
      status: "conflict",
      conflict: {
        code: "reversed_markers",
        message: `Forgix end marker appears before start marker (${markers.start} / ${markers.end}).`,
      },
    };
  }

  const startSpan = spans[startIdx]!;
  const endSpan = spans[endIdx]!;
  const innerContent = content.slice(startSpan.end, endSpan.start);

  return {
    status: "present",
    blockStartOffset: startSpan.start,
    blockEndOffset: endSpan.end,
    innerContent,
  };
}

export function formatMarkerBlock(markers: MarkerPair, body: string): string {
  const trimmed = body.trimEnd();
  if (!trimmed) {
    return `${markers.start}\n${markers.end}\n`;
  }
  return `${markers.start}\n${trimmed}\n${markers.end}\n`;
}

export function upsertMarkerBlock(
  existing: string | undefined,
  markers: MarkerPair,
  body: string,
): MarkerMutationResult {
  const renderedBlock = formatMarkerBlock(markers, body);
  if (existing === undefined || existing === "") {
    return { ok: true, content: renderedBlock };
  }

  const inspection = inspectMarkerBlock(existing, markers);
  if (inspection.status === "conflict") {
    return { ok: false, conflict: inspection.conflict };
  }

  if (inspection.status === "present") {
    const before = existing.slice(0, inspection.blockStartOffset);
    const after = existing.slice(inspection.blockEndOffset);
    return { ok: true, content: `${before}${renderedBlock}${after}` };
  }

  if (existing.endsWith("\n\n")) {
    return { ok: true, content: `${existing}${renderedBlock}` };
  }
  if (existing.endsWith("\n")) {
    return { ok: true, content: `${existing}\n${renderedBlock}` };
  }
  return { ok: true, content: `${existing}\n\n${renderedBlock}` };
}

export function removeMarkerBlock(
  existing: string | undefined,
  markers: MarkerPair,
): MarkerMutationResult {
  if (existing === undefined) {
    return { ok: true, content: undefined };
  }

  const inspection = inspectMarkerBlock(existing, markers);
  if (inspection.status === "conflict") {
    return { ok: false, conflict: inspection.conflict };
  }
  if (inspection.status === "absent") {
    return { ok: true, content: existing };
  }

  const before = existing.slice(0, inspection.blockStartOffset);
  const after = existing.slice(inspection.blockEndOffset);

  if (before === "" && after === "") {
    return { ok: true, content: undefined };
  }

  let combined: string;
  if (after === "" && before.endsWith("\n\n")) {
    combined = before.slice(0, -1);
  } else if (before === "" && after.startsWith("\n")) {
    combined = after.slice(1);
  } else {
    combined = `${before}${after}`;
  }

  return { ok: true, content: combined === "" ? undefined : combined };
}
