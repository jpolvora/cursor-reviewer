#!/usr/bin/env python3
"""
Helper cross-platform do fix-pr para Azure DevOps.

Objetivo:
- Padronizar a coleta de PR, threads, comentarios e work items.
- Autenticar-se de forma autocontida sem depender de outros scripts.
- Evitar que cada execucao do fix-pr invente uma chamada REST diferente.

Uso:
  python .agents/skills/08-fix-pr/scripts/fix_pr_azure_context.py collect --pr-id 592 --output .agents/skills/08-fix-pr/runs/pr-592/context.json
  python .agents/skills/08-fix-pr/scripts/fix_pr_azure_context.py resolve-thread --pr-id 592 --thread-id 4001 --model composer-2.5 --comment "Justificativa..."
  python .agents/skills/08-fix-pr/scripts/fix_pr_azure_context.py resolve-thread --dry-run --pr-id 592 --thread-id 4001 --model composer-2.5 --comment "Justificativa..."
"""

from __future__ import annotations

import argparse
import base64
import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


ACTIVE_STATUSES = {"active", "pending"}
DEFAULT_WORK_ITEM_FIELDS = ",".join(
    [
        "System.Id",
        "System.Title",
        "System.State",
        "System.WorkItemType",
        "System.Description",
        "Microsoft.VSTS.Common.AcceptanceCriteria",
    ]
)


def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in [current, *current.parents]:
        if (candidate / ".agents").is_dir():
            return candidate
    raise SystemExit("Nao foi possivel localizar a raiz do repo com .agents/.")


def resolve_azdo_paths(repo_root: Path) -> tuple[Path, Path]:
    skill_dir = repo_root / ".agents" / "skills" / "azure-devops"
    config_path = skill_dir / "azure-devops.config.json"
    secret_path = skill_dir / "azure-devops.secret"

    if config_path.exists():
        return config_path, secret_path

    # Compatibilidade com a localizacao antiga na raiz de .agents/.
    legacy_dir = repo_root / ".agents"
    legacy_config_path = legacy_dir / "azure-devops.config.json"
    legacy_secret_path = legacy_dir / "azure-devops.secret"
    if legacy_config_path.exists():
        return legacy_config_path, legacy_secret_path

    return config_path, secret_path


def load_azdo_config(repo_root: Path) -> tuple[str, str, str]:
    config_path, secret_path = resolve_azdo_paths(repo_root)

    if not config_path.exists():
        raise SystemExit(
            "Crie .agents/skills/azure-devops/azure-devops.config.json com organization e project."
        )

    config = json.loads(config_path.read_text(encoding="utf-8"))
    organization = config["organization"]
    project = config["project"]

    pat = os.environ.get("AZURE_DEVOPS_PAT", "").strip()
    if not pat and secret_path.exists():
        pat = secret_path.read_text(encoding="utf-8").strip()
    if not pat:
        raise SystemExit(
            "Defina AZURE_DEVOPS_PAT ou crie .agents/skills/azure-devops/azure-devops.secret."
        )

    return organization, project, pat


def run_azure_devops_smoke_check(organization: str, project: str, pat: str) -> dict[str, Any]:
    """Valida a autenticacao e config com a API do Azure DevOps."""
    url = f"{base_url(organization, project)}/_apis/wit/fields/System.State?api-version=7.1"
    try:
        azdo_request("GET", url, pat)
        return {
            "status": "success",
            "message": "Autenticacao e conectividade com Azure DevOps validadas com sucesso."
        }
    except Exception as exc:
        raise SystemExit(
            "Falha na validacao de conexao/autenticacao com o Azure DevOps.\n"
            f"Erro: {exc}"
        )


def auth_headers(pat: str, content_type: str = "application/json") -> dict[str, str]:
    token = base64.b64encode(f":{pat}".encode("ascii")).decode("ascii")
    return {
        "Authorization": f"Basic {token}",
        "Accept": "application/json; api-version=7.1",
        "Content-Type": content_type,
    }


def azdo_request(
    method: str,
    url: str,
    pat: str,
    body: Any | None = None,
    content_type: str = "application/json",
) -> Any:
    data: bytes | None = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers=auth_headers(pat, content_type=content_type),
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Azure DevOps HTTP {exc.code}: {detail}") from exc

    if not raw:
        return None
    return json.loads(raw.decode("utf-8"))


