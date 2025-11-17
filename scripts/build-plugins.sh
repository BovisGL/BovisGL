#!/bin/bash
# Build all Minecraft plugins/mods only (no web, no communications)
# Targets:
#  - plugins/anarchy (Gradle)
#  - plugins/hub (Maven)
#  - plugins/proxy (Maven – Kotlin/Velocity)
#
# Output jars copied to ./build-outputs/plugins/
# For convenience, each primary jar is also duplicated without its version
# (e.g. bovisgl-anarchy-1.0.0.jar -> bovisgl-anarchy.jar) excluding sources/original jars.
# Lock file prevents concurrent runs.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$SCRIPT_DIR"
OUT_DIR="$ROOT_DIR/build-outputs/plugins"
LOCK_FILE="/tmp/bovisgl-plugins-build.lock"
LOG_DIR="$ROOT_DIR/build-logs"
mkdir -p "$OUT_DIR" "$LOG_DIR"

if [ -f "$LOCK_FILE" ]; then
  echo "❌ Another plugins build is running (lock: $LOCK_FILE)" >&2
  exit 1
fi
trap 'rm -f "$LOCK_FILE"' EXIT
echo $$ > "$LOCK_FILE"

run_stream() {
  local cmd="$1"; local logfile="$2"; echo -e "\n>>> $cmd"; echo "--- Log: $logfile ---"; 
  if (set -o pipefail; eval "$cmd" 2>&1 | tee "$logfile"); then
    return 0
  else
    local exit_code=${PIPESTATUS[0]:-1}
    echo ""
    echo "❌ Build failed with exit code $exit_code"
    echo "📋 Full log: $logfile"
    tail -30 "$logfile"
    return $exit_code
  fi
}

copy_artifacts() {
  local pattern="$1"; local destSub="$2"; mkdir -p "$OUT_DIR/$destSub";
  shopt -s nullglob;
  for f in $pattern; do
    local name="$(basename "$f")"
    cp -f "$f" "$OUT_DIR/$destSub/" && echo "   Copied $name -> $destSub";
    # Create versionless alias for primary jar (skip sources & original shaded backups)
    if [[ "$name" != *-sources.jar && "$name" != original-* ]]; then
      if [[ "$name" =~ -[0-9] ]]; then
        # remove last -<digits...>.jar segment
        local base_no_ver="${name%-[0-9]*.jar}.jar"
        if [[ "$base_no_ver" != "$name" ]]; then
          cp -f "$OUT_DIR/$destSub/$name" "$OUT_DIR/$destSub/$base_no_ver"
          echo "     ↳ versionless: $base_no_ver"
        fi
      fi
    fi
  done
  shopt -u nullglob;
}

echo "🔨 Building plugins (Gradle/Maven only)..."

# Anarchy (Gradle)
if [ -d "$ROOT_DIR/plugins/anarchy" ]; then
  pushd "$ROOT_DIR/plugins/anarchy" >/dev/null
  run_stream "./gradlew clean build -x test" "$LOG_DIR/anarchy-build.log"
  copy_artifacts "build/libs/*.jar" anarchy
  popd >/dev/null
else
  echo "(skip) anarchy plugin dir missing"
fi

# Hub (Maven)
if [ -d "$ROOT_DIR/plugins/hub" ]; then
  pushd "$ROOT_DIR/plugins/hub" >/dev/null
  run_stream "mvn -DskipTests clean package" "$LOG_DIR/hub-build.log"
  copy_artifacts "target/*.jar" hub
  popd >/dev/null
else
  echo "(skip) hub plugin dir missing"
fi

# Proxy (Maven or Gradle autodetect)
if [ -d "$ROOT_DIR/plugins/proxy" ]; then
  pushd "$ROOT_DIR/plugins/proxy" >/dev/null
  if [ -f "gradlew" ]; then
    run_stream "./gradlew clean build -x test" "$LOG_DIR/proxy-build.log"
    copy_artifacts "build/libs/*.jar" proxy
  elif [ -f "pom.xml" ]; then
    run_stream "mvn -DskipTests clean package" "$LOG_DIR/proxy-build.log"
    copy_artifacts "target/*.jar" proxy
  else
    echo "(skip) proxy plugin: no recognized build tool (gradlew or pom.xml)" | tee "$LOG_DIR/proxy-build.log"
  fi
  popd >/dev/null
else
  echo "(skip) proxy plugin dir missing"
fi

# Check for build errors
BUILD_ERRORS=0
for logfile in "$LOG_DIR"/*.log; do
  if grep -qi "ERROR\|BUILD.*FAIL\|error" "$logfile" 2>/dev/null; then
    ((BUILD_ERRORS++))
    echo ""
    echo "⚠️ Errors found in: $(basename $logfile)"
    echo "---"
    grep -i "ERROR\|error TS" "$logfile" | head -5
    echo "---"
  fi
done

echo ""
if [ $BUILD_ERRORS -gt 0 ]; then
  echo "❌ Build completed with $BUILD_ERRORS error(s)"
  echo "📋 Check logs in: $LOG_DIR"
  exit 1
else
  echo "✅ Plugins build complete. Artifacts in $OUT_DIR"
fi

if [ "${NO_PAUSE:-0}" != "1" ]; then
  read -p "Press Enter to exit..." || true
fi
