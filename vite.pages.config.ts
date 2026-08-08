import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
  const isUserSite = repositoryName.endsWith(".github.io");
  const base = process.env.GITHUB_ACTIONS === "true" && repositoryName && !isUserSite
    ? `/${repositoryName}/`
    : "/";

  return {
    root: "static-entry",
    base,
    publicDir: "../public",
    plugins: [react()],
    define: {
      "process.env.NEXT_PUBLIC_SHEET_API_URL": JSON.stringify(
        env.NEXT_PUBLIC_SHEET_API_URL ?? ""
      ),
    },
    build: {
      outDir: "../pages-dist",
      emptyOutDir: true,
    },
  };
});
