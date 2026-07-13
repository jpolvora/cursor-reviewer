#!/usr/bin/env bash
# Project-agnostic verification gate (build + tests; frontend when touched).
# Reads config.json for commands; falls back to env vars / sane defaults.
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
config_file="$repo_root/.agents/skills/spec-to-pr/config.json"
base_branch="${SHIP_PR_BASE:-$("$script_dir/detect-base-branch.sh")}"

frontend_touched() {
  {
    git diff --name-only
    git diff --cached --name-only
    git diff --name-only "$base_branch"...HEAD 2>/dev/null || true
  } | grep -q '^web/'
}

read_config() {
  python3 -c "
import json, sys
with open('$config_file') as f:
    c = json.load(f)
v = c.get('verification', {})
s = c.get('stack', {})
print(v.get('$1', ''))
print(s.get('frontend', {}).get('sourceDir', 'web').split('/')[0])
"
}

echo "==> verify (base: $base_branch)"

if [ -f "$config_file" ]; then
  backend_build=$(python3 -c "import json;f=open('$config_file');c=json.load(f);print(c['verification']['backendBuild'])" 2>/dev/null || echo "")
  backend_test=$(python3 -c "import json;f=open('$config_file');c=json.load(f);print(c['verification']['backendTest'])" 2>/dev/null || echo "")
  frontend_build=$(python3 -c "import json;f=open('$config_file');c=json.load(f);print(c['verification']['frontendBuild'])" 2>/dev/null || echo "")
  frontend_test=$(python3 -c "import json;f=open('$config_file');c=json.load(f);print(c['verification']['frontendTest'])" 2>/dev/null || echo "")
  frontend_dir=$(python3 -c "import json;f=open('$config_file');c=json.load(f);print(c['stack']['frontend']['sourceDir'].split('/')[0])" 2>/dev/null || echo "web")
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
