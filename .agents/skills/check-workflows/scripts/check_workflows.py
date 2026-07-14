#!/usr/bin/env python3
"""
check_workflows.py -- Auto-check workflow processes (spec-to-pr & spec-to-pr-lite)
for compatibility, step continuity, config fallbacks, state isolation, and references.
"""

import sys
import re
from pathlib import Path


def ensure_utf8_stdio() -> None:
    """Force UTF-8 on stdio so Windows locale (cp1252) does not break text I/O."""
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if not callable(reconfigure):
            continue
        try:
            reconfigure(encoding="utf-8")
        except Exception:
            pass


# Paths
REPO_ROOT = Path(__file__).resolve().parents[4]
SKILLS_DIR = REPO_ROOT / ".agents" / "skills"

def check_step_continuity():
    """Verify FSM tables in both SKILL.md files."""
    errors = []
    
    # 1. Check spec-to-pr (Standard FSM)
    std_skill_path = SKILLS_DIR / "spec-to-pr" / "SKILL.md"
    if not std_skill_path.exists():
        errors.append("Standard spec-to-pr SKILL.md is missing.")
    else:
        text = std_skill_path.read_text(encoding="utf-8")
        # Find the step index table: look for lines like "| 0 | Spec Creation |"
        steps_found = set()
        matches = re.findall(r"^\s*\|\s*(\d+)[^\s|]*\s*\|\s*([^|]+)\s*\|", text, re.MULTILINE)
        for m in matches:
            step_num = int(m[0])
            steps_found.add(step_num)
        
        # Verify standard has all steps 0-13 (4 and 8 are sub-gates but present in index)
        expected_steps = set(range(14))
        missing = expected_steps - steps_found
        if missing:
            errors.append(f"Standard spec-to-pr FSM is missing steps: {sorted(missing)}")
        else:
            print("✅ Standard spec-to-pr FSM step continuity verified.")

    # 2. Check spec-to-pr-lite (Lite FSM)
    lite_skill_path = SKILLS_DIR / "spec-to-pr-lite" / "SKILL.md"
    if not lite_skill_path.exists():
        errors.append("Lite spec-to-pr-lite SKILL.md is missing.")
    else:
        text = lite_skill_path.read_text(encoding="utf-8")
        steps_found = set()
        # Look for steps 1-5 index table
        matches = re.findall(r"^\s*\|\s*([1-5])\s*\|\s*([^|]+)\s*\|", text, re.MULTILINE)
        for m in matches:
            step_num = int(m[0])
            steps_found.add(step_num)
            
        expected_steps = {1, 2, 3, 4, 5}
        missing = expected_steps - steps_found
        if missing:
            errors.append(f"Lite spec-to-pr-lite FSM is missing steps: {sorted(missing)}")
        else:
            print("✅ Lite spec-to-pr-lite FSM step continuity verified.")

    return errors

def check_config_sharing_fallbacks():
    """Verify that configuration checks target shared/config.json."""
    errors = []
    
    # Check validate_state.py under spec-to-pr-lite
    lite_val_state = SKILLS_DIR / "spec-to-pr-lite" / "scripts" / "validate_state.py"
    if not lite_val_state.exists():
        errors.append("Lite validate_state.py script is missing.")
    else:
        code = lite_val_state.read_text(encoding="utf-8")
        if "shared" not in code or "config.json" not in code:
            errors.append("Lite validate_state.py does not target shared/config.json.")
        else:
            print("✅ Lite validate_state.py targets shared/config.json.")

    # Check local-spec-provider scripts
    lsp_scripts = ["register_local_spec.py", "detect_specs_dir.py"]
    for s_name in lsp_scripts:
        path = SKILLS_DIR / "local-spec-provider" / "scripts" / s_name
        if not path.exists():
            errors.append(f"Local Spec Provider script missing: {s_name}")
        else:
            code = path.read_text(encoding="utf-8")
            if "shared" not in code or "config.json" not in code:
                errors.append(f"Local Spec Provider script {s_name} does not reference shared/config.json.")
            else:
                print(f"✅ Local Spec Provider {s_name} references shared/config.json.")
                
    return errors

def check_state_isolation():
    """Verify state update files serialize workflowType correctly."""
    errors = []
    
    # 1. Standard update_state.py
    std_update = SKILLS_DIR / "spec-to-pr" / "scripts" / "update_state.py"
    if not std_update.exists():
        errors.append("Standard update_state.py is missing.")
    else:
        code = std_update.read_text(encoding="utf-8")
        if "workflowType" not in code or "standard" not in code:
            errors.append("Standard update_state.py does not serialize workflowType: standard.")
        else:
            print("✅ Standard update_state.py serializes workflowType.")

    # 2. Lite update_state.py
    lite_update = SKILLS_DIR / "spec-to-pr-lite" / "scripts" / "update_state.py"
    if not lite_update.exists():
        errors.append("Lite update_state.py is missing.")
    else:
        code = lite_update.read_text(encoding="utf-8")
        if "workflowType" not in code or "lite" not in code:
            errors.append("Lite update_state.py does not serialize workflowType: lite.")
        else:
            print("✅ Lite update_state.py serializes workflowType.")
            
    return errors

def main():
    ensure_utf8_stdio()

    print("=" * 60)
    print("  check-workflows: Validation Scan")
    print("=" * 60)
    
    errors = []
    errors.extend(check_step_continuity())
    errors.extend(check_config_sharing_fallbacks())
    errors.extend(check_state_isolation())
    
    print("-" * 60)
    if errors:
        print(f"❌ Validation FAILED with {len(errors)} error(s):")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)
    else:
        print("🎉 All workflow FSM, config fallback, and state isolation checks PASSED!")
        sys.exit(0)

if __name__ == "__main__":
    main()
