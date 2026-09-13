import { defineConfig } from "vitest/config";

// แยกจาก vite.config.ts เพื่อไม่ให้โหลดปลั๊กอิน Cloudflare/vinext ตอนรัน unit test
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
