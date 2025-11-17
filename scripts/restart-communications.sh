#!/usr/bin/env bash
set -euo pipefail

echo "[restart] Restarting systemd service bovisgl-communications.service"
sudo systemctl restart bovisgl-communications.service
echo "[restart] Done. Check logs with: sudo journalctl -u bovisgl-communications.service -n 200 -f"

