#!/bin/bash
# Deploy (replace) all built plugins/mods into their server directories.
# Uses versionless jars in build-outputs/plugins/<name>/<name>.jar when present
# or falls back to the newest versioned jar (excluding *-sources.jar and original-* backups).
# Adds options to backup, dry-run, limit modules, and clean old versioned jars.
#
# Usage:
#   ./deploy-plugins.sh [--backup] [--dry-run] [--only=name1,name2] [--clean]
#
# Options:
#   --backup   : Before replacing, copy existing target jar to <jar>.bak-<timestamp>
#   --dry-run  : Show what would be done without copying
#   --only=..  : Comma-separated module names (anarchy,hub,parkour,proxy)
#   --clean    : Remove old versioned jars for a module in the target directory
#                (keeps files ending with .bak-*). Useful to avoid pile-up.
#
# Exit codes:
#   0 success, 1 partial failure, 2 usage error.

set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$ROOT_DIR/build-outputs/plugins"
BACKUP=0
DRY=0
ONLY=""
CLEAN=0

for arg in "$@"; do
  case "$arg" in
    --backup) BACKUP=1 ; shift ;;
    --dry-run) DRY=1 ; shift ;;
    --clean) CLEAN=1 ; shift ;;
    --only=*) ONLY="${arg#*=}" ; shift ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

IFS=',' read -r -a ONLY_LIST <<< "$ONLY"

want() {
  if [ -z "$ONLY" ]; then return 0; fi
  local n
  for n in "${ONLY_LIST[@]}"; do [[ "$n" == "$1" ]] && return 0; done
  return 1
}

# name  subdir  targetDir                      type
MODULES=(
  "anarchy anarchy servers/anarchy/mods fabric"
  "hub hub servers/hub/plugins paper"
  "parkour parkour servers/parkour/plugins paper"
  "proxy proxy servers/proxy/plugins velocity"
)

find_candidate() {
  local name="$1"; local sub="$2"; local dir="$SRC_DIR/$sub"; local jar=""
  if [ -f "$dir/$name.jar" ]; then
    jar="$dir/$name.jar"
  else
    # fallback to latest versioned
    jar=$(ls -1t "$dir"/*.jar 2>/dev/null | grep -v sources | grep -v original- | head -n1 || true)
  fi
  echo "$jar"
}

clean_old_versions() {
  local destDir="$1"; local baseName="$2"
  # Remove versioned variants (baseName-<digits>.jar) except the one just copied (handled after copy)
  shopt -s nullglob
  for f in "$destDir"/${baseName}-*.jar; do
    # skip backups
    [[ "$f" == *.bak-* ]] && continue
    rm -f "$f" && echo "    [clean] removed $(basename "$f")"
  done
  shopt -u nullglob
}

copy_module() {
  local name="$1" sub="$2" dest="$3" kind="$4"
  if ! want "$name"; then return 0; fi
  local srcPath="$SRC_DIR/$sub"
  if [ ! -d "$srcPath" ]; then
    echo "[skip:$name] No artifacts in $srcPath"; return 0
  fi
  mkdir -p "$dest"
  local cand
  cand=$(find_candidate "$name" "$sub")
  if [ -z "$cand" ]; then
    echo "[warn:$name] No jar found in $srcPath"; return 0
  fi
  local base=$(basename "$cand")
  local destFile="$dest/$base"

  if [ $DRY -eq 1 ]; then
    echo "[dry:$name] Would copy $cand -> $destFile"
    [ $CLEAN -eq 1 ] && echo "[dry:$name] Would clean old versioned jars in $dest"
    return 0
  fi

  if [ $BACKUP -eq 1 ] && [ -f "$destFile" ]; then
    local ts=$(date +%Y%m%d-%H%M%S)
    cp -f "$destFile" "$dest/${base}.bak-$ts" && echo "[backup:$name] $base -> ${base}.bak-$ts"
  fi

  cp -f "$cand" "$destFile" && echo "[deploy:$name] $base -> $dest ($kind)"

  if [ $CLEAN -eq 1 ]; then
    # Clean OTHER versioned jars for this module, keep current exact one
    local stem="${name}" # expecting versionless alias exists or base
    clean_old_versions "$dest" "$stem"
  fi
}

any_fail=0
for entry in "${MODULES[@]}"; do
  # shellcheck disable=SC2086
  copy_module $entry || any_fail=1
done

if [ $DRY -eq 1 ]; then
  echo "Dry run complete."; exit 0
fi

if [ $any_fail -ne 0 ]; then
  echo "One or more modules failed (see above)." >&2
  exit 1
fi

echo "All requested modules deployed successfully."
