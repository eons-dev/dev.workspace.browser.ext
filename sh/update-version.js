const fs = require('fs');
const path = require('path');

// Get version from command line argument or environment variable
const version = process.argv[2] || process.env.VERSION;

if (!version) {
    console.error('No version provided. Usage: node update-version.js <version>');
    process.exit(1);
}

// Remove 'v' prefix if present (e.g., v1.0.0 -> 1.0.0)
const cleanVersion = version.replace(/^v/, '');

// Update both manifest files
const manifestPaths = [
    path.join(__dirname, '..', 'inc', 'chromium', 'manifest.json'),
    path.join(__dirname, '..', 'inc', 'gecko', 'manifest.json')
];

manifestPaths.forEach(manifestPath => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.version = cleanVersion;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t') + '\n');
    console.log(`Updated ${path.basename(path.dirname(manifestPath))} manifest to version ${cleanVersion}`);
});