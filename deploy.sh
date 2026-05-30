#!/usr/bin/env bash
set -e

# Run this on the VPS after git push to redeploy
# Usage: ./deploy.sh

echo "=== Pulling latest code ==="
cd /root/btb_attack
git pull origin main

echo "=== Rebuilding and restarting containers ==="
docker compose up -d --build

echo "=== Cleaning up old images ==="
docker image prune -f

echo "=== Done ==="
