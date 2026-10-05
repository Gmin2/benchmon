import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, "..", "VITE_");
  // share tags need absolute urls, so the site url goes into index.html at build time.
  // on vercel the production domain stands in until VITE_SITE_URL is set
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const site = (env.VITE_SITE_URL || (vercel ? `https://${vercel}` : "")).replace(/\/$/, "");

  // a production build never falls back to localhost: no backend url, no build
  if (command === "build" && mode === "production") {
    const missing = [!env.VITE_BACKEND_URL && "VITE_BACKEND_URL", !site && "VITE_SITE_URL"].filter(Boolean);
    if (missing.length) throw new Error(`missing ${missing.join(", ")} for a production build, see web/README.md`);
    for (const k of ["VITE_BACKEND_URL", "VITE_SITE_URL", "VITE_INDEXER_URL"]) {
      if (/localhost|127\.0\.0\.1/.test(env[k] ?? "")) console.warn(`warning: ${k} points at localhost in a production build`);
    }
    if (!env.VITE_INDEXER_URL) console.warn("warning: VITE_INDEXER_URL is not set, ranks and live lists will show empty states");
  }

  return {
    plugins: [react(), tailwindcss(), { name: "site-url", transformIndexHtml: (html: string) => html.replaceAll("__SITE__", site) }],
    envDir: "..",
    envPrefix: ["VITE_", "DYNAMIC_ENV_ID"],
    define: site ? { "import.meta.env.VITE_SITE_URL": JSON.stringify(site) } : {},
    build: {
      // the dynamic sdk chunk is vendor code over the default limit, the app chunks stay small
      chunkSizeWarningLimit: 800,
      rolldownOptions: {
        output: {
          // the wallet sdks are big and change rarely, so they get their own long cached chunks
          codeSplitting: {
            includeDependenciesRecursively: false,
            groups: [
              { name: "dynamic", test: /node_modules[\\/]@dynamic-labs/, priority: 30 },
              { name: "alchemy", test: /node_modules[\\/]@(alchemy|account-kit|aa-sdk)/, priority: 30 },
              { name: "viem", test: /node_modules[\\/](viem|ox|abitype|@noble|@scure)[\\/]/, priority: 20 },
              { name: "react", test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|@tanstack)[\\/]/, priority: 20 },
            ],
          },
        },
      },
    },
  };
});
