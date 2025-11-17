#!/bin/bash

# BovisGL Database Permissions Fix Script
# Run this script if you encounter database permission issues

set -e

# Get the script directory and navigate to backend directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
DATA_DIR="$BACKEND_DIR/data"
USER="elijah"
GROUP="elijah"

echo "🔧 Fixing BovisGL database permissions..."

# Check if running as correct user
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  Running as root - will fix ownership to $USER:$GROUP"
    SUDO="sudo"
else
    echo "✅ Running as user: $(whoami)"
    SUDO=""
fi

# Fix ownership of data directory
echo "📁 Fixing data directory ownership..."
$SUDO chown -R $USER:$GROUP "$DATA_DIR"

# Set proper permissions
echo "🔒 Setting proper permissions..."
$SUDO chmod -R 755 "$DATA_DIR"

# Fix database files specifically
echo "🗄️  Fixing database file permissions..."
find "$DATA_DIR" -name "*.db" -exec $SUDO chmod 664 {} \;
find "$DATA_DIR" -name "*.db" -exec $SUDO chown $USER:$GROUP {} \;

# Fix log directory
echo "📝 Fixing log directory..."
LOG_DIR="$BACKEND_DIR/logs"
if [ -d "$LOG_DIR" ]; then
    $SUDO chown -R $USER:$GROUP "$LOG_DIR"
    $SUDO chmod -R 755 "$LOG_DIR"
fi

echo "✅ Database permissions fixed!"
echo "   Data directory: $DATA_DIR"
echo "   Owner: $USER:$GROUP"
echo "   Permissions: 755 (directories), 664 (database files)"

# Test database access
echo "🧪 Testing database access..."
if [ -f "$DATA_DIR/admins/admins.db" ]; then
    if sqlite3 "$DATA_DIR/admins/admins.db" ".tables" > /dev/null 2>&1; then
        echo "✅ Database is accessible!"
    else
        echo "❌ Database access test failed"
        exit 1
    fi
else
    echo "ℹ️  Database file doesn't exist yet"
fi

echo "🎉 All done!" 