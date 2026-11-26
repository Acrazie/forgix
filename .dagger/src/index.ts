import {
  argument,
  Container,
  dag,
  Directory,
  File,
  func,
  object,
} from "@dagger.io/dagger";

const NODE_VERSION = "26.8.1";
const NODE_IMAGE = `node:${NODE_VERSION}-bookworm-slim`;
const BUN_VERSION = "1.4.4";
const GIT_CLIFF_VERSION = "2.14.1";
const GIT_CLIFF_SHA256_X86_64 =
  "dfe9bef0c7a00d05fafe78e6e591a1a280d39dd495b8066764db0a559acde67f";
const GIT_CLIFF_SHA256_AARCH64 =
  "e99dc84135c6bc27aefc9d8226f7297119ed6750a32f45418f4587bc6cb260d8";

const TLC_JRE_IMAGE =
  "eclipse-temurin:21.0.13_9-jre@sha256:ca73b4d3961703d6d7830a4361f49ef0478f8f28b39defc07bb72f4cc7f834f6";
const TLC_JAR_URL = "https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar";
const TLC_JAR_CHECKSUM = "sha256:936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88";

const CI_IGNORE = [
  ".git",
  "node_modules",
  "**/node_modules",
  ".artifacts",
  ".fallow",
  ".worktrees",
  "formal/lean/.lake",
  "formal/lean/lake-manifest.json",
];
const RELEASE_IGNORE = ["node_modules", "**/node_modules", ".artifacts", ".fallow", ".worktrees"];

function aptInstall(container: Container, packages: readonly string[]): Container {
  return container.withExec([
    "sh",
    "-c",
    `apt-get update && apt-get install -y --no-install-recommends ${packages.join(" ")} && rm -rf /var/lib/apt/lists/*`,
  ]);
}

function installGitCliff(container: Container, installCurl = true): Container {
  const base = installCurl ? aptInstall(container, ["curl"]) : container;
  return base.withExec([
    "sh",
    "-c",
    [
      "set -eu",
      'arch="$(uname -m)"',
      'case "$arch" in',
      `  x86_64) target="x86_64-unknown-linux-gnu"; sha256="${GIT_CLIFF_SHA256_X86_64}" ;;`,
      `  aarch64|arm64) target="aarch64-unknown-linux-gnu"; sha256="${GIT_CLIFF_SHA256_AARCH64}" ;;`,
      '  *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;',
      "esac",
      `url="https://github.com/orhun/git-cliff/releases/download/v${GIT_CLIFF_VERSION}/git-cliff-${GIT_CLIFF_VERSION}-\${target}.tar.gz"`,
      'tmp="$(mktemp -d)"',
      'curl -fsSL "$url" -o "$tmp/git-cliff.tar.gz"',
      'echo "${sha256}  $tmp/git-cliff.tar.gz" | sha256sum -c -',
      'tar -xzf "$tmp/git-cliff.tar.gz" -C "$tmp"',
      `install -m 0755 "$tmp/git-cliff-${GIT_CLIFF_VERSION}/git-cliff" /usr/local/bin/git-cliff`,
      'rm -rf "$tmp"',
    ].join("\n"),
  ]);
}

function ciToolchain(): Container {
  return aptInstall(dag.container().from(NODE_IMAGE), [
    "git",
    "ca-certificates",
    "curl",
  ]).withExec(["npm", "install", "-g", `bun@${BUN_VERSION}`]);
}

function withCiDependencies(base: Container, source: Directory): Container {
  return base
    .withWorkdir("/workspace")
    .withEnvVariable("VP_GIT_HOOKS", "0")
    .withEnvVariable("BUN_INSTALL_CACHE_DIR", "/root/.bun/install/cache")
    .withMountedCache("/root/.bun/install/cache", dag.cacheVolume("forgix-bun-cache"))
    .withFile("/workspace/package.json", source.file("package.json"))
    .withFile("/workspace/bun.lock", source.file("bun.lock"))
    .withFile("/workspace/scripts/prepare-hooks.ts", source.file("scripts/prepare-hooks.ts"))
    .withExec(["bun", "install", "--frozen-lockfile"]);
}

function withCiWorkspace(
  base: Container,
  source: Directory,
  exclude: readonly string[],
): Container {
  return withCiDependencies(base, source).withDirectory("/workspace", source, {
    exclude: [...exclude],
  });
}

function ciContainer(
  source: Directory,
  exclude: readonly string[] = CI_IGNORE,
  withGitCliff = false,
): Container {
  const base = ciToolchain();
  return withCiWorkspace(withGitCliff ? installGitCliff(base, false) : base, source, exclude);
}

function releaseContainer(
  source: Directory,
  options: {
    tag: string;
    buildkite: string;
    buildkiteRepo: string;
    buildkiteCommit: string;
    buildkitePullRequest: string;
    cacheBuster: string;
  },
): Container {
  return installGitCliff(aptInstall(dag.container().from(NODE_IMAGE), ["git", "ca-certificates"]))
    .withDirectory("/workspace", source, { exclude: [...RELEASE_IGNORE] })
    .withWorkdir("/workspace")
    .withEnvVariable("DAGGER_CACHE_BUSTER", options.cacheBuster)
    .withEnvVariable("RELEASE_TAG", options.tag)
    .withEnvVariable("BUILDKITE", options.buildkite)
    .withEnvVariable("BUILDKITE_REPO", options.buildkiteRepo)
    .withEnvVariable("BUILDKITE_TAG", options.tag)
    .withEnvVariable("BUILDKITE_COMMIT", options.buildkiteCommit)
    .withEnvVariable("BUILDKITE_PULL_REQUEST", options.buildkitePullRequest);
}

