const fs = require('fs');
const path = require('path');

const browser = process.env.BROWSER || 'chromium';
const sourceManifest = path.join(__dirname, '..', 'inc', browser, 'manifest.json');
const destManifest = path.join(__dirname, '..', 'src', 'manifest.json');

if (!fs.existsSync(sourceManifest)) {
    console.error(`Manifest not found for browser: ${browser}`);
    process.exit(1);
}

fs.copyFileSync(sourceManifest, destManifest);
console.log(`Copied manifest for ${browser}`);