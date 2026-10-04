#!/usr/bin/env bash
set -euo pipefail

echo "==> Setting up development environment for codex-dev-flow..."

# 1. Copy environment template if not present
if [ -f ".env.example" ] && [ ! -f ".env" ]; then
  echo "--> Creating .env from .env.example"
  cp .env.example .env
fi

# 2. Install dependencies with bun
echo "--> Installing dependencies via bun..."
bun install

# 3. Setup git hooks with lefthook
echo "--> Installing git hooks via lefthook..."
bunx lefthook install

echo "==> Setup completed successfully!"
