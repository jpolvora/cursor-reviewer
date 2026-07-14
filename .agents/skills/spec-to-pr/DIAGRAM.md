# Spec-to-PR v9.1 — Diagrams

> **Architecture note (v9.1):** Steps 0–11 delegate functional content to dedicated standalone skills. `state.md` is per-workflow memory; `MEMORY.md` is shared/generalizable memory. Step 13 is optional via `--full` (Ship & PR). Stack-agnostic — project metadata from `.agents/skills/shared/config.json`. Canonical artifact paths: [`ARTIFACTS.md`](ARTIFACTS.md).

Visual docs for the [`SKILL.md`](SKILL.md) agent. Human guide: [`README.md`](README.md). Resume rules: [`setup.md`](../shared/setup.md) (canonical).

> **v8.1:** 7 phases (F0–F6); **Authorization Ladder** + hard stops HS-1..5; **Refinement FSM**; **Worktree Fallback**; **State Hygiene**; steps 4/8 → model sub-gates; `state.md` as workflow memory + `MEMORY.md` as shared memory; fresh subagent per step + checkpoint tags + Backward Navigation.

---

## 0. Phases (v8.1 — user view)

```mermaid
flowchart LR
  F0[F0 Bootstrap<br/>step 0] --> F1[F1 Specification<br/>steps 1·2·3]
  F1 --> F2[F2 Implementation<br/>step 5 + sub-gate 4]
  F2 --> F3[F3 Verify + 1st commit<br/>steps 6·7 · G2]
  F3 --> F4[F4 Review + Fix<br/>steps 9·10 + sub-gate 8 · G2]
  F4 --> F5[F5 Integration<br/>step 11]
  F5 --> F6[F6 Closure<br/>step 12 · push consent G3]
```

Steps **4 and 8** are model sub-gates (F1→F2, F3→F4) — they do not appear as board steps or in `completedSteps`.

---

## 1. Overview — architecture

```mermaid
flowchart TB
    subgraph Input
        US["US #1925 / #2334"]
        FEAT["Free feature description"]
    end

    subgraph Orchestrator["Orchestrator (main agent)"]
        direction TB
        PARSE["Parse input + Step 0 context"]
        ACTIVE["Check active workflow states"]
        RESUME["Menu — check/continue or start new"]
        GATE0["Gate 0 — menu confirm"]
        PREDISP["Pre-dispatch gate — model swap"]
        PROMPT["Build prompt from SKILL.md"]
        DISPATCH["Task tool — NEW subagent"]
        WAIT["Await run_in_background: false"]
        INGEST["Ingest step-output"]
        RETRY["Retry up to 3x if failed"]
        STATE_W["Update state.md"]
        DOC["§Doc consolidation"]
        GATE["Post-step gate"]
        READY4["Step 4 — Coder readiness NO Task"]
        READY8["Step 8 — Review readiness NO Task"]
        ITP["Step 11 — integration test plan confirm"]
    end

    subgraph Persistence["Persistent state"]
        STATE[".cursor/plans/us-{id}/{workflow-id}.state.md"]
    end

    subgraph Subagents["Subagents (Task tool)"]
        SA1["Step 1 — plan"]
        SA2["Step 2 — refinement"]
        SA3["Step 3 — exec + DAG"]
        SA4["Step 5 — implement"]
        SA5["Step 6 — verify"]
        SA6["Step 7 — validation/fix support before 1st commit"]
        SA7["Step 9 — code review"]
        SA8["Step 10 — fix + 2nd commit"]
        SA9["Step 11 — integration validation"]
    end

    subgraph Browser["Browser MCP"]
        BR["cursor-ide-browser"]
    end

    subgraph Artifacts["Generated artifacts"]
        PLAN["*.plan.md"]
        EXEC["*.plan.exec.md"]
        DAG["*.exec.dag.json"]
        CODE["Changed code"]
        VERIFY["step-06-{slug}.plan.report.md"]
        ITPA["step-11-{slug}.integration-test.plan.md"]
        ITR["step-11-{slug}.integration-test.report.md"]
        FINAL["step-10-{slug}.report.md"]
    end

    US --> PARSE
    FEAT --> PARSE
    PARSE --> ACTIVE
    ACTIVE -->|active exists| RESUME
    RESUME -->|continue active| STATE
    RESUME -->|start new| STATE
    ACTIVE -->|none active| STATE
    STATE --> GATE0
    GATE0 -->|Continue| PREDISP
    PREDISP -->|Pronto — disparar| PROMPT

    PROMPT --> DISPATCH
    DISPATCH --> WAIT
    WAIT --> INGEST
    INGEST -->|failed| RETRY
    RETRY -->|"<=3 attempts"| PROMPT
    INGEST -->|success/partial| STATE_W
    STATE_W --> STATE
    STATE_W --> DOC
    DOC --> GATE
    GATE -->|Menu: Continue after 3| READY4
    GATE -->|Menu: Continue after 7| READY8
    GATE -->|Menu: Continue after 10| ITP
    GATE -->|Menu: Continue other| PREDISP
    READY4 -->|Ready to implement| PREDISP
    READY8 -->|Ready to review| PREDISP
    ITP -->|Approve battery| PREDISP
    GATE -->|Menu: Stop/Cancel/Revert| ENDW["End of workflow"]

    DISPATCH -.-> SA1 & SA2 & SA3 & SA4 & SA5 & SA6 & SA7 & SA8 & SA9
    STATE -.->|reads| SA1 & SA2 & SA3 & SA4 & SA5 & SA6 & SA7 & SA8 & SA9
    SA1 --> PLAN
    SA3 --> EXEC
    SA3 --> DAG
    SA4 --> CODE
    SA5 --> VERIFY
    SA8 --> FINAL
    SA9 --> ITPA
    SA9 --> ITR
    SA9 --> BR
```

