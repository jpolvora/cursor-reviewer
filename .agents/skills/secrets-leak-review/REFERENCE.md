# Secrets & Leak Review — Reference

## Pattern catalog

### API keys & tokens

| Pattern | Example | Risk |
|---------|---------|------|
| `AKIA[0-9A-Z]{16}` | AWS Access Key | HIGH |
| `sk-[a-zA-Z0-9]{32,}` | OpenAI/Stripe key | HIGH |
| `pk-[a-zA-Z0-9]{32,}` | Stripe publishable | MEDIUM |
| `gh[ps]_[a-zA-Z0-9]{36,}` | GitHub PAT | HIGH |
| `github_pat_[a-zA-Z0-9]{36,}` | GitHub Fine-grained | HIGH |
| `xox[bpras]-[0-9a-zA-Z-]{24,}` | Slack token | HIGH |
| `xapp-[0-9a-zA-Z-]{24,}` | Slack app token | HIGH |
| `key-[0-9a-zA-Z]{32,}` | Keygen / generic | HIGH |
| `Bearer\s+[A-Za-z0-9\-._~+/]{20,}` | Authorization bearer | HIGH |
| `-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )PRIVATE KEY-----` | Private key | HIGH |

### Database connection strings

```
postgres(ql)?://[^:]+:[^@]+@
mysql://[^:]+:[^@]+@
mongodb(?:\+srv)?://[^:]+:[^@]+@
redis://[^:]+:[^@]+@
jdbc:(?:mysql|postgresql|sqlserver)://[^:]+:[^@]+@
```

### Cloud provider credentials

```
aws_access_key_id\s*=\s*AKIA
aws_secret_access_key\s*=\s*
AZURE_.*_KEY\s*=
AZURE_.*_CONNECTION_STRING\s*=
GOOGLE_APPLICATION_CREDENTIALS
GCP_SERVICE_ACCOUNT
```

### PII patterns

| Pattern | Type |
|---------|------|
| `\d{3}\.?\d{3}\.?\d{3}-?\d{2}` | CPF / SSN-like |
| `\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}` | CNPJ |
| `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}` | Email |
| `\+?\d{1,3}[\s.-]?\(?\d{2,3}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}` | Phone |
| `\b(10\.\|172\.(1[6-9]\|2\d\|3[01])\|192\.168)\..*` | Internal IP |
| `\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b` | Credit card (Luhn-check recommended) |

### File types to flag

| File/directory | Reason |
|----------------|--------|
| `.env`, `.env.*` | Environment secrets |
| `*.pem`, `*.key`, `*.pfx`, `*.p12`, `*.cert` | Certificates & keys |
| `secrets.yml`, `secrets.yaml` | Structured secrets |
| `credentials.json`, `credentials.toml` | Credential files |
| `.aws/credentials`, `.aws/config` | AWS CLI config |
| `*.keystore`, `*.truststore` | Java keystores |
| `id_rsa`, `id_ecdsa`, `id_ed25519` | SSH private keys |
| `config/credentials` | Generic creds |

## Tool installation

```bash
# gitleaks (recommended — fast, low false-positives)
winget install gitleaks          # Windows
brew install gitleaks             # macOS
# or
go install github.com/gitleaks/gitleaks/v8@latest

# trufflehog (alternative, more thorough but slower)
winget install trufflehog        # Windows
brew install trufflehog           # macOS

# Basic scan with gitleaks
gitleaks detect --source . -v

# Scan staged changes only
gitleaks detect --source . --staged -v
```

## .gitignore recommendations

Add to `.gitignore`:

```gitignore
# Secrets & credentials
.env
.env.*
!.env.example
*.pem
*.key
*.pfx
*.p12
secrets.yml
secrets.yaml
credentials.json
credentials.toml
.aws/
config/credentials

# IDE/editor
.idea/
.vscode/
*.swp
*.swo

# Logs
*.log
```

## False-positive suppression

Add `# pragma: allowlist secret` at the end of any line that must contain a secret-like string (e.g., test tokens, example keys).

```python
EXAMPLE_API_KEY = "sk-test-1234567890abcdef"  # pragma: allowlist secret
```

The scanner script skips lines containing `allowlist secret`.
