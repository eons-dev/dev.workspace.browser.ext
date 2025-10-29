#!/bin/bash

# Test the version update script locally
set -e

echo "Testing version update script..."

# Backup original manifests
cp inc/chromium/manifest.json inc/chromium/manifest.json.backup
cp inc/gecko/manifest.json inc/gecko/manifest.json.backup

# Test with a version tag
TEST_VERSION="v2.5.3"
echo "Testing with version: $TEST_VERSION"
node sh/update-version.js "$TEST_VERSION"

# Verify the versions were updated correctly
CHROME_VERSION=$(node -p "require('./inc/chromium/manifest.json').version")
FIREFOX_VERSION=$(node -p "require('./inc/gecko/manifest.json').version")

echo "Chrome manifest version: $CHROME_VERSION"
echo "Firefox manifest version: $FIREFOX_VERSION"

if [ "$CHROME_VERSION" != "2.5.3" ] || [ "$FIREFOX_VERSION" != "2.5.3" ]; then
    echo "❌ Version update failed!"
    # Restore backups
    mv inc/chromium/manifest.json.backup inc/chromium/manifest.json
    mv inc/gecko/manifest.json.backup inc/gecko/manifest.json
    exit 1
fi

echo "✅ Version update successful!"

# Restore original manifests
mv inc/chromium/manifest.json.backup inc/chromium/manifest.json
mv inc/gecko/manifest.json.backup inc/gecko/manifest.json

echo "Original manifests restored."