@object()
export class ForgixCi {
  @func()
  async check(
    @argument({ defaultPath: "/", ignore: RELEASE_IGNORE }) source: Directory,
  ): Promise<Container> {
    return ciContainer(source, RELEASE_IGNORE, true)
      .withExec(["bun", "scripts/observe-command.ts", "Full Gate", "bun", "run", "check"])
      .sync();
  }

  @func()
  async formalLean(
    @argument({ defaultPath: "/", ignore: CI_IGNORE }) source: Directory,
  ): Promise<Container> {
    const base = aptInstall(ciToolchain(), ["elan"])
      .withEnvVariable("ELAN_HOME", "/root/.elan")
      .withMountedCache("/root/.elan", dag.cacheVolume("forgix-elan-cache"))
      .withFile("/opt/forgix/lean-toolchain", source.file("formal/lean/lean-toolchain"))
      .withWorkdir("/opt/forgix")
      .withExec(["lean", "--version"]);

    return withCiWorkspace(base, source, CI_IGNORE)
      .withExec(["bun", "scripts/verify-preparation-lean.ts"])
      .withExec(["bun", "scripts/verify-gate-lean.ts"])
      .withExec(["bun", "scripts/verify-assure-lean.ts"])
      .sync();
  }

  @func()
  async formalTla(
    @argument({ defaultPath: "/", ignore: CI_IGNORE }) source: Directory,
  ): Promise<Container> {
    const jar = dag.http(TLC_JAR_URL, { checksum: TLC_JAR_CHECKSUM });
    let container = dag
      .container()
      .from(TLC_JRE_IMAGE)
      .withWorkdir("/models")
      .withFile("/tools/tla2tools.jar", jar);

    for (const model of ["TaskLifecycleV6", "RoadmapParallel"]) {
      container = container
        .withFile(`${model}.tla`, source.file(`formal/tla/${model}.tla`))
        .withFile(`${model}.cfg`, source.file(`formal/tla/${model}.cfg`))
        .withExec([
          "java",
          "-Xmx512m",
          "-XX:+UseParallelGC",
          "-jar",
          "/tools/tla2tools.jar",
          "-workers",
          "1",
          "-config",
          `${model}.cfg`,
          `${model}.tla`,
        ]);
    }
    return container.sync();
  }

  @func()
  async diffGate(
    @argument({ defaultPath: "/", ignore: RELEASE_IGNORE }) source: Directory,
  ): Promise<Container> {
    return ciContainer(source, RELEASE_IGNORE)
      .withExec(["sh", "-c", "bun install --frozen-lockfile && bun run check:diff"])
      .sync();
  }

  @func()
  async deadCodeReport(
    @argument({ defaultPath: "/", ignore: CI_IGNORE }) source: Directory,
  ): Promise<File> {
    const report = "/workspace/fallow-dead-code.json";
    return ciContainer(source)
      .withExec(["bun", "run", "--silent", "check:dead-code", "--output-file", report])
      .file(report);
  }

  @func()
  async packRuntime(
    @argument({ defaultPath: "/", ignore: CI_IGNORE }) source: Directory,
  ): Promise<File> {
    const container = await ciContainer(source)
      .withExec(["sh", "-c", "bun run build && bun run pack:runtime"])
      .sync();
    return container.file("/workspace/.artifacts/forgix.tgz");
  }

  @func()
  async runtimeSmoke(
    @argument({ defaultPath: "/", ignore: CI_IGNORE }) source: Directory,
    tarball: File,
  ): Promise<Container> {
    return aptInstall(dag.container().from(NODE_IMAGE), ["git"])
      .withDirectory("/workspace", source, { exclude: [...CI_IGNORE] })
      .withWorkdir("/workspace")
      .withFile("/workspace/.artifacts/forgix.tgz", tarball)
      .withExec(["node", "--test", "test/runtime/runtime-smoke.test.mjs"])
      .sync();
  }

  @func()
  async prepareReleaseFiles(
    @argument({ defaultPath: "/", ignore: RELEASE_IGNORE }) source: Directory,
    version: string,
    now = "",
  ): Promise<Directory> {
    const args = ["bun", "scripts/release-auto.ts", "prepare-files", "--version", version];
    if (now) args.push("--now", now);
    const container = await ciContainer(source, RELEASE_IGNORE, true).withExec(args).sync();
    let out = dag.directory();
    for (const file of [
      "package.json",
      "bun.lock",
      ".codex-plugin/plugin.json",
      ".claude-plugin/plugin.json",
      "plugin.json",
      ".claude-plugin/marketplace.json",
      "dist/forgix.mjs",
      "CHANGELOG.md",
    ]) {
      out = out.withFile(file, container.file(`/workspace/${file}`));
    }
    return out;
  }

  @func()
  async releaseContract(
    @argument({ defaultPath: "/", ignore: RELEASE_IGNORE }) source: Directory,
  ): Promise<Container> {
    return ciContainer(source, RELEASE_IGNORE, true).withExec(["bun", "run", "release:test"]).sync();
  }

  @func()
  async releaseCandidate(
    @argument({ defaultPath: "/", ignore: RELEASE_IGNORE }) source: Directory,
    tag: string,
    buildkite: string,
    buildkiteRepo: string,
    buildkiteCommit: string,
    cacheBuster: string,
    buildkitePullRequest = "",
  ): Promise<Directory> {
    await ciContainer(source, RELEASE_IGNORE)
      .withExec(["sh", "-c", "bun run build && git diff --exit-code -- dist/forgix.mjs"])
      .sync();

    const release = await releaseContainer(source, {
      tag,
      buildkite,
      buildkiteRepo,
      buildkiteCommit,
      buildkitePullRequest,
      cacheBuster,
    })
      .withExec(["node", "scripts/release-ci.ts", "candidate"])
      .sync();

    return release.directory("/workspace/.artifacts");
  }
}
