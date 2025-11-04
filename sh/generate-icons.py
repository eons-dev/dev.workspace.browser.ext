#!/usr/bin/env python3
"""
generate_icons.py

Generate square PNG icons for browser extensions from a single source image.
Preserves the original aspect ratio by padding with transparency as needed.

Requires:
	pip install pillow

Usage:
	python generate_icons.py path/to/source.png [output_dir]

Example:
	python generate_icons.py logo.png public/icons
"""

import sys
import os
from PIL import Image

# -------------------------------------------------------------
# Configuration
# -------------------------------------------------------------
SIZES = [16, 32, 48, 64, 128, 256]  # Typical WebExtension icon sizes


def resize_with_padding(img, target_size):
	"""
	Resize an image to fit within target_size × target_size, keeping aspect ratio.
	Adds transparent padding to make it exactly square.
	"""
	img = img.convert("RGBA")

	# Calculate new size maintaining aspect ratio
	ratio = min(target_size / img.width, target_size / img.height)
	new_width = int(img.width * ratio)
	new_height = int(img.height * ratio)
	resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

	# Create transparent square background
	new_img = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))

	# Center the resized image
	x_offset = (target_size - new_width) // 2
	y_offset = (target_size - new_height) // 2
	new_img.paste(resized, (x_offset, y_offset), resized)

	return new_img


def generate_icons(src_path, out_dir="icons"):
	if not os.path.exists(src_path):
		print(f"❌ Source image not found: {src_path}")
		sys.exit(1)

	os.makedirs(out_dir, exist_ok=True)

	with Image.open(src_path) as img:
		for size in SIZES:
			output_path = os.path.join(out_dir, f"icon-{size}.png")
			square = resize_with_padding(img, size)
			square.save(output_path, format="PNG")
			print(f"✅ Generated {output_path}")

	print("🎉 All icons generated successfully!")


if __name__ == "__main__":
	if len(sys.argv) < 2:
		print("Usage: python generate_icons.py <source.png> [output_dir]")
		sys.exit(1)

	source = sys.argv[1]
	output_dir = sys.argv[2] if len(sys.argv) > 2 else "icons"
	generate_icons(source, output_dir)
