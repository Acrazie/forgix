import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "bun:test";
import { requireCommand } from "../plugins/forgix/scripts/release-lib.ts";

// Run the real native CLI in a disposable repository, replacing only external
// GitHub/npm executables and HTTP. No production command can reach a real registry.
function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "forgix-publish-contract-"));
  const copy = (path: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    cpSync(new URL(`../${path}`, import.meta.url), join(root, path));
  };
  for (const path of [
    "scripts/release-ci.ts",
    "plugins/forgix/scripts/release-lib.ts",
    "plugins/forgix/scripts/release-notes.ts",
    "plugins/forgix/package.json",
    "plugins/forgix/.codex-plugin/plugin.json",
    "plugins/forgix/.claude-plugin/plugin.json",
    "plugins/forgix/plugin.json",
    ".claude-plugin/marketplace.json",
  ])
    copy(path);
  for (const path of [
    "plugins/forgix/package.json",
    "plugins/forgix/.claude-plugin/plugin.json",
    "plugins/forgix/plugin.json",
  ]) {
    const value = JSON.parse(readFileSync(join(root, path), "utf8"));
    value.version = "2.0.0";
    writeFileSync(join(root, path), JSON.stringify(value));
  }
  const codexPath = join(root, "plugins/forgix/.codex-plugin/plugin.json");
  const codex = JSON.parse(readFileSync(codexPath, "utf8"));
  codex.version = "2.0.0+codex.20261115120000";
  writeFileSync(codexPath, JSON.stringify(codex));
  const marketPath = join(root, ".claude-plugin/marketplace.json");
  const market = JSON.parse(readFileSync(marketPath, "utf8"));
  market.plugins[0].version = "2.0.0";
  writeFileSync(marketPath, JSON.stringify(market));
  const git = (args: string[]) => requireCommand("git", args, { cwd: root }).stdout.trim();
  git(["init", "-b", "main"]);
  git(["config", "user.name", "Release test"]);
  git(["config", "user.email", "release@example.invalid"]);
  git(["add", "."]);
  git(["-c", "commit.gpgsign=false", "commit", "-m", "chore(release): v2.0.0"]);
  const sha = git(["rev-parse", "HEAD"]);
  git(["tag", "v2.0.0"]);
  git(["update-ref", "refs/remotes/origin/main", sha]);
  const artifacts = join(root, ".artifacts");
  mkdirSync(artifacts);
  const bytes = Buffer.from("immutable tested tarball fixture");
  writeFileSync(join(artifacts, "forgix.tgz"), bytes);
  const notes = "Prepared immutable notes\n";
  writeFileSync(join(artifacts, "RELEASE_NOTES.md"), notes);
  const evidence = {
    tag: "v2.0.0",
    sha,
    target: "both",
    version: "2.0.0",
    pluginVersion: codex.version,
    integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
    notesSha256: createHash("sha256").update(notes).digest("hex"),
  };
  writeFileSync(join(artifacts, "release.json"), JSON.stringify(evidence));
  const statement = {
    predicateType: "https://slsa.dev/provenance/v1",
    subject: [
      {
        name: "pkg:npm/%40acrasie/forgix@2.0.0",
        digest: { sha512: createHash("sha512").update(bytes).digest("hex") },
      },
    ],
    predicate: {
      buildDefinition: {
        externalParameters: {
          workflow: {
            repository: "https://github.com/Acrazie/forgix",
            ref: "refs/tags/v2.0.0",
            path: ".github/workflows/release.yml",
          },
        },
        resolvedDependencies: [
          {
            uri: "git+https://github.com/Acrazie/forgix@refs/tags/v2.0.0",
            digest: { gitCommit: sha },
          },
        ],
      },
    },
  };
  const audit = {
    invalid: [],
    missing: [],
    verified: [
      {
        name: "@acrasie/forgix",
        version: "2.0.0",
        attestationBundles: [
          {
            predicateType: statement.predicateType,
            bundle: {
              dsseEnvelope: { payload: Buffer.from(JSON.stringify(statement)).toString("base64") },
            },
          },
        ],
      },
    ],
  };
  const statePath = join(root, "state.json");
  const initial = {
    sha,
    tag: "v2.0.0",
    integrity: evidence.integrity,
    published: false,
    github: null as null | { tag_name: string; draft: boolean; prerelease: boolean; body: string },
    latest: "1.0.1",
    calls: [] as string[],
    failAfterPublish: false,
    audit,
    private: false,
    lookupStatus: 200,
    remoteSha: sha,
  };
  writeFileSync(statePath, JSON.stringify(initial));
  const state = () => JSON.parse(readFileSync(statePath, "utf8")) as typeof initial;
  const update = (change: Partial<typeof initial>) =>
    writeFileSync(statePath, JSON.stringify({ ...state(), ...change }));
  const bin = join(root, "bin");
  mkdirSync(bin);
  const executable = `#!/usr/bin/env node
import fs from 'node:fs';
const path=process.env.FORGIX_TEST_STATE;const s=JSON.parse(fs.readFileSync(path,'utf8'));const args=process.argv.slice(2);const name=process.argv[1].split('/').pop();
s.calls.push(name+' '+args.join(' '));
const save=()=>fs.writeFileSync(path,JSON.stringify(s));
if(name==='gh'){
 if(args[0]==='api'){
  if(args[1].includes('/git/ref/tags/'))console.log(JSON.stringify({object:{type:'commit',sha:s.remoteSha}}));
  else console.log(JSON.stringify({private:s.private,full_name:'Acrazie/forgix'}));
 }else if(args[0]==='release'&&args[1]==='create'){
  s.github={tag_name:s.tag,draft:false,prerelease:false,body:fs.readFileSync(args[args.indexOf('--notes-file')+1],'utf8')};
 }
}else if(args[0]==='publish'){
 s.published=true;s.latest='2.0.0';save();if(s.failAfterPublish)process.exit(1);
}else if(args[0]==='audit'){console.log(JSON.stringify(s.audit));}
else if(args[0]!=='install'){throw new Error('Unexpected mock command '+args.join(' '));}
save();
`;
  for (const name of ["npm", "gh"]) {
    writeFileSync(join(bin, name), executable);
    chmodSync(join(bin, name), 0o755);
  }
  const preload = join(root, "http.mjs");
  writeFileSync(
    preload,
    `
import fs from 'node:fs';
globalThis.fetch=async(input)=>{
 const s=JSON.parse(fs.readFileSync(process.env.FORGIX_TEST_STATE,'utf8'));const url=String(input);
 if(url.startsWith('https://registry.npmjs.org/')){
  if(url.endsWith('/latest'))return Response.json({version:s.latest});
  if(s.lookupStatus!==200)return new Response('',{status:s.lookupStatus});
  return s.published?Response.json({name:'@acrasie/forgix',version:'2.0.0',dist:{integrity:s.integrity,attestations:{url:'unused'}}}):new Response('',{status:404});
 }
 if(url.startsWith('https://api.github.com/repos/Acrazie/forgix/releases/tags/'))return s.github?Response.json(s.github):new Response('',{status:404});
 if(url.endsWith('/releases/latest'))return Response.json({tag_name:'v1.0.1'});
 throw new Error('Unexpected network blocked: '+url);
};
`,
  );
  const run = (phase: string) =>
    Bun.spawnSync(["node", "--import", preload, "scripts/release-ci.ts", phase], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        FORGIX_TEST_STATE: statePath,
        RELEASE_TAG: "v2.0.0",
        GITHUB_REPOSITORY: "Acrazie/forgix",
        GITHUB_EVENT_NAME: "workflow_dispatch",
        GITHUB_REF: "refs/tags/v2.0.0",
        GITHUB_SHA: sha,
        GITHUB_WORKFLOW_REF: "Acrazie/forgix/.github/workflows/release.yml@refs/tags/v2.0.0",
        GH_TOKEN: "test-only",
      },
    });
  return { root, run, state, update, close: () => rmSync(root, { recursive: true, force: true }) };
}

