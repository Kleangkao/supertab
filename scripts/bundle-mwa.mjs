import { build } from "esbuild";

await build({
  entryPoints: ["src/lib/mwa-bootstrap.ts"],
  outfile: "android/app/src/main/assets/mwa-bootstrap.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
});
