#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKTREES_DIR="$REPO_ROOT/.worktrees"

usage() {
  echo "Usage: $0 {add|list|remove} [branch-name]"
  exit 1
}

cmd="${1:-}"
branch="${2:-}"

case "$cmd" in
  add)
    [ -z "$branch" ] && usage
    clean_name="${branch//\//-}"
    target="$WORKTREES_DIR/$clean_name"
    mkdir -p "$WORKTREES_DIR"
    git fetch origin main 2>/dev/null || true
    echo "Creating worktree at $target for branch $branch..."
    git worktree add "$target" -b "$branch" origin/main 2>/dev/null || git worktree add "$target" "$branch"
    echo "Worktree ready: $target"
    ;;
  list)
    git worktree list
    ;;
  remove)
    [ -z "$branch" ] && usage
    clean_name="${branch//\//-}"
    target="$WORKTREES_DIR/$clean_name"
    echo "Removing worktree at $target..."
    git worktree remove "$target"
    git worktree prune
    echo "Worktree removed."
    ;;
  *)
    usage
    ;;
esac
