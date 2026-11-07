#!/bin/bash
# Pi-side deploy: pull latest, rebuild, restart the service.
# Run from the Pi: ./deploy.sh   (or `ssh pi@<host> './alexa-hub/deploy.sh'` from the Mac)
set -e

cd "$(dirname "$0")"
git pull
npm install
npm run build
sudo systemctl restart alexa-hub

echo "Deployed. Checking status..."
sudo systemctl status alexa-hub --no-pager -l | head -10
