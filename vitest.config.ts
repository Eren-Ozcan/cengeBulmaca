import { configDefaults, defineConfig } from "vitest/config";

// security-tests/ sadece Firestore emulator çalışırken anlamlı olduğu için
// (bkz. security-tests/README.md), normal `npm test` koşusunun dışında
// tutuluyor — emulator kapalıyken bağlantı hatasıyla kırmızı görünmesin diye.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "security-tests/**"],
  },
});