---

## 2. Full pipeline — steps 0 to 12

```mermaid
flowchart TD
    START(["Start: @[spec-to-pr] 1925"])

    BOOT["0 Bootstrap + active-state check + state.md"]
    G0{"Gate 0 menu"}

    E1["1 Plan"]
    G1{"Gate 1 menu"}

    E2["2 Refinement"]
    G2{"Gate 2 menu"}

    E3["3 Exec + DAG"]
    G3{"Gate 3 menu"}

    R4["4 CODER READINESS — orchestrator only"]
    G4{"Gate 4 menu"}

    E5["5 Implement — DAG levels"]
    G5{"Gate 5 menu"}

    E6["6 Verify (generates quality table vs plan)"]
    G6{"Gate 6 menu"}

    E7["7 Decide + 1st commit"]
    G7{"Gate 7 menu (Approve or Reimplement?)"}
    REIMPL["Revert Step 5 + Swap Coder"]

    R8["8 REVIEW READINESS — orchestrator only"]
    G8{"Gate 8 menu"}

    E9["9 Code review"]
    G9{"Gate 9 menu"}

    E10["10 Fix + 2nd commit + report"]
    G10{"Gate 10 menu"}

    E11["11 Integration validation (generate plan & review)"]
    G11{"Gate 11 — confirm test battery"}
    LOOP{"Inconsistencies?"}
    FIX["Fix + commit + re-seed + revalidate"]
    E12["12 Cleanup + consolidation"]
    PR["PR / push — manual (out of scope)"]
    ENDW(["End"])

    START --> BOOT --> G0 --> E1 --> G1 --> E2 --> G2 --> E3 --> G3
    G3 -->|Continue separate turn| R4 --> G4 --> E5 --> G5 --> E6 --> G6 --> E7 --> G7
    G7 -->|Approve and Commit| R8
    G7 -->|Redo implementation| REIMPL --> E5
    R8 --> G8 --> E9 --> G9 --> E10 --> G10 --> E11 --> G11
    G11 -->|Approve and run| E11
    G11 -->|Skip| E12
    E11 --> LOOP
    LOOP -->|yes, iter < 3| FIX --> E11
    LOOP -->|no or accept with reservations| E12 --> PR --> ENDW
```

---

## 3. Dispatch cycle — per-step micro-loop

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant O as Orchestrator
    participant S as state.md
    participant T as Task tool
    participant A as Subagent

    O->>S: Read current state
    O->>O: Build prompt from SKILL.md step section
    O->>T: Task(subagent_type, prompt, run_in_background=false)
    T->>A: New subagent (fresh context)
    A->>S: Read state.md (`Workflow memory` + decisions + doc log) + MEMORY.md (raiz atualizada)
    A->>A: Execute step instructions
    A-->>T: step-output block
    T-->>O: Subagent return

    alt status = failed
        O->>O: retryCounts[step]++
        alt attempt <= 3
            Note over O: Backoff 0s / 30s / 60s
            O->>O: Prompt + RETRY block
            O->>T: New dispatch (same step)
        else exhausted
            O->>U: Gate: Repeat / Stop / Revert
        end
    else status = needs_user
        O->>U: AskQuestion menu (options + recommendation)
        U-->>O: Answers
        O->>T: New subagent (same step + answers)
    else status = success | partial
        O->>S: Persist output + artifacts; consolidar learning em MEMORY.md quando o gate passar
        O->>U: Summary + standard AskQuestion gate
        U-->>O: Menu selection
    end
