#!/bin/bash

echo "Installing Playwright dependencies..."
npx playwright install-deps
npx playwright install chromium

echo "Starting Node.js application..."
node index.js