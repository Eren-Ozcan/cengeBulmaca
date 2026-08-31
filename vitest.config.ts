import { configDefaults, defineConfig } from "vitest/config";

// security-tests/ only makes sense while the Firestore emulator is running
// (see security-tests/README.md), so it's kept out of the normal `npm test`
// run — otherwise it shows red with a connection error when the emulator is off.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "security-tests/**"],
  },
});
