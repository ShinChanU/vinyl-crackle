import { build, context } from "esbuild";
import { cpSync, mkdirSync } from "fs";

const isWatch = process.argv.includes("--watch");

const commonOptions = {
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch ? "inline" : false,
  target: "chrome120",
  format: "esm",
};

function copyStaticAssets() {
  mkdirSync("dist/popup", { recursive: true });
  cpSync("public", "dist", { recursive: true });
  cpSync("src/popup/index.html", "dist/popup/index.html");
  cpSync("src/popup/index.css", "dist/popup/index.css");
}

const entryPoints = [
  {
    ...commonOptions,
    entryPoints: ["src/content/index.ts"],
    outfile: "dist/content.js",
    format: "iife",
  },
  {
    ...commonOptions,
    entryPoints: ["src/background/index.ts"],
    outfile: "dist/service-worker.js",
  },
  {
    ...commonOptions,
    entryPoints: ["src/popup/index.ts"],
    outfile: "dist/popup/index.js",
  },
  {
    ...commonOptions,
    entryPoints: ["src/audio/crackle-processor.ts"],
    outfile: "dist/crackle-processor.js",
    format: "iife",
  },
];

async function run() {
  copyStaticAssets();

  if (isWatch) {
    const contexts = await Promise.all(entryPoints.map((ep) => context(ep)));
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log("[esbuild] watching for changes...");
  } else {
    await Promise.all(entryPoints.map((ep) => build(ep)));
    console.log("[esbuild] build complete → dist/");
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
