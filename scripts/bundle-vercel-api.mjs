import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveShared(spec) {
  const rel = spec.replace(/^@shared\//, "");
  const base = path.join(root, "shared", rel);
  for (const ext of ["", ".ts", ".tsx", ".js"]) {
    const candidate = ext ? `${base}${ext}` : base;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return `${base}.ts`;
}

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(root, "server/vercelHandler.ts")],
  outfile: path.join(root, "api/_app.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  external: ["vite", "vite.config", "../../vite.config"],
  logLevel: "info",
  plugins: [
    {
      name: "alias-shared",
      setup(build) {
        build.onResolve({ filter: /^@shared\// }, (args) => ({
          path: resolveShared(args.path),
        }));
      },
    },
  ],
});
