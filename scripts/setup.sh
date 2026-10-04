#!/usr/bin/env bash
set -euo pipefail

echo "==> Setting up development environment for codex-dev-flow..."

# 1. Copy environment template if not present
if [ -f ".env.example" ] && [ ! -f ".env" ]; then
  echo "--> Creating .env from .env.example"
  cp .env.example .env
fi

# Husky previously redirected hooks to .husky/_. Restore Git's default only
# for that legacy repository-local setting; preserve unrelated custom paths.
if [ "$(git config --local --get core.hooksPath || true)" = ".husky/_" ]; then
  git config --local --unset core.hooksPath
fi

# Install dependencies reproducibly. The prepare script installs Lefthook.
echo "--> Installing dependencies via bun..."
bun install --frozen-lockfile


echo "==> Setup completed successfully!"
