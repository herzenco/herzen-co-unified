import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "public");
const entries = [
  "about",
  "assets",
  "contact",
  "custom-builds",
  "faq",
  "pricing",
  "process",
  "product-leadership",
  "resources",
  "index.html",
  "llms.txt",
  "robots.txt",
  "site.webmanifest",
  "sitemap.xml",
];

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
for (const entry of entries) {
  await fs.cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}

console.log(`Prepared ${entries.length} static entries in public/.`);
