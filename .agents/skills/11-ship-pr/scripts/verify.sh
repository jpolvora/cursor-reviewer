#!/usr/bin/env bash
# Project-agnostic verification gate (build + tests; frontend when touched).
# Reads config.json for commands; falls back to env vars / sane defaults.
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
config_file="$repo_root/.agents/skills/shared/config.json"
base_branch="${SHIP_PR_BASE:-$("$script_dir/detect-base-branch.sh")}"

frontend_touched() {
  {
    git diff --name-only
    git diff --cached --name-only
    git diff --name-only "$base_branch"...HEAD 2>/dev/null || true
  } | grep -q '^web/'
}

# Always UTF-8 — bare open() uses Windows locale (cp1252) and can UnicodeDecodeError.
read_verification_config() {
  python3 -c "
from pathlib import Path
import json
cfg = Path(r'''$config_file''')
c = json.loads(cfg.read_text(encoding='utf-8'))
v = c.get('verification', {}) or {}
s = (c.get('stack', {}) or {}).get('frontend', {}) or {}
print(v.get('backendBuild') or '')
print(v.get('backendTest') or '')
print(v.get('frontendBuild') or '')
print(v.get('frontendTest') or '')
print((s.get('sourceDir') or 'web').split('/')[0])
"
}

echo "==> verify (base: $base_branch)"

if [ -f "$config_file" ]; then
  {
    read -r backend_build
    read -r backend_test
    read -r frontend_build
    read -r frontend_test
    read -r frontend_dir
  } < <(read_verification_config)
  frontend_dir="${frontend_dir:-web}"
else
  echo "==> No config.json found — using fallback commands"
  backend_build="dotnet build"
  backend_test="dotnet test"
  frontend_build="npm run build"
  frontend_test="npm test"
  frontend_dir="web"
fi

echo "==> $backend_build"
eval "$backend_build"

echo "==> $backend_test"
eval "$backend_test"

if frontend_touched; then
  echo "==> $frontend_dir/ touched — $frontend_test + $frontend_build"
  eval "$frontend_test" 2>/dev/null || true
  eval "$frontend_build"
else
  echo "==> $frontend_dir/ not touched — skipping frontend"
fi

echo "VERIFY_OK"
