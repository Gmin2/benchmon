import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "VITE_");
  // share tags need absolute urls, so the site url goes into index.html at build time
  const site = (env.VITE_SITE_URL ?? "").replace(/\/$/, "");
  return {
    plugins: [react(), tailwindcss(), { name: "site-url", transformIndexHtml: (html: string) => html.replaceAll("__SITE__", site) }],
    envDir: "..",
    envPrefix: ["VITE_", "DYNAMIC_ENV_ID"],
  };
});
