import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Anchor's client and web3.js expect Buffer and friends in the browser.
export default defineConfig({
  plugins: [react(), nodePolyfills({ include: ["buffer"], globals: { Buffer: true } })],
  resolve: { dedupe: ["@solana/web3.js", "@anchor-lang/core", "bn.js", "buffer", "vite-plugin-node-polyfills"] },
  server: { port: 5176, fs: { allow: [".."] } },
  build: { chunkSizeWarningLimit: 2_000 },
});
