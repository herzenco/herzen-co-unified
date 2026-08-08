import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "public");
const entries = [
  "404.html",
  "about",
  "assets",
  "contact",
  "custom-builds",
  "faq",
  "glossary",
  "meeting-booked",
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
  const source = path.join(root, entry);
  try {
    await fs.access(source);
    await fs.cp(source, path.join(output, entry), { recursive: true });
  } catch {
    throw new Error(`Required deployment entry is missing: ${entry}`);
  }
}

console.log(`Prepared ${entries.length} static entries in public/.`);

const analyticsEnvironment = process.env.VERCEL_ENV === "production"
  ? "production"
  : "development";
const analyticsToken = analyticsEnvironment === "production"
  ? process.env.MIXPANEL_PRODUCTION_TOKEN
  : process.env.MIXPANEL_DEVELOPMENT_TOKEN;

if (!analyticsToken) {
  throw new Error(
    `Missing Mixpanel token for ${analyticsEnvironment}. Set MIXPANEL_${analyticsEnvironment.toUpperCase()}_TOKEN.`
  );
}

const analyticsConfig = `window.HERZEN_ANALYTICS_CONFIG = Object.freeze(${JSON.stringify({
  token: analyticsToken,
  environment: analyticsEnvironment,
})});\n`;
await fs.writeFile(
  path.join(output, "assets", "js", "mixpanel-config.js"),
  analyticsConfig,
  "utf8"
);
console.log(`Prepared Mixpanel ${analyticsEnvironment} configuration.`);
