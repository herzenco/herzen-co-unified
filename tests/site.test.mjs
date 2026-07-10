import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const pages = [
  "index.html",
  "product-leadership/index.html",
  "custom-builds/index.html",
  "pricing/index.html",
  "process/index.html",
  "resources/index.html",
  "resources/product-system-audit-checklist/index.html",
  "faq/index.html",
  "about/index.html",
  "contact/index.html",
  "thank-you/index.html",
];

const requiredFiles = [
  ...pages,
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "site.webmanifest",
  "assets/css/styles.css",
  "assets/js/main.js",
  "api/leads.js",
  "assets/downloads/product-system-audit-checklist.txt",
  "assets/img/founder-working.jpeg",
  "assets/img/founder-seated.jpeg",
  "assets/img/founder-portrait.jpeg",
];

const legacyTerms = [
  ["xe", "ler", "ate"],
  ["xy", "ren"],
  ["fractional", "pm"],
].map((parts) => parts.join(""));

const retiredWebsiteOfferTerms = [
  "/conversion-websites/",
  "Conversion Websites",
  "Conversion website",
  "conversion-focused websites",
  "website support",
  "Custom Builds",
  "Custom builds",
  "custom builds",
];

const publicExtensions = new Set([
  ".html",
  ".css",
  ".js",
  ".txt",
  ".xml",
  ".webmanifest",
  ".svg",
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "docs" || entry.name === "tests" || entry.name === "node_modules") continue;
      out.push(...walk(full));
    } else if (publicExtensions.has(path.extname(entry.name))) {
      out.push(path.relative(root, full));
    }
  }
  return out;
}

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(root, file)), `Missing required file: ${file}`);
}

for (const page of pages) {
  const html = read(page);
  assert(/<title>[^<]{15,70}<\/title>/i.test(html), `${page} needs a focused title tag`);
  assert(/<meta name="description" content="[^"]{50,170}"/i.test(html), `${page} needs a meta description`);
  assert(/<link rel="canonical" href="https:\/\/herzenco\.com\/[^"]*"/i.test(html), `${page} needs canonical URL`);
  assert(html.includes('/assets/css/styles.css?v=20260702'), `${page} should load the current shared stylesheet`);
  assert(html.includes('/assets/js/main.js'), `${page} should load the shared site script`);
  assert(/<meta property="og:title" content="[^"]+"/i.test(html), `${page} needs OG title`);
  assert(/<meta property="og:description" content="[^"]+"/i.test(html), `${page} needs OG description`);
  assert(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i.test(html), `${page} needs JSON-LD`);
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  assert(h1Count === 1, `${page} should have exactly one H1, found ${h1Count}`);
}

const publicFiles = walk(root);
for (const file of publicFiles) {
  const contents = read(file);
  const legacyScanContents = contents.replaceAll("https://calendly.com/herzenco/xelerate-intro-call", "");
  for (const term of legacyTerms) {
    const pattern = new RegExp(term, "i");
    assert(!pattern.test(legacyScanContents), `Legacy name found in ${file}: ${pattern}`);
  }

  for (const term of retiredWebsiteOfferTerms) {
    assert(!contents.includes(term), `Retired website offer found in ${file}: ${term}`);
  }
}

const homepage = read("index.html");
const productLeadership = read("product-leadership/index.html");
const packageJson = JSON.parse(read("package.json"));
const siteScript = read("assets/js/main.js");
const siteStyles = read("assets/css/styles.css");
assert(/messy middle/i.test(homepage), "Homepage should use the editorial studio positioning phrase: messy middle");
assert(!/Answering the questions buyers ask first/i.test(homepage), "Homepage should not use generic buyer-question section framing");
assert(/<a class="button" href="https:\/\/calendly\.com\/herzenco\/xelerate-intro-call" data-track="book-call">Book a call<\/a>/.test(homepage), "Homepage primary CTA should route high-intent leads to Calendly");
assert(!/See the primary offer/.test(homepage), "Homepage CTA should be concise and lead-focused");
assert(/editorial-hero-media/.test(homepage), "Homepage hero image should use the editorial image wrapper");
assert(/editorial-hero-media img[\s\S]*height: auto/.test(siteStyles), "Homepage hero image should not use fixed-height letterboxing");
assert(packageJson.dependencies["@vercel/analytics"], "Site should include the Vercel Analytics package");
assert(/\/_vercel\/insights\/script\.js/.test(siteScript), "Shared script should load Vercel Web Analytics");
assert(/@vercel\/analytics/.test(siteScript), "Shared script should identify the Vercel Analytics SDK");
assert(/Lead CTA Clicked/.test(siteScript), "Shared script should track lead CTA clicks");
assert(/Book Call Clicked/.test(siteScript), "Shared script should track book-call clicks");
assert(/Lead Magnet Downloaded/.test(siteScript), "Shared script should track lead magnet submissions");
assert(/Contact Page Viewed/.test(siteScript), "Shared script should track contact-page visits");
assert(/Lead Thank You Viewed/.test(siteScript), "Shared script should track thank-you page conversions");
assert(/founder-working\.jpeg/.test(homepage), "Homepage should use the founder working portrait");
assert(/Start now/.test(productLeadership), "Product leadership primary CTA should be short");
assert(!/Start product leadership|See pricing|Best fit|Starting point/.test(productLeadership), "Product leadership page should not use retired CTA or pricing labels");
assert(/Flat subscription:[\s\S]*\$2,000\/month/.test(productLeadership), "Product leadership hero should show flat subscription pricing");
assert(/<h2>Pricing<\/h2>/.test(productLeadership), "Product leadership fit section should be renamed Pricing");
assert(/Subscription service/.test(productLeadership), "Product leadership price card should frame the service as subscription based");
assert(/Custom Solutions for heavier lifts/.test(productLeadership), "Product leadership page should point to Custom Solutions");
assert(/Explore custom solutions/.test(productLeadership), "Product leadership Custom Solutions CTA should be clear");
assert(/hero-media\.product-hero-media img\[src\*="founder"\][\s\S]*object-fit: cover/.test(siteStyles), "Product leadership hero image should fill the frame without letterboxing");
assert(/data-lead-form/.test(read("contact/index.html")), "Contact page should use the lead capture form");
assert(/data-fallback-mailto/.test(read("contact/index.html")), "Contact page should preserve email fallback until delivery is configured");
assert(/Product System Audit Checklist/.test(read("resources/product-system-audit-checklist/index.html")), "Lead magnet page should exist");
assert(/data-lead-type="lead-magnet"/.test(read("resources/product-system-audit-checklist/index.html")), "Lead magnet should use lead capture form");
assert(/Download checklist/.test(read("thank-you/index.html")), "Thank-you page should offer the checklist download");
assert(/CLICKUP_API_TOKEN/.test(read("api/leads.js")), "Lead API should support ClickUp task delivery");
assert(/CLICKUP_LIST_ID/.test(read("api/leads.js")), "Lead API should support ClickUp list routing");
assert(/RESEND_API_KEY/.test(read("api/leads.js")), "Lead API should support Resend email delivery");
assert(/LEAD_WEBHOOK_URL/.test(read("api/leads.js")), "Lead API should support webhook delivery");
assert(/founder-portrait\.jpeg/.test(read("about/index.html")), "About page should use the founder portrait");
assert(/founder-seated\.jpeg/.test(read("contact/index.html")), "Contact page should use the seated founder portrait");

console.log(`Verified ${pages.length} pages and ${publicFiles.length} public files.`);
