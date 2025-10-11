#!/usr/bin/env bun
/**
 * Build script for voice-mcp server
 * Creates a standalone executable bundle
 */

import { mkdir, rm } from "fs/promises";
import { join } from "path";

// Build to a temporary directory first
const tempDir = "./dist-server";

try {
  await rm(tempDir, { recursive: true, force: true });
} catch {}

await mkdir(tempDir, { recursive: true });

const result = await Bun.build({
  entrypoints: ["./src/index.tsx"],
  outdir: tempDir,
  target: "bun",
  minify: false,
  sourcemap: "external",
  naming: {
    entry: "server.js",
    chunk: "[name]-[hash].js",
    asset: "[name]-[hash].[ext]"
  },
  external: [
    // External modules that should not be bundled
    "elevenlabs",
    "@modelcontextprotocol/sdk",
  ],
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Add shebang to the server bundle
const tempServerPath = join(tempDir, "server.js");
const serverCode = await Bun.file(tempServerPath).text();
const serverWithShebang = `#!/usr/bin/env bun\n${serverCode}`;

// Write to final destination
const finalServerPath = "./dist/server.js";
await Bun.write(finalServerPath, serverWithShebang);

// Copy sourcemap if it exists
const tempMapPath = join(tempDir, "server.js.map");
const finalMapPath = "./dist/server.js.map";
if (await Bun.file(tempMapPath).exists()) {
  await Bun.write(finalMapPath, Bun.file(tempMapPath));
}

// Make it executable
await Bun.$`chmod +x ${finalServerPath}`;

// Clean up temp directory
await rm(tempDir, { recursive: true, force: true });

console.log("✅ Server built successfully!");
console.log("Output: dist/server.js");
