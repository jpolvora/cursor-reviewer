#!/usr/bin/env python3
"""
update_state -- Automate State Hygiene updates for spec-to-pr state.md (v7)

Usage:
    python update_state.py <state-path> --step <N> --status <status> --elapsed <sec> [--tokens <prompt>:<comp>] [--model <model>] [--created <file1,file2>] [--modified <file1,file2>] [--deleted <file1,file2>] [--gate-choice <choice>]

This script:
  1. Parses the frontmatter of state.md.
  2. Appends or updates the step execution telemetry, status, dispatches, models.
  3. Merges files touched into the workflowManifest.
  4. Advances the currentStep.
  5. Appends to the gate history log.
  6. Writes the updated state.md file back cleanly.
  7. Runs validate_state.py on the result.
"""

import sys
import re
import datetime
import argparse
from pathlib import Path
import subprocess

# Simple YAML serializer for our specific flat/nested state structure
def serialize_yaml(data: dict) -> str:
    lines = []
    
    # helper for list of dicts/items
    def format_val(v, indent=""):
        if isinstance(v, bool):
            return str(v).lower()
        if v is None:
            return "null"
        if isinstance(v, (int, float)):
            return str(v)
        if isinstance(v, str):
            if "\n" in v or ":" in v or "#" in v or "," in v:
                return f'"{v}"'
            return v
        return str(v)

    for k, v in data.items():
        if isinstance(v, dict):
            if not v:
                lines.append(f"{k}: {{}}")
            else:
                lines.append(f"{k}:")
                for subk, subv in v.items():
                    if isinstance(subv, list):
                        if not subv:
                            lines.append(f"  {subk}: []")
                        else:
                            lines.append(f"  {subk}:")
                            for item in subv:
                                lines.append(f"    - {format_val(item)}")
                    elif isinstance(subv, dict):
                        lines.append(f"  {subk}: {format_val(subv)}")
                    else:
                        lines.append(f"  {subk}: {format_val(subv)}")
        elif isinstance(v, list):
            if not v:
                lines.append(f"{k}: []")
            else:
                lines.append(f"{k}:")
                for item in v:
                    if isinstance(item, dict):
                        # format inline dict: - { N: 0, label: ... }
                        parts = []
                        for subk, subv in item.items():
                            parts.append(f"{subk}: {format_val(subv)}")
                        lines.append(f"  - {{ {', '.join(parts)} }}")
                    else:
                        lines.append(f"  - {format_val(item)}")
        else:
            lines.append(f"{k}: {format_val(v)}")
    return "\n".join(lines)

def parse_inline_dict(s: str) -> dict:
    # parses: { N: 0, label: "foo", ... }
    s = s.strip().strip("{}")
    res = {}
    for part in re.split(r",\s*(?=[a-zA-Z0-9_]+:)", s):
        if not part.strip():
            continue
        m = re.match(r"^([a-zA-Z0-9_]+):\s*(.*)$", part.strip())
        if m:
            val = m.group(2).strip().strip('"').strip("'")
            if val.lower() == "true":
                val = True
            elif val.lower() == "false":
                val = False
            elif val.lower() == "null":
                val = None
            elif re.match(r"^\d+$", val):
                val = int(val)
            res[m.group(1)] = val
    return res