describe("native publication CLI with isolated external boundaries", () => {
  test("publishes once and resumes missing GitHub step without republishing npm", () => {
    const s = sandbox();
    try {
      const npm = s.run("npm");
      expect(npm.exitCode, npm.stderr.toString()).toBe(0);
      expect(s.state().published).toBe(true);
      const github = s.run("github");
      expect(github.exitCode, github.stderr.toString()).toBe(0);
      expect(s.state().github?.body).toContain("forgix-source:");
      expect(s.run("npm").exitCode).toBe(0);
      expect(s.run("github").exitCode).toBe(0);
      expect(s.state().calls.filter((c) => c.startsWith("npm publish"))).toHaveLength(1);
      expect(s.state().calls.filter((c) => c.startsWith("gh release create"))).toHaveLength(1);
    } finally {
      s.close();
    }
  });
  test("reconciles acceptance followed by timeout, but refuses different bytes", () => {
    const s = sandbox();
    try {
      s.update({ failAfterPublish: true });
      expect(s.run("npm").exitCode).toBe(1);
      expect(s.state().published).toBe(true);
      expect(s.run("npm").exitCode).toBe(0);
      expect(s.state().calls.filter((c) => c.startsWith("npm publish"))).toHaveLength(1);
      s.update({ integrity: "sha512-different" });
      expect(s.run("npm").stderr.toString()).toContain("different integrity");
    } finally {
      s.close();
    }
  });
  test("blocks moved tags, private sources, registry outages and stale latest before publish", () => {
    const s = sandbox();
    try {
      s.update({ remoteSha: "b".repeat(40) });
      expect(s.run("npm").stderr.toString()).toContain("Remote tag moved");
      s.update({ remoteSha: s.state().sha, private: true });
      expect(s.run("npm").stderr.toString()).toContain("Public source");
      s.update({ private: false, lookupStatus: 503 });
      expect(s.run("npm").stderr.toString()).toContain("HTTP 503");
      s.update({ lookupStatus: 200, latest: "3.0.0" });
      expect(s.run("npm").stderr.toString()).toContain("regress npm latest");
      expect(s.state().calls.some((c) => c.startsWith("npm publish"))).toBe(false);
    } finally {
      s.close();
    }
  });
  test("never overwrites incompatible existing GitHub notes", () => {
    const s = sandbox();
    try {
      s.update({
        published: true,
        github: { tag_name: "v2.0.0", draft: false, prerelease: false, body: "incompatible" },
      });
      expect(s.run("github").stderr.toString()).toContain("incompatible identity or notes");
      expect(s.state().calls.some((c) => c.startsWith("gh release create"))).toBe(false);
    } finally {
      s.close();
    }
  });
});