def clean_html(value: str | None) -> str:
    if not value:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", value, flags=re.IGNORECASE)
    text = re.sub(r"</p\s*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def detect_repository(repo_root: Path) -> str:
    git_config = repo_root / ".git" / "config"
    if not git_config.exists():
        raise SystemExit("Informe --repository; nao foi possivel ler .git/config.")

    content = git_config.read_text(encoding="utf-8", errors="ignore")
    urls = re.findall(r"^\s*url\s*=\s*(.+)$", content, flags=re.MULTILINE)
    for url in urls:
        match = re.search(r"/_git/([^/\s]+)", url)
        if match:
            return urllib.parse.unquote(match.group(1))
    for url in urls:
        if url.rstrip().endswith(".git"):
            return Path(url.rstrip()[:-4]).name

    raise SystemExit("Informe --repository; remoto Azure DevOps nao encontrado em .git/config.")


def base_url(organization: str, project: str) -> str:
    return f"https://dev.azure.com/{organization}/{urllib.parse.quote(project)}"


def git_url(organization: str, project: str, repository: str, suffix: str) -> str:
    return (
        f"{base_url(organization, project)}/_apis/git/repositories/"
        f"{urllib.parse.quote(repository)}/{suffix}"
    )


def get_pr_context(repo_root: Path, pr_id: int, repository: str, include_system: bool) -> dict[str, Any]:
    organization, project, pat = load_azdo_config(repo_root)
    smoke = run_azure_devops_smoke_check(organization, project, pat)

    pr = azdo_request(
        "GET",
        git_url(organization, project, repository, f"pullRequests/{pr_id}?api-version=7.1"),
        pat,
    )
    threads_payload = azdo_request(
        "GET",
        git_url(organization, project, repository, f"pullRequests/{pr_id}/threads?api-version=7.1"),
        pat,
    )
    work_item_refs = azdo_request(
        "GET",
        git_url(organization, project, repository, f"pullRequests/{pr_id}/workitems?api-version=7.1"),
        pat,
    ).get("value", [])

    work_items = []
    ids = [str(item["id"]) for item in work_item_refs]
    if ids:
        items_url = (
            f"{base_url(organization, project)}/_apis/wit/workitems"
            f"?ids={','.join(ids)}&fields={urllib.parse.quote(DEFAULT_WORK_ITEM_FIELDS)}&api-version=7.1"
        )
        items_payload = azdo_request("GET", items_url, pat)
        for item in items_payload.get("value", []):
            fields = item.get("fields", {})
            work_items.append(
                {
                    "id": item.get("id"),
                    "type": fields.get("System.WorkItemType"),
                    "state": fields.get("System.State"),
                    "title": fields.get("System.Title"),
                    "description": clean_html(fields.get("System.Description")),
                    "acceptanceCriteria": clean_html(
                        fields.get("Microsoft.VSTS.Common.AcceptanceCriteria")
                    ),
                    "url": f"{base_url(organization, project)}/_workitems/edit/{item.get('id')}",
                }
            )

    threads = [normalize_thread(thread, include_system=include_system) for thread in threads_payload.get("value", [])]
    threads = [thread for thread in threads if thread is not None]
    active_threads = [
        thread
        for thread in threads
        if str(thread.get("status", "")).lower() in ACTIVE_STATUSES and thread.get("comments")
    ]

    return {
        "source": {
            "helper": str(Path(__file__).as_posix()),
            "azureDevOpsScript": None,
            "azureDevOpsScriptSmoke": smoke,
        },
        "organization": organization,
        "project": project,
        "repository": repository,
        "pullRequest": {
            "id": pr.get("pullRequestId"),
            "title": pr.get("title"),
            "status": pr.get("status"),
            "sourceRefName": pr.get("sourceRefName"),
            "targetRefName": pr.get("targetRefName"),
            "createdBy": (pr.get("createdBy") or {}).get("displayName"),
            "url": pr.get("url"),
        },
        "workItems": work_items,
        "threads": threads,
        "activeThreads": active_threads,
    }


def normalize_thread(thread: dict[str, Any], include_system: bool) -> dict[str, Any] | None:
    comments = []
    for comment in thread.get("comments") or []:
        if comment.get("isDeleted"):
            continue
        comment_type = comment.get("commentType")
        if not include_system and comment_type == "system":
            continue
        content = clean_html(comment.get("content"))
        if not content:
            continue
        comments.append(
            {
                "id": comment.get("id"),
                "type": comment_type,
                "author": (comment.get("author") or {}).get("displayName"),
                "content": content,
                "publishedDate": comment.get("publishedDate"),
            }
        )

    if not comments:
        return None

    context = thread.get("threadContext") or {}
    pr_context = thread.get("pullRequestThreadContext") or {}
    right_start = context.get("rightFileStart") or {}
    right_end = context.get("rightFileEnd") or {}
    left_start = context.get("leftFileStart") or {}
    left_end = context.get("leftFileEnd") or {}

    return {
        "threadId": thread.get("id"),
        "status": thread.get("status"),
        "path": pr_context.get("filePath") or context.get("filePath"),
        "rightLine": right_start.get("line") or right_end.get("line"),
        "leftLine": left_start.get("line") or left_end.get("line"),
        "isDeleted": thread.get("isDeleted"),
        "comments": comments,
    }


MODEL_FOOTER_PREFIX = "Modelo LLM:"


def format_resolution_comment(comment: str, model: str) -> str:
    body = comment.strip()
    model = model.strip()
    if not model:
        raise ValueError("O parametro --model e obrigatorio e nao pode ser vazio.")
    if MODEL_FOOTER_PREFIX.lower() in body.lower():
        return body
    return f"{body}\n\n---\n{MODEL_FOOTER_PREFIX} {model}"


def resolve_thread(
    repo_root: Path,
    pr_id: int,
    repository: str,
    thread_id: int,
    comment: str,
    model: str,
    dry_run: bool,
) -> dict[str, Any]:
    formatted_comment = format_resolution_comment(comment, model)
    if dry_run:
        return {
            "dryRun": True,
            "threadId": thread_id,
            "status": "would_mark_fixed",
            "commentId": None,
            "comment": formatted_comment,
            "model": model,
            "message": "Dry-run: nenhum comentario foi postado e a thread nao foi alterada no Azure DevOps.",
        }

    organization, project, pat = load_azdo_config(repo_root)
    run_azure_devops_smoke_check(organization, project, pat)

    comments_suffix = f"pullRequests/{pr_id}/threads/{thread_id}/comments?api-version=7.1"
    patch_suffix = f"pullRequests/{pr_id}/threads/{thread_id}?api-version=7.1"

    posted = azdo_request(
        "POST",
        git_url(organization, project, repository, comments_suffix),
        pat,
        body={"content": formatted_comment, "commentType": 1},
    )
    patched = azdo_request(
        "PATCH",
        git_url(organization, project, repository, patch_suffix),
        pat,
        body={"status": "fixed"},
    )

    return {
        "threadId": thread_id,
        "status": patched.get("status") if patched else "fixed",
        "commentId": posted.get("id") if posted else None,
        "model": model,
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Helper Azure DevOps para fix-pr.")
    parser.add_argument("--repo-root", default="", help="Raiz do repositorio. Default: autodetect.")
    parser.add_argument("--repository", default="", help="Nome do repositorio Azure DevOps. Default: autodetect.")
    sub = parser.add_subparsers(dest="action", required=True)

    collect = sub.add_parser("collect", help="Coleta PR, threads, comentarios e work items.")
    collect.add_argument("--pr-id", type=int, required=True)
    collect.add_argument("--include-system", action="store_true")
    collect.add_argument("--output", default="", help="Arquivo JSON de saida. Default: stdout.")

    resolve = sub.add_parser("resolve-thread", help="Comenta e marca uma thread como fixed.")
    resolve.add_argument("--pr-id", type=int, required=True)
    resolve.add_argument("--thread-id", type=int, required=True)
    resolve.add_argument("--comment", required=True)
    resolve.add_argument(
        "--model",
        required=True,
        help="Identificador do modelo LLM ativo na sessao (ex.: composer-2.5, gpt-5.4-medium).",
    )
    resolve.add_argument(
        "--dry-run",
        action="store_true",
        help="Simula a resolucao localmente sem postar comentario nem alterar status no Azure DevOps.",
    )

    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    repo_root = find_repo_root(Path(args.repo_root) if args.repo_root else Path.cwd())
    repository = args.repository or detect_repository(repo_root)

    if args.action == "collect":
        payload = get_pr_context(repo_root, args.pr_id, repository, include_system=args.include_system)
        text = json.dumps(payload, ensure_ascii=False, indent=2)
        if args.output:
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(text + "\n", encoding="utf-8")
        else:
            print(text)
        return 0

    if args.action == "resolve-thread":
        payload = resolve_thread(
            repo_root,
            args.pr_id,
            repository,
            args.thread_id,
            args.comment,
            args.model,
            dry_run=args.dry_run,
        )
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    raise SystemExit(f"Acao desconhecida: {args.action}")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
