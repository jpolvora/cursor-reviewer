### [2026-07-13] Windows Python file/stdio must be UTF-8
- **Layer**: Core
- **Module**: Audit
- **Severity**: High
- **Trap Avoided**: On Windows, bare `open(path)` / `Path.read_text()` without `encoding="utf-8"` and `subprocess.run(..., text=True)` without `encoding="utf-8"` use the locale codec (`cp1252`). UTF-8 review/spec JSON (ADO threads, issue bodies) then raises `UnicodeDecodeError: 'charmap' codec can't decode byte 0x8f...`. Agents improvising `python -c` diagnostics to inspect `context.json` hit the same trap.
- **Solution**: Always use `encoding="utf-8"` for text file I/O and captured subprocess text. Prefer provider payload fields (`activeThreads`) / collector stderr summaries over ad-hoc re-parse. Call `ensure_utf8_stdio()` (or `sys.std*.reconfigure(encoding="utf-8")`) at script entry so stdin/stdout/stderr match. Never rely on Windows default locale for skill scripts.
