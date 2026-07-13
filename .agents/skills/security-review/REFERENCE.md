# Security Review — Reference

OWASP cheat sheet material (CC BY-SA 4.0): https://cheatsheetseries.owasp.org/

## Do not flag (without bypass)

| Category | Examples |
|----------|----------|
| Server-controlled | `settings.X`, env vars, hardcoded URLs, admin-configured endpoints |
| Framework defaults | Django/React/Vue auto-escape; ORM parameterized queries |
| Safe only when bypassed | `\|safe`, `mark_safe`, `dangerouslySetInnerHTML`, `v-html`, `.raw()`, `.extra()` |

## Input sources

| Attacker-controlled (investigate) | Server-controlled (usually safe) |
|-----------------------------------|----------------------------------|
| Request body/query/headers/cookies | Settings, env, config files |
| URL path segments | Hardcoded constants |
| File uploads | Signed session data |
| Other users' DB content | Internal service URLs from config |

## Severity

| Severity | Examples |
|----------|----------|
| **Critical** | RCE, SQLi to data, auth bypass, hardcoded secrets |
| **High** | Stored XSS, SSRF to metadata, IDOR to sensitive data |
| **Medium** | Reflected XSS, CSRF on state change, path traversal |
| **Low** | Missing headers, verbose errors, weak algos in non-security context |

## Quick patterns

### Always flag (Critical)
```
eval(user_input)           pickle.loads(user_data)    yaml.load(user_data)
exec(user_input)           shell=True + user_input    child_process.exec(user)
```

### Always flag (High)
```
innerHTML = userInput              dangerouslySetInnerHTML={{__html: user}}
v-html="userInput"                 f"SELECT * FROM x WHERE {user}"
os.system(f"cmd {user_input}")
```

### Check context first
```
requests.get(request.GET['url'])     # FLAG — user URL
requests.get(settings.API_URL)       # SAFE — config
redirect(request.GET['next'])        # FLAG — open redirect
hashlib.md5(password)                # FLAG — password hashing
```

## Output format

```markdown
## Security Review: [File/Component Name]

### Summary
- **Findings**: X (Y Critical, Z High, ...)
- **Risk Level**: Critical/High/Medium/Low
- **Confidence**: High/Mixed

### Findings

#### [VULN-001] [Type] (Severity)
- **Location**: `file.py:123`
- **Confidence**: High
- **Issue**: ...
- **Impact**: ...
- **Evidence**: [snippet]
- **Fix**: ...

### Needs Verification

#### [VERIFY-001] [Potential Issue]
- **Location**: `file.py:456`
- **Question**: ...
```

## Reference index

Load by code type under `.agents/skills/security-review/`:

### Core (`references/`)
| File | Covers |
|------|--------|
| `injection.md` | SQL, NoSQL, OS command, LDAP, template |
| `xss.md` | Reflected, stored, DOM XSS |
| `authorization.md` | Authz, IDOR, privilege escalation |
| `authentication.md` | Sessions, credentials, passwords |
| `cryptography.md` | Algorithms, keys, randomness |
| `deserialization.md` | Pickle, YAML, Java, PHP |
| `file-security.md` | Path traversal, uploads, XXE |
| `ssrf.md` | Server-side request forgery |
| `csrf.md` | Cross-site request forgery |
| `data-protection.md` | Secrets, PII, logging |
| `api-security.md` | REST, GraphQL, mass assignment |
| `business-logic.md` | Race conditions, workflow bypass |
| `modern-threats.md` | Prototype pollution, LLM, WebSocket |
| `misconfiguration.md` | Headers, CORS, debug |
| `error-handling.md` | Fail-open, info disclosure |
| `supply-chain.md` | Dependencies, build |
| `logging.md` | Audit failures, log injection |

### Languages (`languages/`)
`python.md`, `javascript.md`, `go.md`, `rust.md`, `java.md`

### Infrastructure (`infrastructure/`)
`docker.md`, `kubernetes.md`, `terraform.md`, `ci-cd.md`, `cloud.md`

### Context → refs (review process)

| Code type | Load |
|-----------|------|
| API routes | `authorization.md`, `authentication.md`, `injection.md` |
| Frontend | `xss.md`, `csrf.md` |
| File uploads | `file-security.md` |
| Crypto/secrets | `cryptography.md`, `data-protection.md` |
| External HTTP | `ssrf.md` |
| Config/CORS | `misconfiguration.md` |
| CI/deps | `supply-chain.md` |
