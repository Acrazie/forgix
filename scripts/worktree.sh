#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
COMMON_DIR="$(git -C "$REPO_ROOT" rev-parse --git-common-dir)"
PRIMARY_ROOT="$(cd "$REPO_ROOT" && cd "$COMMON_DIR/.." && pwd -P)"
WORKTREES_DIR="$PRIMARY_ROOT/.worktrees"

usage() {
  echo "Usage: $0 add <branch-name> [base-branch] | list | remove <branch-name>"
  exit 1
}

resolve_path() {
  local target="$1"
  local dir base link
  while [ -L "$target" ]; do
    dir="$(cd "$(dirname "$target")" 2>/dev/null && pwd -P)" || return 1
    base="$(basename "$target")"
    link="$(readlink "$dir/$base")" || return 1
    case "$link" in
      /*) target="$link" ;;
      *) target="$dir/$link" ;;
    esac
  done
  dir="$(cd "$(dirname "$target")" 2>/dev/null && pwd -P)" || return 1
  printf '%s/%s\n' "$dir" "$(basename "$target")"
}

is_blocked_path() {
  local rel_path="$1"
  case "$rel_path" in
    *.pem | *.key)
      return 0
      ;;
    node_modules | node_modules/* | */node_modules | */node_modules/*)
      return 0
      ;;
    dist | dist/* | */dist | */dist/*)
      return 0
      ;;
    .artifacts | .artifacts/* | */.artifacts | */.artifacts/*)
      return 0
      ;;
    .git | .git/* | */.git | */.git/*)
      return 0
      ;;
  esac
  return 1
}

copy_candidate_file() {
  local primary_root="$1"
  local dest_root="$2"
  local rel_path="$3"
  local resolved resolved_rel dest_file

  if is_blocked_path "$rel_path"; then
    return 0
  fi

  resolved="$(resolve_path "$primary_root/$rel_path")" || return 0
  case "$resolved" in
    "$primary_root"/*)
      resolved_rel="${resolved#"$primary_root/"}"
      ;;
    *)
      return 0
      ;;
  esac

  if is_blocked_path "$resolved_rel"; then
    return 0
  fi

  [ -f "$resolved" ] || return 0

  if ! git -C "$primary_root" check-ignore -q -- "$rel_path" 2>/dev/null; then
    return 0
  fi

  if git -C "$primary_root" ls-files --error-unmatch -- "$rel_path" >/dev/null 2>&1; then
    return 0
  fi

  dest_file="$dest_root/$rel_path"
  if [ -e "$dest_file" ] || [ -L "$dest_file" ]; then
    return 0
  fi

  mkdir -p "$(dirname "$dest_file")"
  cp -p "$resolved" "$dest_file"
}

copy_worktree_includes() {
  local primary_root="$1"
  local dest_root="$2"
  local include_file="$primary_root/.worktreeinclude"
  local old_nullglob old_ifs raw_line line trimmed_slash match resolved_dir sub_entry sub_rel
  local matches

  [ -f "$include_file" ] || return 0
  dest_root="$(cd "$dest_root" && pwd -P)"

  old_nullglob="$(shopt -p nullglob 2>/dev/null || true)"
  shopt -s nullglob

  while IFS= read -r raw_line || [ -n "$raw_line" ]; do
    line="${raw_line%$'\r'}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"

    case "$line" in
      '' | \#*) continue ;;
    esac

    while [ "${line#./}" != "$line" ]; do
      line="${line#./}"
    done

    case "$line" in
      '' | /* | .. | ../* | */.. | */../*) continue ;;
    esac

    trimmed_slash="${line%/}"
    if is_blocked_path "$trimmed_slash"; then
      continue
    fi

    old_ifs="${IFS-}"
    pushd "$primary_root" >/dev/null
    IFS=''
    matches=($line)
    if [ -n "$old_ifs" ]; then
      IFS="$old_ifs"
    else
      unset IFS
    fi
    popd >/dev/null

    [ "${#matches[@]}" -gt 0 ] || continue

    for match in "${matches[@]}"; do
      match="${match%/}"
      [ -n "$match" ] || continue

      if is_blocked_path "$match"; then
        continue
      fi

      if [ -d "$primary_root/$match" ]; then
        resolved_dir="$(cd "$primary_root/$match" 2>/dev/null && pwd -P)" || continue
        case "$resolved_dir" in
          "$primary_root" | "$primary_root"/*) ;;
          *) continue ;;
        esac

        while IFS= read -r -d '' sub_entry; do
          sub_rel="${sub_entry#"$primary_root/"}"
          copy_candidate_file "$primary_root" "$dest_root" "$sub_rel"
        done < <(find "$primary_root/$match" \( -type f -o -type l \) -print0)
      else
        copy_candidate_file "$primary_root" "$dest_root" "$match"
      fi
    done
  done <"$include_file"

  if [ -n "$old_nullglob" ]; then
    eval "$old_nullglob"
  fi
}

cmd="${1:-}"
branch="${2:-}"

case "$cmd" in
  add)
    if [ -z "$branch" ] || [ "$#" -gt 3 ]; then
      usage
    fi
    base_commit="$(node "$SCRIPT_DIR/resolve-worktree-base.ts" "${3-main}")"
    clean_name="${branch//\//-}"
    target="$WORKTREES_DIR/$clean_name"
    mkdir -p "$WORKTREES_DIR"
    echo "Creating worktree at $target for branch $branch..."
    git worktree add --no-track -b "$branch" -- "$target" "$base_commit"
    copy_worktree_includes "$PRIMARY_ROOT" "$target"
    if [ -f "$target/bun.lock" ] && [ ! -d "$target/node_modules" ]; then
      (cd "$target" && bun install --frozen-lockfile)
    fi
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
