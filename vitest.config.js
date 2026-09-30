import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// app.js loads ffmpeg.wasm from unpkg. Tests swap in a fake that records each
// exec() call, so we check what we ask ffmpeg to do without a 30 MB download.
const fake = fileURLToPath(new URL("./tests/fake-ffmpeg.js", import.meta.url));
export default defineConfig({
  resolve: {
    alias: {
      "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js": fake,
      "https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js": fake,
    },
  },
  test: { environment: "jsdom" },
});
