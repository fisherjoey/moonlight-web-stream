#!/usr/bin/env node
// Rasterizes public/icons/icon.svg into the PNG renditions referenced by
// manifest.webmanifest and the <link rel="apple-touch-icon"> tags.
//
// Not part of the build (vite build never runs this) — the generated PNGs
// are committed to the repo. Re-run manually after editing icon.svg:
//
//   npm install -D sharp   (if not already installed)
//   node scripts/make-icons.mjs

import sharp from "sharp"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ICONS_DIR = resolve(HERE, "../public/icons")
const SRC = resolve(ICONS_DIR, "icon.svg")

const targets = [
    { file: "icon-192.png", size: 192 },
    { file: "icon-512.png", size: 512 },
    // iOS ignores the manifest; Safari wants a dedicated, non-transparent
    // apple-touch-icon at ~180px.
    { file: "apple-touch-icon.png", size: 180 },
]

for (const { file, size } of targets) {
    const out = resolve(ICONS_DIR, file)
    await sharp(SRC, { density: (size / 512) * 96 * 4 })
        .resize(size, size)
        .png()
        .toFile(out)
    console.log(`wrote ${file} (${size}x${size})`)
}
