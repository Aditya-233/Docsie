import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const outDir = path.join(projectRoot, "out");
const publicDir = path.join(projectRoot, "public");

if (fs.existsSync(outDir)) {
  // Ensure 404.html is properly placed in out/
  const public404 = path.join(publicDir, "404.html");
  const out404 = path.join(outDir, "404.html");
  if (fs.existsSync(public404)) {
    fs.copyFileSync(public404, out404);
    console.log("✓ Copied public/404.html to out/404.html for GitHub Pages SPA routing");
  }

  // Ensure .nojekyll is properly placed in out/
  const publicNoJekyll = path.join(publicDir, ".nojekyll");
  const outNoJekyll = path.join(outDir, ".nojekyll");
  if (fs.existsSync(publicNoJekyll)) {
    fs.copyFileSync(publicNoJekyll, outNoJekyll);
    console.log("✓ Copied public/.nojekyll to out/.nojekyll for GitHub Pages asset resolution");
  }
}
