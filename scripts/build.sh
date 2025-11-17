#!/bin/bash

# Build script for Linux

set -e  # Exit on any error

# Lock mechanism to prevent multiple builds
LOCK_FILE="/tmp/bovisgl-build.lock"
if [ -f "$LOCK_FILE" ]; then
    echo "❌ Another build process is already running (lock file exists: $LOCK_FILE)"
    echo "If you're sure no other build is running, remove the lock file with: rm $LOCK_FILE"
    exit 1
fi

# Create lock file
echo $$ > "$LOCK_FILE"

# Ensure lock file is removed on exit
cleanup() {
    rm -f "$LOCK_FILE"
}
trap cleanup EXIT

echo "Starting build process..."

# Get the root directory (where build.sh is located)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$SCRIPT_DIR"

# Directory for live build logs
LOG_DIR="$ROOT_DIR/build-logs"
mkdir -p "$LOG_DIR"

# Helper: run a command, stream stdout/stderr live to console and append to a logfile
# Returns the command exit status.
run_stream() {
    local cmd="$1"
    local logfile="$2"
    echo "\n>>> Running: $cmd"
    echo "--- Log: $logfile ---"
    mkdir -p "$(dirname "$logfile")"
    # shellcheck disable=SC2086
    (set -o pipefail; eval "$cmd" 2>&1 | tee -a "$logfile")
    return ${PIPESTATUS[0]:-0}
}

# Copy systemd service files to production location
echo "Copying systemd service files to /etc/systemd/system/..."
sudo cp -f systemd-services/*.service /etc/systemd/system/
echo "Systemd service files copied successfully!"

# Reload systemd to pick up any changes
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload
echo "Systemd daemon reloaded!"

# Start communications service only (no build). Use separate script to build.
echo "📞 Ensuring communications service is running (no build)..."
if [ -d "$ROOT_DIR/communications" ]; then
    if systemctl list-unit-files | grep -q "bovisgl-communications.service"; then
        if systemctl is-active --quiet bovisgl-communications; then
            echo "✅ Communications service already running (systemd)"
        else
            echo "Starting communications service via systemd..."
            sudo systemctl start bovisgl-communications || echo "⚠️ Could not start communications service"
        fi
    else
        # Manual start fallback only if not already running; assumes already built
        if pgrep -f "communications/dist/server.js" >/dev/null; then
            echo "✅ Communications service already running (manual)"
        else
            if [ -f "$ROOT_DIR/communications/dist/server.js" ]; then
                echo "Starting communications service manually (pre-built)..."
                nohup node "$ROOT_DIR/communications/dist/server.js" > "$ROOT_DIR/logs/communications.log" 2>&1 &
                echo "Started communications (PID $!)"
            else
                echo "⚠️ Communications dist/server.js not found. Build it with: ./build-communications.sh"
            fi
        fi
    fi
else
    echo "No communications directory found; skipping communications start"
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
echo "Cleaning backend dist..."
cd web/site/backend
sudo rm -rf dist/ node_modules/.cache/ || true
echo "Cleaning frontend dist..."
cd ../frontend
sudo rm -rf dist/ node_modules/.cache/ node_modules/.vite/ || true

# Build backend
echo "🔧 Building backend..."
cd ../backend
echo "Installing backend dependencies..."
npm install
echo "Building backend (clean build)..."
npm run build

# Build frontend
echo "🔧 Building frontend..."
cd ../frontend
echo "Installing frontend dependencies..."
npm install
echo "Building frontend (clean build)..."
npm run build

cd ../..

echo "✅ Backend and frontend build completed successfully!"

# Navigate to backend directory for service operations
cd "$ROOT_DIR/web/site/backend"

# Function to restart service with proper error handling and logging
restart_service() {
    local service_name=$1
    echo "Restarting $service_name service..."
    
    if sudo systemctl restart $service_name; then
        echo "$service_name service restarted successfully!"
        return 0
    else
        echo "❌ $service_name restart failed, trying to start service..."
        if sudo systemctl start $service_name; then
            echo "$service_name service started successfully!"
            return 0
        else
            echo "❌ Failed to start $service_name service!"
            echo "📋 Service status:"
            sudo systemctl status $service_name --no-pager || true
            echo "📋 Last 20 lines of service logs:"
            sudo journalctl -u $service_name -n 20 --no-pager || true
            return 1
        fi
    fi
}

# Function to ensure service is running
ensure_service_running() {
    local service_name=$1
    echo "Checking $service_name service status..."
    
    if sudo systemctl is-active --quiet $service_name; then
        echo "✅ $service_name service is already running - leaving it alone"
        return 0
    else
        echo "⚠️ $service_name service is not running - starting it..."
        if sudo systemctl start $service_name; then
            echo "$service_name service started successfully!"
            return 0
        else
            echo "❌ Failed to start $service_name service!"
            echo "📋 Service status:"
            sudo systemctl status $service_name --no-pager || true
            return 1
        fi
    fi
}

# Function to check service status without affecting it
check_service_status() {
    local service_name=$1
    echo "Checking $service_name service status..."
    
    if sudo systemctl is-active --quiet $service_name; then
        echo "✅ $service_name service is running"
    else
        echo "⚠️ $service_name service is not running"
        echo "📋 Service status:"
        sudo systemctl status $service_name --no-pager || true
    fi
}

# Restart web service (essential for web frontend/backend)
restart_service "bovisgl-web"


# Restart Cloudflare tunnel (needed for web access)
restart_service "bovisgl-cloudflare-tunnel"


# Check status of Minecraft servers
echo ""
echo "🎮 Minecraft server status check:"
for server in bovisgl-hub bovisgl-parkour bovisgl-arena bovisgl-civilization bovisgl-anarchy bovisgl-proxy; do
    if systemctl list-units --full -all | grep -Fq "$server.service"; then
        check_service_status "$server"
    fi
done

echo "✅ All services processed!"
echo ""
echo "📝 Summary:"
echo "   🌐 Built: Frontend and Backend web components"
echo "   🔄 Restarted: bovisgl-web, bovisgl-cloudflare-tunnel"
echo "   📞 Started: Communications service (if available)"
echo "   🎮 Minecraft servers: Status checked"
echo ""
echo "💡 To build/deploy other services, use:"
echo "   ./build-communications.sh (build & restart communications)"
echo "   ./build-plugins.sh (build only)"
echo "   ./build-restart-communications.sh (restart communications)"
echo ""
echo "Web build complete."

# Interactive pause at the end; set NO_PAUSE=1 to skip (useful for CI or sudo runs)
if [ "${NO_PAUSE:-0}" != "1" ]; then
    read -p "Press Enter to exit..."
fi