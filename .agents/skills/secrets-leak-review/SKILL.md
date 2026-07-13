---
name: secrets-leak-review
description: Scans repository for hardcoded secrets, passwords, API keys, PII, private keys, connection strings, .env files, and client-confidential data before commit. Use when asked to "check for secrets", "leak check", "secrets scan", "pre-commit security check", "check for hardcoded passwords", "PII scan", "repo leak audit", or before pushing to a public repository.
allowed-tools: Read, Grep, Glob, Bash, Task
---

# Secrets & Leak Review

Prevent committing sensitive/unauthorized data to public repositories. Scans the entire working tree (tracked + untracked) for hardcoded secrets, credentials, PII, client references, and other non-public information.

## When to run

- Before `git push` to a public remote
- When asked to audit for leaks
- Before open-sourcing a private repo
- As part of PR review for security-sensitive changes

## Scan phases

Run **all** phases. Each phase is independent — parallelize via Task tool.

### Phase 1 — Pattern-based secret scan

Run the scanner script:

```bash
bash .agents/skills/secrets-leak-review/scripts/secrets_scanner.sh
```

This checks for:
- API keys / tokens (AWS, GitHub, Slack, Stripe, etc.)
- Private keys (SSH, PGP, JWT signing)
- Connection strings with embedded passwords
- High-entropy strings that look like secrets
- .env / .env.* files not in .gitignore
- Hardcoded passwords
- Tracked YAML configuration files (`.yml` / `.yaml`)
- YAML files with secret keys/values

Additionally, scan YAML files for common secret key names:

```bash
# YAML/yml files with secret key-value patterns
rg -n --no-ignore -i '(api_key|api_secret|access_key|secret_key|password|passwd|token|auth_token|connection_string|private_key)' -g '*.{yml,yaml}' 2>/dev/null | head -30
```

### Phase 2 — PII & consumer data

Grep for patterns indicating personal or consumer data:

```bash
# CPF, CNPJ, SSN, credit card numbers
rg -n --no-ignore '(?:\d{3}\.?\d{3}\.?\d{3}-?\d{2})' --type-add 'all:*' -t all 2>/dev/null | head -30

# Email addresses (excluding test/example domains)
rg -n --no-ignore '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' --type-add 'all:*' -t all 2>/dev/null | rg -v '@(example\.com|test\.com|acme\.org|localhost)' | head -30

# Phone numbers
rg -n --no-ignore '(\+?\d{1,3}[\s.-]?)?\(?\d{2,3}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}' --type-add 'all:*' -t all 2>/dev/null | head -20

# IP addresses (internal/private ranges)
rg -n --no-ignore '\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b' --type-add 'all:*' -t all 2>/dev/null | head -30
```

### Phase 3 — Client & project references

```bash
# Client-specific domain/host names
rg -n --no-ignore -i '(client|acme|enterprise|customer)[0-9]?\.(com|org|net|local|internal|corp)' --type-add 'all:*' -t all 2>/dev/null | head -20

# Internal project codenames (check repo-specific patterns)
rg -n --no-ignore -i '(project-[a-z]|internal-[a-z]|codename)' --type-add 'all:*' -t all 2>/dev/null | head -20

# Internal URLs
rg -n --no-ignore 'https?://(localhost|127\.0\.0\.1|internal|intranet|corp|private)([:\/]|$)' --type-add 'all:*' -t all 2>/dev/null | head -20
```

### Phase 4 — .gitignore audit

Check for common sensitive files that should be ignored:

```bash
# List tracked files that look sensitive
rg -l --no-ignore 'SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY' --type-add 'all:*' -t all 2>/dev/null | head -30

# Check .gitignore for standard entries
if [ -f .gitignore ]; then
  for entry in '.env' '.env.*' '*.pem' '*.key' '*.pfx' '*.yml' '*.yaml' 'secrets.yml' 'credentials.json' '.aws' 'config/credentials'; do
    if ! rg -q "^$entry$|^/$entry$" .gitignore 2>/dev/null; then
      echo "WARNING: '$entry' not in .gitignore"
    fi
  done
fi
```

### Phase 5 — Markdown & documentation review

```bash
# .md files with potential confidential info
rg -l --no-ignore -i '(password|secret|api.?key|token|credential|pii|ssn|confidential|internal only|not for distribution)' --type md 2>/dev/null | head -30

# Scripts with hardcoded values
rg -l --no-ignore '(password=|passwd=|pwd=|apiKey=|api_key=|secretKey=|secret_key=).+['"'"'"]' -g '*.{sh,py,js,ts,ps1,yaml,yml,json,tf}' 2>/dev/null | head -20
```

## Confidence levels

| Level | Criteria |
|-------|----------|
| **HIGH** | Verified secret/key pattern + confirmed in tracked/added files + not in .gitignore |
| **MEDIUM** | Suspicious pattern but not confirmed as active secret |
| **LOW** | False-positive-prone pattern (example/test data, documentation) |

## Report format

Output a structured report. Do NOT output raw credentials — use path + line number + type.

```
## Leak Scan Report

### HIGH — must fix before push
| File | Line | Type | Detail |
|------|------|------|--------|
| config.yml | 42 | AWS Key | AKIA... pattern |
| .env | 5 | Password | Hardcoded DB password |

### MEDIUM — review recommended
| File | Line | Type | Detail |
|------|------|------|--------|
| docs/README.md | 12 | Internal URL | http://internal.corp/ |

### LOW — informational
...

### .gitignore warnings
- `.env*` not in .gitignore
```

If zero issues found: "No leaks detected."

## Pre-commit hook (recommended)

Install a git pre-commit hook to automatically block commits with HIGH-severity leaks:

```bash
bash .agents/skills/secrets-leak-review/scripts/install-hook.sh
```

This runs the scanner on **staged files only** before every commit. If HIGH findings exist, the commit is blocked with instructions. To override (e.g., intentional test data):

```bash
git commit --no-verify
```

The hook script is at `.agents/skills/secrets-leak-review/scripts/pre-commit.sh`. It symlinks into `.git/hooks/pre-commit` (copies on Windows).

## Rules

- **Do NOT** output actual secrets/values in the report — only file paths, line numbers, and types
- **Do NOT** `git add` or commit changes
- **Do NOT** modify files — read-only scan
- If a false positive is detected (e.g., example.com email), skip it
- If `secrets_scanner.sh` is not available, use `rg`/`grep` patterns from REFERENCE.md

## REFERENCE.md

See [REFERENCE.md](REFERENCE.md) for the full pattern catalog, tool installation guide, and .gitignore recommendations.
