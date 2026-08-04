import { defineConfig } from "vitest/config";

// security-tests/README.md içindeki `npm run test:rules` tarafından, bir
// Firestore emulator ayaktayken kullanılır. Normal `vitest.config.ts` bu
// klasörü dışlıyor; bu dosya sadece onu içerir.
export default defineConfig({
  test: {
    include: ["security-tests/**/*.test.ts"],
  },
});