```

---

## 4. step-output contract

| Field | Description |
|-------|-------------|
| `status` | `success` \| `partial` \| `failed` \| `needs_user` |
| `step` | e.g. `1`, `2`, `5`, `11` |
| `artifacts[]` | Path + `exists: true/false` |
| `summary` | 3-5 bullets for the user |
| `evidence` | Commands/checks run |
| `decisions` | Refinement / domain decisions |
| `doc_consolidation` | Files touched or "none" |
| `needs_user` | Questions when blocked |
| `errors` + `retry_hint` | Used by auto-retry |
| `learning` | Trap/pattern title or `N/A` |

---

## 5. Step 2 — refinement decision tree

```mermaid
flowchart LR
    subgraph S2["Step 2 — Refinement (Grilling Conduct)"]
        direction TB
        INV["Audit gaps<br/>design-tree order + dependsOn"]
        RES["Resolve with evidence<br/>codebase before escalate"]
        PICK["Pick 1 highest-priority gap"]
        ASK["needs_user: single question + recommendation"]
        REC["Orchestrator: AskQuestion<br/>+ Encerrar refinamento"]
        APPEND["Append to state decisions"]
        CHECK{"2d Exit criteria met?"}
        SU{"2e Shared Understanding Gate"}

        INV --> RES --> CHECK
        CHECK -->|blocking open| PICK --> ASK --> REC --> APPEND --> INV
        CHECK -->|all closed| SU
        REC -->|Encerrar| SU
        SU -->|Confirmar| OUT["shared_understanding: confirmed -> Step 3"]
        SU -->|Continue| INV
    end

    IN["*.plan.md"] --> INV
```

---

## 6. Step 11 — integration validation loop

```mermaid
flowchart TD
    subgraph S11["Step 11 — Integration validation"]
        PLAN["Draft integration-test.plan.md"]
        CONF{"User confirms battery?"}
        COMMIT["Ensure committed / 3rd commit if fixes"]
        BUILD["stack.md: dotnet build + dotnet test + npm run build"]
        SEED["Seed / reset test data"]
        API["Validate API + permissions + security"]
        UI["Browser flows + visual AC check"]
        REPORT["integration-test.report.md"]
        FAIL{"Failures?"}
        PROP["Propose fixes mapped to AC"]
        FIX["Coder fix + commit + re-seed"]
    end

    PLAN --> CONF
    CONF -->|Approve and run| COMMIT --> BUILD --> SEED --> API --> UI --> REPORT --> FAIL
    CONF -->|Adjust plan| PLAN
    CONF -->|Skip| SKIP["Log warning -> Step 12"]
    FAIL -->|yes| PROP --> FIX --> BUILD
    FAIL -->|no| OK["-> Step 12"]
    FAIL -->|accept with reservations| OK
```

---

## 7. Internal protocols map

```mermaid
mindmap
  root((Spec-to-PR<br/>v8.1))
    Orchestrator
      Menu gates
      state.md under .cursor/plans/us-{id}/
      Retry 3x
      SKILL.md only
    Protocols
      Context loading
      GitHub issue fetch
      Memory-conflict
      Integration validation
      Learning
    Step 0
      Bootstrap
      GitHub issue snapshot
    Step 1
      Plan template
      Layered architecture
    Step 2
      Refinement loop
      Decision log
    Step 3
      Exec + DAG
      check_memory_conflict.py
    Step 4
      Coder readiness pause
    Step 5
      DAG implement
      Worktrees
    Step 6
      Verify readonly
      Feature table report
    Step 7
      Approve + 1st commit
    Step 8
      Review readiness pause
    Step 9
      Code review diff
    Step 10
      Fix + 2nd commit
      Final report
    Step 11
      Integration test plan
      Browser validation
      Fix loop + re-seed
    Step 12
      Cleanup + push consent
```

---

## 8. Artifacts and data flow

```mermaid
flowchart LR
    subgraph Input
        ISSUE["GitHub issue"]
        DESC["Feature description"]
    end

    subgraph State["state.md"]
        META["YAML: step, commits, retryCounts"]
        CTX["Context + MEMORY traps"]
        OUTS["Step outputs"]
        DEC["Accumulated decisions"]
    end

    P1["plan.md"] --> P2["plan.exec.md"]
    P2 --> CODE["Code"]
    CODE --> VR["us-id.plan.report.md"]
    VR --> FR["us-id.report.md"]
    FR --> ITP["integration-test.plan.md"]
    ITP --> ITR["integration-test.report.md"]
    ITR --> PUSH["push consent / PR manual"]

    ISSUE --> P1
    DESC --> P1

    State -.->|context| P1 & P2 & CODE & VR & FR & ITP & ITR
