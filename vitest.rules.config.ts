import { defineConfig } from "vitest/config";

// Used by `npm run test:rules` (see security-tests/README.md) while a
// Firestore emulator is running. The normal `vitest.config.ts` excludes
// this folder; this file exists solely to include it.
export default defineConfig({
  test: {
    include: ["security-tests/**/*.test.ts"],
  },
});
