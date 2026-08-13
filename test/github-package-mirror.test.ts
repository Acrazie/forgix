import { describe, expect, test } from "bun:test";
import {
  destinationVersionState,
  DESTINATION_PACKAGE,
  MirrorError,
  parsePublishedVersions,
  transformPackageManifest,
  versionsForSelector,
} from "../scripts/mirror-npm-to-github.ts";

const manifest = `{
  "name": "codex-dev-flow",
  "version": "0.3.2",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Acrazie/codex-dev-flow.git",
    "directory": "plugins/codex-dev-flow"
  },
  "description": "codex-dev-flow remains text here"
}
`;

describe("GitHub package mirror selection", () => {
  test("maps stable release selectors and excludes plugin-only releases", () => {
    expect(versionsForSelector("0.3.2")).toEqual(["0.3.2"]);
    expect(versionsForSelector("v0.3.2")).toEqual(["0.3.2"]);
    expect(versionsForSelector("npm-v0.3.2")).toEqual(["0.3.2"]);
    expect(versionsForSelector("plugin-v0.3.2-codex.20260813133125")).toEqual([]);
  });

  test("sorts and deduplicates all stable npm versions", () => {
    const published = parsePublishedVersions(
      JSON.stringify(["0.3.2", "0.1.0", "0.3.2", "0.2.0-beta.1", "0.2.0"]),
    );
    expect(published).toEqual(["0.1.0", "0.2.0", "0.3.2"]);
    expect(versionsForSelector("all", published)).toEqual(["0.1.0", "0.2.0", "0.3.2"]);
  });

  test("rejects malformed or prerelease selectors", () => {
    for (const selector of ["", "v", "v0.3.2-beta.1", "01.0.0", "latest"]) {
      expect(() => versionsForSelector(selector)).toThrow(MirrorError);
    }
    expect(() => versionsForSelector("all")).toThrow(/requires discovered/);
  });
});

describe("GitHub package mirror manifest", () => {
  test("changes only package identity bytes", () => {
    const transformed = transformPackageManifest(manifest, "0.3.2");
    expect(transformed).toBe(
      manifest.replace('"name": "codex-dev-flow"', `"name": "${DESTINATION_PACKAGE}"`),
    );
    expect(JSON.parse(transformed).description).toBe("codex-dev-flow remains text here");
  });

  test("rejects source identity, version, and repository drift", () => {
    expect(() => transformPackageManifest(manifest.replace("0.3.2", "0.3.1"), "0.3.2")).toThrow(
      /version/,
    );
    expect(() => transformPackageManifest(manifest.replace("Acrazie", "someone"), "0.3.2")).toThrow(
      /repository/,
    );
    expect(() =>
      transformPackageManifest(
        manifest.replace('"name": "codex-dev-flow"', '"name": "other"'),
        "0.3.2",
      ),
    ).toThrow(/name/);
  });
});

describe("GitHub package mirror idempotency", () => {
  test("skips only an exact existing destination version", () => {
    expect(destinationVersionState({ status: 0, stdout: '"0.3.2"\n', stderr: "" }, "0.3.2")).toBe(
      "exists",
    );
    expect(
      destinationVersionState(
        { status: 1, stdout: "", stderr: "npm error code E404\nnpm error 404 Not Found" },
        "0.3.2",
      ),
    ).toBe("missing");
  });

  test("blocks unexpected registry and authentication responses", () => {
    expect(() =>
      destinationVersionState({ status: 0, stdout: '"0.3.1"', stderr: "" }, "0.3.2"),
    ).toThrow(/unexpected version/);
    expect(() =>
      destinationVersionState({ status: 1, stdout: "", stderr: "npm error code E401" }, "0.3.2"),
    ).toThrow(/Cannot query/);
  });
});
