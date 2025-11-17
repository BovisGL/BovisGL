#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
COMMS_DIR="$ROOT_DIR/communications"
BUILD_LOG="$ROOT_DIR/build-logs/communications-build.log"

mkdir -p "$ROOT_DIR/build-logs"

echo "[build] Building communications service..."
echo "[build] Log file: $BUILD_LOG"
cd "$COMMS_DIR"

# Ensure dist is writable by current user to avoid EACCES
if [ -d dist ]; then
	if [ ! -w dist ]; then
		echo "[build] Fixing dist ownership (requires sudo for chown)"
		sudo chown -R "$(id -u):$(id -g)" dist
	fi
fi

{
	echo "=== Communications Build Log ==="
	echo "Started: $(date)"
	echo ""
	
	npm ci || npm install
	if [ $? -ne 0 ]; then
		echo "❌ npm install failed"
		exit 1
	fi
	
	npm run build
	if [ $? -ne 0 ]; then
		echo "❌ npm build failed"
		exit 1
	fi
	
	echo ""
	echo "Completed: $(date)"
	echo "✅ Build successful"
} 2>&1 | tee "$BUILD_LOG"

if [ ${PIPESTATUS[0]} -ne 0 ]; then
	echo "❌ Build failed. See logs above."
	exit 1
fi

echo "[restart] Restarting systemd service bovisgl-communications.service"
sudo systemctl restart bovisgl-communications.service

# Check if service is active
echo "[restart] Checking service status..."
sleep 2

if sudo systemctl is-active --quiet bovisgl-communications.service; then
	echo "✅ Service is active and running"
else
	echo "❌ Service failed to start!"
	echo "[logs] Recent service logs:"
	sudo journalctl -u bovisgl-communications.service -n 20 --no-pager
	exit 1
fi

echo "[restart] Done. Tail logs with: tail -n 200 \"$ROOT_DIR/logs/communications.log\""

