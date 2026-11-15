#!/usr/bin/env bash
set -euo pipefail

echo "==> Setting up development environment for forgix..."

# 1. Copy environment template if not present
if [ -f ".env.example" ] && [ ! -f ".env" ]; then
  echo "--> Creating .env from .env.example"
  cp .env.example .env
fi

# Install dependencies reproducibly. The prepare script configures project hooks
# without changing shared Git settings from a linked worktree.
echo "--> Installing dependencies via bun..."
bun install --frozen-lockfile

if ! command -v fluidise-clint >/dev/null 2>&1; then
  echo "fluidise-clint 0.1.0 is required for commit hooks; see CONTRIBUTING.md." >&2
  exit 1
fi

echo "==> Setup completed successfully!"
