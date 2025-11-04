/**
 * copy-icons.js
 *
 * Copies browser-specific icons into the extension's /src/icons directory.
 */

const fs = require("fs");
const path = require("path");
const projectRoot = path.join(__dirname, "..");

// Source: /inc/<browser>/icons/
const sourceDir = path.join(projectRoot, "inc", "icons");
const destDir = path.join(projectRoot, "public", "icons");

function copyDirectory(src, dest) {
	if (!fs.existsSync(src)) {
		console.error(`❌ Icon directory not found: ${src}`);
		process.exit(1);
	}

	fs.mkdirSync(dest, { recursive: true });

	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			copyDirectory(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
			console.log(`🖼️ Copied ${entry.name}`);
		}
	}
}

try {
	copyDirectory(sourceDir, destDir);
	console.log(`✅ Copied icons`);
	console.log(`→ ${path.relative(projectRoot, sourceDir)} → ${path.relative(projectRoot, destDir)}`);
} catch (err) {
	console.error("❌ Failed to copy icons:", err);
	process.exit(1);
}