def parse_state_yaml(fm: str) -> dict:
    data = {}
    lines = fm.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        i += 1
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        
        # top level key
        m = re.match(r"^([A-Za-z0-9_]+):\s*(.*)$", line)
        if not m:
            continue
        key, val = m.group(1), m.group(2).strip()
        
        if val.startswith("[") and val.endswith("]"):
            inner = val[1:-1].strip()
            # Handle list of values or empty
            data[key] = [x.strip().strip('"').strip("'") for x in inner.split(",") if x.strip()] if inner else []
            # convert list of numbers
            if data[key] and all(re.match(r"^\d+$", x) for x in data[key]):
                data[key] = [int(x) for x in data[key]]
            continue
            
        if val == "" or val == "|":
            # Collect block
            block_lines = []
            while i < len(lines) and (lines[i].startswith(("  ", "\t")) or not lines[i].strip()):
                block_lines.append(lines[i])
                i += 1
            
            # parse block
            parsed_block = []
            parsed_dict = {}
            is_list = False
            for bl in block_lines:
                bs = bl.strip()
                if not bs:
                    continue
                if bs.startswith("-"):
                    is_list = True
                    item = bs[1:].strip()
                    if item.startswith("{") and item.endswith("}"):
                        parsed_block.append(parse_inline_dict(item))
                    else:
                        val = item.strip('"').strip("'")
                        if val.lower() == "true":
                            val = True
                        elif val.lower() == "false":
                            val = False
                        elif val.lower() == "null":
                            val = None
                        elif re.match(r"^\d+$", val):
                            val = int(val)
                        parsed_block.append(val)
                else:
                    bm = re.match(r"^([A-Za-z0-9_]+):\s*(.*)$", bs)
                    if bm:
                        bkey, bval = bm.group(1), bm.group(2).strip().strip('"').strip("'")
                        if bval.startswith("[") and bval.endswith("]"):
                            binner = bval[1:-1].strip()
                            parsed_dict[bkey] = [x.strip().strip('"').strip("'") for x in binner.split(",") if x.strip()] if binner else []
                        else:
                            if bval.lower() == "true":
                                bval = True
                            elif bval.lower() == "false":
                                bval = False
                            elif bval.lower() == "null":
                                bval = None
                            elif re.match(r"^\d+$", bval):
                                bval = int(bval)
                            parsed_dict[bkey] = bval
            if is_list:
                data[key] = parsed_block
            else:
                data[key] = parsed_dict
            continue
        
        # Simple string/boolean/number
        if val.lower() == "true":
            val = True
        elif val.lower() == "false":
            val = False
        elif val.lower() == "null":
            val = None
        elif re.match(r"^\d+$", val):
            val = int(val)
        else:
            val = val.strip('"').strip("'")
        data[key] = val
    return data

