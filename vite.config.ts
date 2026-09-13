import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

// ไม่เปิด CDN cache: ทุกหน้าเป็นข้อมูลเฉพาะผู้ใช้ที่ login อยู่ ห้าม cache ข้ามคน
export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
