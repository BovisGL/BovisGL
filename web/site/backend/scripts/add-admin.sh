#!/bin/bash

# BovisGL Admin Invite Generator
# Usage: ./scripts/add-admin.sh

cd "$(dirname "$0")/.."

echo "🔐 Starting BovisGL Admin Invite Generator..."
echo ""

node scripts/create-admin-invite.js 