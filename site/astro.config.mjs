import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://dev-flow.acrazie.dev",
  output: "static",
  vite: { plugins: [tailwindcss()] },
});