```

---

## 9. Dispatch table (reference)

| Step | subagent_type | Action | readonly | Model hint | Main artifact |
|------|---------------|--------|----------|------------|---------------|
| 0 | — | bootstrap + active-state check + context | — | — | state.md |
| 1 | `generalPurpose` | plan generation | false | Planner | `*.plan.md` |
| 2 | `generalPurpose` | refinement loop | false | Planner | `*.plan.md` (updated) |
| 3 | `generalPurpose` | exec + DAG + memory-conflict | false | Planner | `*.plan.exec.md` + `*.exec.dag.json` |
| 4 | — | Coder readiness (orchestrator) | — | Coder swap | — |
| 5 | `generalPurpose` | implement per DAG level | false | Coder | code |
| 6 | `generalPurpose` | verify vs plan/US | true | Verifier | `step-06-{slug}.plan.report.md` |
| 7 | `shell` + `generalPurpose` | 1st commit + learning | false | shell | commit hash |
| 8 | — | Review readiness (orchestrator) | — | Reviewer swap | — |
| 9 | `generalPurpose` | code review (diff only) | false | Reviewer | Critical/Warning list |
| 10 | `shell` + `generalPurpose` | fix + 2nd commit + report | false | Coder/shell | `step-10-{slug}.report.md` |
| 11 | `generalPurpose` + browser MCP + shell | integration validation loop | false | Verifier/Coder | `integration-test.plan.md` + `.report.md` |
| 12 | — + shell | cleanup + §Doc + push consent | — | shell | state completed |

---

## 8. Checkpoints & Backward Navigation (v8.1)

```mermaid
flowchart TB
    subgraph Checkpoints["Git tags (local only)"]
        T1["before-step-1 = baselineCommit"]
        T2["before-step-2"]
        TN["before-step-N+1"]
    end

    subgraph AfterStepN["After Step N completes"]
        UPD["Update state.md + Step file log"]
        TAG["git tag uswf/{id}/before-step-{N+1}"]
        BOARD["Render Progress Board"]
        GATE["Transition Gate AskQuestion"]
    end

    subgraph GateMenu["Transition Gate options"]
        NEXT["Next → Step N+1"]
        REPEAT["Repeat → Revert M=N if partial"]
        PREV["Previous → Backward Navigation"]
        PAUSE["Pause / Cancel / Full reset"]
    end

    subgraph BackNav["Backward Navigation to Step M"]
        SEL["Select phase + target M"]
        PREV2["Preview revertSet"]
        REV["Checkpoint Revert Algorithm"]
        REDIS["Re-dispatch Step M"]
    end

    UPD --> TAG --> BOARD --> GATE
    GATE --> NEXT
    GATE --> REPEAT
    GATE --> PREV
    GATE --> PAUSE
    PREV --> SEL --> PREV2 --> REV --> REDIS
    REV -.->|anchor| T1
    REV -.->|anchor| T2
    REV -.->|anchor| TN
```

| Navigation | Algorithm | `M` |
|------------|-----------|-----|
| Full reset | Checkpoint Revert | 1 |
| Previous (any earlier step) | Checkpoint Revert + redispatch | chosen |
| Repeat Step N (with partial output) | Checkpoint Revert + redispatch | N |
| Redo implementation (Step 7) | Backward Navigation shortcut | 5 |

---

## Legend

| Symbol | Meaning |
|--------|---------|
| **Orchestrator** | Main agent; state, gates, dispatch — no direct coding |
| **Subagent** | Task tool with fresh context per dispatch |
| **Gate** | Transition Gate — Next / Repeat / Previous / Pause |
| **Checkpoint tag** | Local git anchor `uswf/{id}/before-step-{N}` |
| **state.md** | Workflow-local memory + `## Step file log` for scoped revert |
| **SKILL.md** | Single source of step instructions (v8.1) |
| **autoMode** | Non-interactive — recommended option at every gate |
| **Step worktree** | `.cursor/plans/us-{id}/worktrees/step-{N}/` — code steps 5, 10, 11 only; max 1 active |

**Out of scope:** Opening/updating Pull Request, `fix-pr`, merge review — manual by the developer **after Step 12** (push consent).

---

## Triggers

- `@[spec-to-pr] 1925`
- `@[spec-to-pr] dry-run 1925`
- `@[spec-to-pr] auto 1925`
- `@[spec-to-pr] auto dry-run 1925`
- `/spec-to-pr US 1925`
- `/spec-to-pr auto US 1925`
- `/spec-to-pr dry-run auto US 1925`
- `/spec-to-pr auto skip-integration US 1925` — skips Step 11 (integration/browser)
- `/spec-to-pr auto skip-tests US 1925` — skips test suites (build still required)
- `/status` — Progress Board only
- "go back" / "back to step X" — Backward Navigation sub-menu (disabled when `autoMode: true`)
