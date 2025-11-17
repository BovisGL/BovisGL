#!/bin/bash
# Build and deploy the communications service using systemd (preferred) then fall back only if systemd unavailable.
set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$SCRIPT_DIR"
COMMS_DIR="$ROOT_DIR/communications"
SERVICE="bovisgl-communications"
UNIT_SRC="$ROOT_DIR/systemd-services/${SERVICE}.service"
UNIT_DEST="/etc/systemd/system/${SERVICE}.service"

if [ ! -d "$COMMS_DIR" ]; then
  echo "Missing communications directory: $COMMS_DIR" >&2
  exit 1
fi

cd "$COMMS_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found - install Node.js" >&2
  exit 1
fi

echo "[communications] Cleaning old build..."
rm -rf dist

echo "[communications] Installing dependencies (respecting lockfile)..."
npm install --no-audit --no-fund

echo "[communications] Compiling TypeScript -> JS..."
npm run build

SECRET_FILE="$ROOT_DIR/secrets/plugin-requests.txt"
if [ ! -f "$SECRET_FILE" ]; then
  mkdir -p "$(dirname "$SECRET_FILE")"
  head -c 48 /dev/urandom | base64 | tr -d '\n=/' | cut -c1-48 > "$SECRET_FILE"
  echo "Generated new secret at $SECRET_FILE"
fi

SYSTEMD_AVAILABLE=false
if command -v systemctl >/dev/null 2>&1; then
  SYSTEMD_AVAILABLE=true
fi

if $SYSTEMD_AVAILABLE; then
  if [ -f "$UNIT_SRC" ]; then
    echo "[communications] Installing/Updating systemd unit..."
    sudo cp "$UNIT_SRC" "$UNIT_DEST"
    sudo chmod 644 "$UNIT_DEST"
    echo "[communications] Reloading systemd daemon..."
    sudo systemctl daemon-reload
    echo "[communications] Enabling service (persist on boot)..."
    sudo systemctl enable "$SERVICE" >/dev/null 2>&1 || true
    echo "[communications] Restarting service via systemd..."
    if sudo systemctl restart "$SERVICE"; then
      if sudo systemctl is-active --quiet "$SERVICE"; then
        echo "✅ Service active (systemd)"
        exit 0
      else
        echo "⚠️ Service not active after restart (systemd)" >&2
      fi
    else
      echo "⚠️ systemd restart failed, will attempt manual start" >&2
    fi
  else
    echo "⚠️ Missing unit file at $UNIT_SRC; skipping systemd deploy" >&2
  fi
fi

RUN_DIR="$COMMS_DIR/run"
PID_FILE="$RUN_DIR/${SERVICE}.pid"
mkdir -p "$RUN_DIR"

if [ -f "$PID_FILE" ]; then
  oldpid=$(cat "$PID_FILE" || true)
  if [ -n "$oldpid" ] && kill -0 "$oldpid" 2>/dev/null; then
    echo "Stopping old PID $oldpid"
    kill "$oldpid" || true
    sleep 1
    kill -0 "$oldpid" 2>/dev/null && kill -9 "$oldpid" || true
  fi
fi

export BOVISGL_COMMS="http://localhost:3456"
export NODE_ENV=production

LOG_FILE="$RUN_DIR/${SERVICE}.log"
echo "Starting manually (systemd unavailable or failed)... (log: $LOG_FILE)"

# Free port 3456 if occupied by stale process when falling back
PORT=3456
EXISTING_PID=$(lsof -ti :$PORT || true)
if [ -n "${EXISTING_PID}" ]; then
  echo "Port $PORT in use by PID ${EXISTING_PID}; terminating for manual restart..."
  kill "${EXISTING_PID}" 2>/dev/null || true
  sleep 1
  kill -0 "${EXISTING_PID}" 2>/dev/null && kill -9 "${EXISTING_PID}" || true
fi

nohup node dist/server.js > "$LOG_FILE" 2>&1 &
newpid=$!
echo $newpid > "$PID_FILE"
sleep 1
if kill -0 "$newpid" 2>/dev/null; then
  echo "✅ Started communications manually (PID $newpid)"
else
  echo "❌ Failed to start communications manually; check $LOG_FILE" >&2
  exit 1
fi
