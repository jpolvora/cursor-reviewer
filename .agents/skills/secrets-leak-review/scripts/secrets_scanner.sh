#!/usr/bin/env bash
# secrets_scanner.sh — Deterministic secret/leak scan for repository
# Usage: bash .agents/skills/secrets-leak-review/scripts/secrets_scanner.sh
set -euo pipefail

# If GIT_STAGED_ONLY=1, only scan files staged for commit
STAGED_ONLY="${GIT_STAGED_ONLY:-0}"

# Dependency check
for cmd in rg git; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' not found. Install ripgrep (rg) and git."
    exit 1
  fi
done

RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
cd "$REPO_ROOT"

# Staged-only filter: when active, only report findings from staged files
STAGED_LIST=""
if [ "$STAGED_ONLY" = "1" ]; then
  STAGED_LIST=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)
fi
is_staged() {
  [ "$STAGED_ONLY" != "1" ] && return 0
  local f="$1"
  echo "$STAGED_LIST" | rg -qFx "$f" && return 0
  return 1
}

HIGH_FILE=$(mktemp)
MED_FILE=$(mktemp)
IGNORE_FILE=$(mktemp)

cleanup() { rm -f "$HIGH_FILE" "$MED_FILE" "$IGNORE_FILE"; }
trap cleanup EXIT

# Helper: append finding (with staged filter)
high() {
  local file="${1%%|*}"
  if [ "$file" = "." ] || is_staged "$file"; then
    echo "$1" >> "$HIGH_FILE"
  fi
}
medium() {
  local file="${1%%|*}"
  if [ "$file" = "." ] || is_staged "$file"; then
    echo "$1" >> "$MED_FILE"
  fi
}

echo -e "${BLUE}Scanning $(basename "$(pwd)") for secrets & leaks...${NC}"
echo ""

# ── Pattern-based scan ──────────────────────────────────────────────

# AWS keys
while IFS=: read -r file line rest; do
  high "$file|$line|AWS Access Key|$rest"
done < <(rg -n --no-ignore 'AKIA[0-9A-Z]{16}' --type-add 'all:*' -t all 2>/dev/null | rg -v 'allowlist secret' || true)

# GitHub tokens
while IFS=: read -r file line rest; do
  high "$file|$line|GitHub Token|$rest"
done < <(rg -n --no-ignore 'gh[ps]_[a-zA-Z0-9]{36,}|github_pat_[a-zA-Z0-9]{36,}' --type-add 'all:*' -t all 2>/dev/null | rg -v 'allowlist secret' || true)

# Slack tokens
while IFS=: read -r file line rest; do
  high "$file|$line|Slack Token|$rest"
done < <(rg -n --no-ignore 'xox[bpras]-[0-9a-zA-Z-]{24,}' --type-add 'all:*' -t all 2>/dev/null | rg -v 'allowlist secret' || true)

# OpenAI / generic API keys
while IFS=: read -r file line rest; do
  high "$file|$line|API Key (sk-...)|$rest"
done < <(rg -n --no-ignore 'sk-[a-zA-Z0-9]{32,}' --type-add 'all:*' -t all 2>/dev/null | rg -v 'allowlist secret' || true)

# Private keys
while IFS=: read -r file line rest; do
  high "$file|$line|Private Key|$rest"
done < <(rg -n --no-ignore '-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )PRIVATE KEY-----' --type-add 'all:*' -t all 2>/dev/null | rg -v 'allowlist secret' || true)

# DB connection strings with passwords
while IFS=: read -r file line rest; do
  high "$file|$line|DB Connection String|$rest"
done < <(rg -n --no-ignore '(postgresql|mysql|mongodb(?:\+srv)?|redis|jdbc)://[^:]+:[^@]+@' --type-add 'all:*' -t all 2>/dev/null | rg -v 'allowlist secret' || true)

# Bearer tokens
while IFS=: read -r file line rest; do
  medium "$file|$line|Bearer Token|$rest"
done < <(rg -n --no-ignore 'Bearer\s+[A-Za-z0-9\-._~+/]{40,}' -g '*.{json,yaml,yml,toml,env,sh,py,js,ts}' 2>/dev/null | rg -v 'allowlist secret' || true)

# ── File presence check ──────────────────────────────────────────────

check_file() {
  local pattern="$1" label="$2" level="$3"
  while IFS= read -r f; do
    if [ -f "$f" ]; then
      case "$level" in
        high)   high ".|(exists)|$label|$f" ;;
        medium) medium ".|(exists)|$label|$f" ;;
      esac
    fi
  done < <(git ls-files --cached --others --exclude-standard 2>/dev/null | rg "$pattern" || true)
}

check_file '\.env$' '.env file tracked' high
check_file '\.env\.[^e]' '.env.* file tracked (not .env.example)' high
check_file '\.pem$' 'PEM certificate/key' medium
check_file '\.key$' 'Private key file (.key)' medium
check_file '\.pfx$|\.p12$' 'PKCS12 keystore' high
check_file 'secrets\.ya?ml$' 'Secrets YAML file' high
check_file '\.ya?ml$' 'YAML config file tracked' medium
check_file 'credentials\.json$|credentials\.toml$' 'Credentials file' high
check_file 'id_rsa$|id_ecdsa$|id_ed25519$' 'SSH private key file' high

# ── .gitignore audit ─────────────────────────────────────────────

if [ -f .gitignore ]; then
  for entry in '.env' '.env.*' '*.pem' '*.key' '*.pfx' '*.yml' '*.yaml' 'secrets.yml' 'credentials.json' '.aws/'; do
    if ! rg -q "^${entry}$|^/${entry}$" .gitignore 2>/dev/null; then
      echo "$entry" >> "$IGNORE_FILE"
    fi
  done
fi

# ── Report ─────────────────────────────────────────────────────────

HIGH_COUNT=$(wc -l < "$HIGH_FILE" | tr -d ' ')
MED_COUNT=$(wc -l < "$MED_FILE" | tr -d ' ')

echo ""
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}              L E A K   S C A N   R E P O R T     ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo ""

if [ "$HIGH_COUNT" = "0" ] && [ "$MED_COUNT" = "0" ]; then
  echo -e "${YELLOW}No leaks detected.${NC}"
else
  if [ "$HIGH_COUNT" != "0" ]; then
    echo -e "${RED}HIGH — must fix before push (${HIGH_COUNT})${NC}"
    echo "| File | Line | Type | Detail |"
    echo "|------|------|------|--------|"
    while IFS='|' read -r file line type detail; do
      # Truncate detail for display
      detail_short=$(echo "$detail" | head -c 60)
      echo "| $file | $line | $type | $detail_short |"
    done < "$HIGH_FILE"
    echo ""
  fi

  if [ "$MED_COUNT" != "0" ]; then
    echo -e "${YELLOW}MEDIUM — review recommended (${MED_COUNT})${NC}"
    echo "| File | Line | Type | Detail |"
    echo "|------|------|------|--------|"
    while IFS='|' read -r file line type detail; do
      detail_short=$(echo "$detail" | head -c 60)
      echo "| $file | $line | $type | $detail_short |"
    done < "$MED_FILE"
    echo ""
  fi
fi

# .gitignore warnings
IGNORE_COUNT=$(wc -l < "$IGNORE_FILE" | tr -d ' ')
if [ "$IGNORE_COUNT" != "0" ]; then
  echo -e "${YELLOW}.gitignore warnings${NC}"
  while IFS= read -r entry; do
    echo "- '$entry' not in .gitignore"
  done < "$IGNORE_FILE"
fi

echo ""
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"

exit 0
