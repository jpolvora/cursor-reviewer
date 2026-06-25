#!/usr/bin/env bash

# Stop on errors
set -e

# Find script directory (source of skills)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_SKILLS_DIR="$SCRIPT_DIR/.agents/skills"

# Temporary directory for cloning if run remotely/standalone
TEMP_CLONE_DIR=""

cleanup() {
  if [ -n "$TEMP_CLONE_DIR" ] && [ -d "$TEMP_CLONE_DIR" ]; then
    rm -rf "$TEMP_CLONE_DIR"
  fi
}
trap cleanup EXIT

# Check if source skills directory exists
if [ ! -d "$SRC_SKILLS_DIR" ]; then
  echo "Source skills directory not found locally at $SRC_SKILLS_DIR"
  echo "Cloning cursor-reviewer repository to retrieve skills..."
  TEMP_CLONE_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t 'cursor-reviewer')"
  REPO_URL="${CURSOR_REVIEWER_REPO_URL:-https://github.com/jpolvora/cursor-reviewer.git}"
  REPO_BRANCH="${CURSOR_REVIEWER_REPO_BRANCH:-main}"
  git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$TEMP_CLONE_DIR"
  SRC_SKILLS_DIR="$TEMP_CLONE_DIR/.agents/skills"
fi

# Get current directory (target repository where script is run)
TARGET_DIR="$(pwd)"

# Avoid copying skills onto the source itself
# Resolve paths to avoid mismatch in trailing slashes or symlinks
RESOLVED_SRC_SKILLS_DIR="$(cd "$SRC_SKILLS_DIR" && pwd)"
RESOLVED_TARGET_SKILLS_DIR="$(mkdir -p "$TARGET_DIR/.agents/skills" && cd "$TARGET_DIR/.agents/skills" && pwd)"

if [ "$RESOLVED_SRC_SKILLS_DIR" = "$RESOLVED_TARGET_SKILLS_DIR" ]; then
  echo "Error: Target directory is the same as the source skills directory."
  echo "This script should be run from within the target repository where you want to install the skills."
  echo "Example:"
  echo "  cd /path/to/my-project"
  echo "  bash $SCRIPT_DIR/install-skills.sh"
  exit 1
fi

# Scan for skills directories
skills=()
for dir in "$SRC_SKILLS_DIR"/*; do
  if [ -d "$dir" ]; then
    skills+=("$(basename "$dir")")
  fi
done

if [ ${#skills[@]} -eq 0 ]; then
  echo "No skills found in $SRC_SKILLS_DIR"
  exit 0
fi

# Initialize selected array to false
selected=()
for ((i=0; i<${#skills[@]}; i++)); do
  selected[i]=false
done

while true; do
  # Clear screen gracefully (works in git bash / linux / macOS)
  clear 2>/dev/null || true
  
  echo "============================================================"
  echo "  Cursor Reviewer - Skill Installer"
  echo "============================================================"
  echo "Source: $SRC_SKILLS_DIR"
  echo "Target: $TARGET_DIR/.agents/skills"
  echo "------------------------------------------------------------"
  echo "Toggle selection by entering the number."
  echo "Enter 'a' to select/deselect all."
  echo "Enter 'y' or 'i' to install the selected skills."
  echo "Enter 'q' to quit."
  echo "------------------------------------------------------------"
  echo
  
  for ((i=0; i<${#skills[@]}; i++)); do
    mark=" "
    if [ "${selected[i]}" = "true" ]; then
      mark="x"
    fi
    printf "  [%s] %2d) %s\n" "$mark" $((i+1)) "${skills[i]}"
  done
  echo
  
  if [ -t 0 ]; then
    read -p "Select action or toggle (e.g. 1, a, y, q): " opt
  else
    read -p "Select action or toggle (e.g. 1, a, y, q): " opt < /dev/tty
  fi
  
  # Check if option is a number
  if [[ "$opt" =~ ^[0-9]+$ ]]; then
    idx=$((opt - 1))
    if [ $idx -ge 0 ] && [ $idx -lt ${#skills[@]} ]; then
      if [ "${selected[idx]}" = "true" ]; then
        selected[idx]="false"
      else
        selected[idx]="true"
      fi
    else
      echo "Invalid number: $opt. Press enter to continue..."
      if [ -t 0 ]; then
        read -r
      else
        read -r < /dev/tty
      fi
    fi
  elif [ "$opt" = "a" ] || [ "$opt" = "A" ]; then
    # Check if all are selected, if so deselect all, else select all
    all_selected=true
    for ((i=0; i<${#skills[@]}; i++)); do
      if [ "${selected[i]}" = "false" ]; then
        all_selected=false
        break
      fi
    done
    
    for ((i=0; i<${#skills[@]}; i++)); do
      if [ "$all_selected" = "true" ]; then
        selected[i]="false"
      else
        selected[i]="true"
      fi
    done
  elif [ "$opt" = "y" ] || [ "$opt" = "Y" ] || [ "$opt" = "i" ] || [ "$opt" = "I" ]; then
    break
  elif [ "$opt" = "q" ] || [ "$opt" = "Q" ]; then
    echo "Exiting without installing."
    exit 0
  else
    echo "Invalid option: $opt. Press enter to continue..."
    if [ -t 0 ]; then
      read -r
    else
      read -r < /dev/tty
    fi
  fi
done

# Perform copy
installed_count=0
echo
echo "Starting installation..."
for ((i=0; i<${#skills[@]}; i++)); do
  if [ "${selected[i]}" = "true" ]; then
    skill_name="${skills[i]}"
    src_path="$SRC_SKILLS_DIR/$skill_name"
    dest_dir="$TARGET_DIR/.agents/skills/$skill_name"
    
    echo "Installing '$skill_name'..."
    
    # Check if target folder exists
    if [ -d "$dest_dir" ]; then
      echo "  Warning: Destination directory '.agents/skills/$skill_name' already exists."
      if [ -t 0 ]; then
        read -p "  Overwrite? (y/n): " confirm_overwrite
      else
        read -p "  Overwrite? (y/n): " confirm_overwrite < /dev/tty
      fi
      if [[ ! "$confirm_overwrite" =~ ^[yY](es)?$ ]]; then
        echo "  Skipped: $skill_name"
        continue
      fi
      rm -rf "$dest_dir"
    fi
    
    # Create the parent directory structure if not exists
    mkdir -p "$TARGET_DIR/.agents/skills"
    
    # Copy directory
    cp -r "$src_path" "$dest_dir"
    echo "  Installed: $skill_name -> .agents/skills/$skill_name"
    installed_count=$((installed_count + 1))
  fi
done

echo
if [ $installed_count -gt 0 ]; then
  echo "Successfully installed $installed_count skill(s) into $TARGET_DIR/.agents/skills"
else
  echo "No skills were installed."
fi