def main():
    parser = argparse.ArgumentParser(description="Update spec-to-pr state.md frontmatter")
    parser.add_argument("state_path", type=str, help="Path to state.md file")
    parser.add_argument("--step", type=int, required=True, help="Step number that just completed")
    parser.add_argument("--status", type=str, default="completed", choices=["completed", "failed", "skipped"], help="Step status")
    parser.add_argument("--elapsed", type=int, default=0, help="Elapsed time in seconds for the step")
    parser.add_argument("--tokens", type=str, help="Tokens as prompt:completion (e.g. 1500:500)")
    parser.add_argument("--model", type=str, help="Model name used for the step")
    parser.add_argument("--created", type=str, help="Comma-separated list of created files")
    parser.add_argument("--modified", type=str, help="Comma-separated list of modified files")
    parser.add_argument("--deleted", type=str, help="Comma-separated list of deleted files")
    parser.add_argument("--gate-choice", type=str, help="Choice chosen at the transition gate")
    
    args = parser.parse_args()
    state_path = Path(args.state_path)
    if not state_path.exists():
        print(f"Error: state file not found at {state_path}")
        sys.exit(1)
        
    content = state_path.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", content, re.DOTALL)
    if not m:
        print("Error: frontmatter YAML marker not found in state file")
        sys.exit(1)
        
    fm_text = m.group(1)
    body_text = m.group(2)
    
    data = parse_state_yaml(fm_text)
    
    step = args.step
    iso_now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    # 1. Update completedSteps and stepStatus
    completed_steps = data.get("completedSteps", [])
    if step not in completed_steps:
        completed_steps.append(step)
    completed_steps.sort()
    data["completedSteps"] = completed_steps
    
    step_status = data.get("stepStatus", {})
    step_status[str(step)] = args.status
    data["stepStatus"] = step_status
    
    if args.status == "skipped":
        skipped_steps = data.get("skippedSteps", [])
        if step not in skipped_steps:
            skipped_steps.append(step)
        skipped_steps.sort()
        data["skippedSteps"] = skipped_steps
        
    # 2. Update stepDispatches & stepModels
    step_dispatches = data.get("stepDispatches", [])
    # Find existing or add
    found_disp = False
    for disp in step_dispatches:
        if disp.get("step") == step:
            disp["dispatched"] = iso_now
            found_disp = True
            break
    if not found_disp:
        step_dispatches.append({"step": step, "dispatched": iso_now})
    data["stepDispatches"] = step_dispatches
    
    current_model = args.model or data.get("currentModel", "unknown")
    step_models = data.get("stepModels", [])
    found_model = False
    for sm in step_models:
        if sm.get("step") == step:
            sm["model"] = current_model
            sm["dispatched"] = iso_now
            found_model = True
            break
    if not found_model:
        step_models.append({"step": step, "model": current_model, "dispatched": iso_now})
    data["stepModels"] = step_models
    data["currentModel"] = current_model
    
    # 3. Process files touched
    created_list = [x.strip() for x in args.created.split(",") if x.strip()] if args.created else []
    modified_list = [x.strip() for x in args.modified.split(",") if x.strip()] if args.modified else []
    deleted_list = [x.strip() for x in args.deleted.split(",") if x.strip()] if args.deleted else []
    
    manifest = data.get("workflowManifest", {})
    if not isinstance(manifest, dict):
        manifest = {}
    manifest_created = manifest.get("created", [])
    manifest_artifacts = manifest.get("artifacts", [])
    
    for f in created_list:
        if f not in manifest_created:
            manifest_created.append(f)
    for f in deleted_list:
        if f in manifest_created:
            manifest_created.remove(f)
            
    manifest["created"] = manifest_created
    manifest["artifacts"] = manifest_artifacts
    data["workflowManifest"] = manifest
    
    # 4. Process Telemetry
    telemetry = data.get("telemetry", {})
    if not isinstance(telemetry, dict):
        telemetry = {}
    telemetry_steps = telemetry.get("steps", [])
    
    prompt_tok, comp_tok = 0, 0
    if args.tokens:
        tok_parts = args.tokens.split(":")
        if len(tok_parts) == 2:
            try:
                prompt_tok = int(tok_parts[0])
                comp_tok = int(tok_parts[1])
            except ValueError:
                pass
                
    files_count = len(created_list) + len(modified_list) + len(deleted_list)
    
    step_labels = {
        0: "Spec Creation", 1: "Planning", 2: "Refinement", 3: "Execution Plan & DAG",
        5: "Implementation", 6: "Verification & Report", 7: "Decision & First Commit",
        9: "Code Review", 10: "Fixes & Second Commit", 11: "Integration Validation",
        12: "Consolidation & Cleanup", 13: "Ship & PR"
    }
    
    step_telemetry = {
        "N": step,
        "label": step_labels.get(step, f"Step {step}"),
        "dispatchedAt": iso_now,
        "finishedAt": iso_now,
        "elapsedSec": args.elapsed,
        "promptTokens": prompt_tok,
        "completionTokens": comp_tok,
        "estimated": True,
        "model": current_model,
        "filesTouched": files_count
    }
    
    # Replace existing or append
    replaced_tel = False
    for i_tel, tel in enumerate(telemetry_steps):
        if tel.get("N") == step:
            telemetry_steps[i_tel] = step_telemetry
            replaced_tel = True
            break
    if not replaced_tel:
        telemetry_steps.append(step_telemetry)
    telemetry["steps"] = telemetry_steps
    
    # Recalculate totals
    total_elapsed = sum(t.get("elapsedSec", 0) for t in telemetry_steps)
    total_tokens = sum((t.get("promptTokens", 0) or 0) + ((t.get("completionTokens", 0) or 0) if t.get("completionTokens") else 0) for t in telemetry_steps)
    
    telemetry["totalElapsedSec"] = total_elapsed
    telemetry["totalTokens"] = total_tokens
    telemetry["workflowEndedAt"] = iso_now
    data["telemetry"] = telemetry
    
    # 5. Set next currentStep
    next_step = step + 1
    # Skip model sub-gates 4 and 8 in completed steps flow, but currentStep can be 4 or 8 briefly for transitions
    if step == 3:
        next_step = 4 # Coder readiness sub-gate
    elif step == 7:
        next_step = 8 # Review readiness sub-gate
        
    data["currentStep"] = next_step
    
    # 6. Append Gate History
    gate_choice = args.gate_choice or f"Advance to Step {next_step}"
    # Gate history is in the body, but let's append it or log it
    
    # Write back YAML frontmatter + body
    serialized_fm = serialize_yaml(data)
    new_content = f"---\n{serialized_fm}\n---\n{body_text}"
    
    # Append gate history log in markdown body
    if "## Gate history" in new_content:
        gate_line = f"- auto-gate | step {step} | {gate_choice} | {iso_now}"
        # insert right after ## Gate history
        new_content = new_content.replace("## Gate history", f"## Gate history\n{gate_line}")
        
    state_path.write_text(new_content, encoding="utf-8")
    print(f"Updated state.md for step {step}. Next step: {next_step}.")
    
    # Run validate_state.py as safety check
    validator_path = Path(__file__).resolve().parent / "validate_state.py"
    if validator_path.exists():
        r = subprocess.run([sys.executable, str(validator_path), str(state_path)], capture_output=True, text=True)
        if r.returncode != 0:
            print("Validation FAILED after update:")
            print(r.stdout)
            print(r.stderr)
            sys.exit(1)
        else:
            print("Validation PASSED after update.")
            
if __name__ == "__main__":
    main()
