import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Anchor's client and web3.js expect Buffer and friends in the browser.
// The app shares code with ../scripts/lib, so dedupe makes those imports resolve to the app's own
// node_modules (one copy of web3.js, and a Buffer shim the production build can find).
export default defineConfig({
  plugins: [react(), nodePolyfills({ include: ["buffer"], globals: { Buffer: true } })],
  resolve: { dedupe: ["@solana/web3.js", "@anchor-lang/core", "bn.js", "buffer", "vite-plugin-node-polyfills"] },
  server: { port: 5175, fs: { allow: [path.resolve(__dirname, "..")] } },
  build: { chunkSizeWarningLimit: 2_000 },
});
