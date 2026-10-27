import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const pages = [
  "index.html",
  "product-leadership/index.html",
  "custom-builds/index.html",
  "pricing/index.html",
  "privacy-policy/index.html",
  "process/index.html",
  "terms-and-conditions/index.html",
  "resources/index.html",
  "faq/index.html",
  "FreeDeliveryMap/index.html",
  "free-delivery-map/index.html",
  "glossary/index.html",
  "meeting-booked/index.html",
  "about/index.html",
  "contact/index.html",
];

const requiredFiles = [
  ...pages,
  "404.html",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "site.webmanifest",
  "vercel.json",
  "assets/css/styles.css",
  "assets/js/main.js",
  "assets/img/founder-working.jpeg",
  "assets/img/founder-working-mobile.jpeg",
  "assets/img/founder-seated.jpeg",
  "assets/img/founder-portrait.jpeg",
  "assets/brand/logo-1a-black.png",
  "assets/brand/logo-1a-white.png",
  "assets/brand/logo-1e-black.png",
  "assets/brand/logo-1e-white.png",
  "assets/brand/mark-h-black.png",
  "assets/brand/mark-h-white.png",
  "assets/brand/wordmark-black.png",
  "assets/brand/wordmark-white.png",
  "assets/brand/icon.png",
  "assets/brand/icon-mark.png",
  "assets/brand/logo-black.png",
  "assets/brand/logo-white.png",
  "docs/design-system/Herzen-Co-logo-system.pdf",
  "docs/design-system/Logos-Herzen-Co.zip",
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
];

const campaignPages = ["FreeDeliveryMap/index.html", "free-delivery-map/index.html"];

const bookingUrl = "https://calendly.com/herzenco/herzen-co-intro-call";
const campaignHrefs = new Set([
  "/",
  "#main",
  bookingUrl,
  "/privacy-policy/",
  "/terms-and-conditions/",
]);

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
      if (entry.name === ".vercel" || entry.name === "content" || entry.name === "docs" || entry.name === "tests" || entry.name === "node_modules" || entry.name === "public") continue;
      out.push(...walk(full));
    } else if (publicExtensions.has(path.extname(entry.name))) {
      out.push(path.relative(root, full));
    }
  }
  return out;
}

function authoredContents(file) {
  return read(file);
}

const staleEmail = ["hello@", "herzenco", ".com"].join("");

function walkRepo(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "public" || entry.name === ".vercel") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkRepo(full));
    else out.push(path.relative(root, full));
  }
  return out;
}

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(root, file)), `Missing required file: ${file}`);
}

for (const page of pages) {
  const html = read(page);
  const isCampaignPage = campaignPages.includes(page);
  assert(/<title>[^<]{15,70}<\/title>/i.test(html), `${page} needs a focused title tag`);
  assert(/<meta name="description" content="[^"]{50,170}"/i.test(html), `${page} needs a meta description`);
  assert(/<link rel="canonical" href="https:\/\/www\.herzenco\.co\/[^"]*"/i.test(html), `${page} needs a www canonical URL`);
  assert(/\/assets\/css\/styles\.css\?v=\d+[a-z0-9]*/i.test(html), `${page} should load a versioned shared stylesheet`);
  assert(html.includes('/assets/brand/logo-1a-black.png'), `${page} should use the approved primary logo in the header`);
  assert(html.includes('/assets/brand/logo-1a-white.png'), `${page} should use the approved reversed logo in the footer`);
  assert(!html.includes('/assets/brand/logo-black.png'), `${page} should not render the vertical black lockup`);
  assert(!html.includes('/assets/brand/logo-white.png'), `${page} should not render the vertical white lockup`);
  assert(html.includes('/assets/brand/icon.png'), `${page} should use the official icon export as the favicon`);
  assert(html.includes('/assets/js/main.js'), `${page} should load the shared site script`);
  assert(/<meta property="og:title" content="[^"]+"/i.test(html), `${page} needs OG title`);
  assert(/<meta property="og:description" content="[^"]+"/i.test(html), `${page} needs OG description`);
  assert(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i.test(html), `${page} needs JSON-LD`);
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  assert(h1Count === 1, `${page} should have exactly one H1, found ${h1Count}`);
  if (isCampaignPage) {
    const hrefs = [...html.matchAll(/<a\b[^>]*href="([^"]+)"/gi)].map((match) => match[1]);
    assert(!/<nav\b/i.test(html), `${page} should not include site navigation`);
    assert(hrefs.every((href) => campaignHrefs.has(href)), `${page} should link only to home, its skip target, Calendly, or legal pages`);
    assert(hrefs.filter((href) => href === bookingUrl).length >= 2, `${page} should repeat the sole conversion CTA`);
  } else {
    assert(/aria-controls="site-nav-links"/.test(html), `${page} menu button should identify the controlled navigation`);
    assert(/id="site-nav-links"/.test(html), `${page} navigation should have a stable controlled id`);
  }
  for (const image of html.match(/<img\b[^>]*>/gi) || []) {
    assert(/\bwidth="\d+"/.test(image), `${page} image needs an explicit width: ${image}`);
    assert(/\bheight="\d+"/.test(image), `${page} image needs an explicit height: ${image}`);
  }
}

const publicFiles = walk(root);
for (const file of publicFiles) {
  const contents = authoredContents(file);
  for (const term of legacyTerms) {
    const pattern = new RegExp(term, "i");
    assert(!pattern.test(contents), `Legacy name found in ${file}: ${pattern}`);
  }

  for (const term of retiredWebsiteOfferTerms) {
    assert(!contents.includes(term), `Retired website offer found in ${file}: ${term}`);
  }

  assert(!contents.includes("https://herzenco.com"), `Incorrect .com domain found in ${file}`);
  assert(!contents.includes("https://herzenco.co"), `Non-www website URL found in ${file}`);
  assert(!contents.includes("xyren-discover"), `Legacy Calendly slug found in ${file}`);
  assert(!contents.includes(staleEmail), `Stale email domain found in ${file}`);
}

const vercelConfig = JSON.parse(read("vercel.json"));
assert(
  vercelConfig.redirects?.some((redirect) =>
    redirect.source === "/:path*" &&
    redirect.destination === "https://www.herzenco.co/:path*" &&
    redirect.permanent === true &&
    redirect.has?.some((condition) => condition.type === "host" && condition.value === "herzenco.co")
  ),
  "Vercel should permanently redirect the apex host to www while preserving the path"
);

const notFoundPage = read("404.html");
assert(/<meta name="robots" content="noindex">/.test(notFoundPage), "404 page should not be indexed");
assert(/Return home/.test(notFoundPage), "404 page should provide a clear recovery path");

const homepage = read("index.html");
const packageJson = JSON.parse(read("package.json"));
const siteScript = read("assets/js/main.js");
const siteStyles = read("assets/css/styles.css");
assert(/--paper-50:\s*#f5efe4/i.test(siteStyles), "Design system should use the warm paper token");
assert(/--ink-900:\s*#1c1813/i.test(siteStyles), "Design system should use the warm ink token");
assert(/--clay-500:\s*#9c5c3e/i.test(siteStyles), "Design system should use the clay accent token");
assert(/Newsreader/.test(siteStyles) && /Jost/.test(siteStyles), "Design system should load the editorial font pairing");
assert(/Embedded execution partner/i.test(homepage), "Homepage should lead with embedded execution positioning");
assert(!/Answering the questions buyers ask first/i.test(homepage), "Homepage should not use generic buyer-question section framing");
assert(/<title>Fractional Product Leadership for Founders \| Herzen Co\.<\/title>/.test(homepage), "Homepage title should describe fractional product leadership");
assert(/property="og:title" content="Fractional Product Leadership for Founders \| Herzen Co\."/.test(homepage), "Homepage social title should match the document title");
assert(/\$2,000\/month/.test(homepage), "Homepage description should include the monthly starting price");
assert(/Custom <span>scope<\/span>/.test(homepage), "Custom scope price should keep a space for copy and paste");
assert(/"contactType": "sales"/.test(homepage), "Homepage organization schema should include a sales contact point");
assert(/<a class="button" href="\/contact\/">Start a conversation<\/a>/.test(homepage), "Homepage primary CTA should set an accurate contact expectation");
assert(/class="hero-actions button-row"[\s\S]*class="button button-ghost" href="https:\/\/calendly\.com\/herzenco\/herzen-co-intro-call">Book a call<\/a>/.test(homepage), "Homepage hero should offer a direct booking link");
assert(homepage.includes(bookingUrl), "Homepage closing band should offer direct booking");
assert(/mailto:hello@herzenco\.co/.test(homepage), "Homepage should offer a direct email link");
assert(!/See the primary offer/.test(homepage), "Homepage CTA should be concise and lead-focused");
assert(/editorial-hero-media/.test(homepage), "Homepage hero image should use the editorial image wrapper");
assert(/editorial-hero-media img[\s\S]*height: auto/.test(siteStyles), "Homepage hero image should not use fixed-height letterboxing");
assert(packageJson.dependencies["@vercel/analytics"], "Site should include the Vercel Analytics package");
assert(/\/_vercel\/insights\/script\.js/.test(siteScript), "Shared script should load Vercel Web Analytics");
assert(/@vercel\/analytics/.test(siteScript), "Shared script should identify the Vercel Analytics SDK");
assert(/Lead CTA Clicked/.test(siteScript), "Shared script should track lead CTA clicks");
for (const page of [...pages, "404.html"]) {
  const html = read(page);
  assert(!/googletagmanager\.com\/gtm\.js/.test(html), `${page} should not install GTM inline`);
  assert(!/googletagmanager\.com\/ns\.html\?id=GTM-K9SZRQ94/.test(html), `${page} should not install the GTM noscript fallback`);
  assert(!/googletagmanager\.com\/gtag\/js/.test(html), `${page} should not load the Google Ads tag inline`);
  assert(!/gtag\('config', 'AW-11011556680'\)/.test(html), `${page} should not configure Google Ads inline`);
  assert(/data-privacy-choices/.test(html), `${page} should offer a privacy choices control`);
}
assert(/createPrivacyControls\(/.test(siteScript), "Shared script should gate analytics and advertising behind privacy choices");
assert(/herzen_privacy_preferences/.test(siteScript), "Privacy choices should persist in local storage");
assert(/GTM-K9SZRQ94/.test(siteScript), "Consented advertising should load Google Tag Manager GTM-K9SZRQ94");
assert(/AW-11011556680/.test(siteScript), "Consented advertising should load Google Ads AW-11011556680");
assert(/if \(preferences\.analytics\) \{\s*initializeMixpanel\(\)/.test(siteScript), "Mixpanel should load only after analytics consent");
assert(/loadVercelAnalytics\(\)/.test(siteScript), "Vercel Web Analytics should remain available after analytics consent");
assert(/if \(preferences\.advertising\) \{\s*loadGoogleTracking\(\)/.test(siteScript), "Google tags should load only after advertising consent");
assert(/a\[href\^="https:\/\/calendly\.com\/herzenco\/"\]/.test(siteScript), "Lead CTA tracking should include Herzen Co. Calendly links");
assert(/startsWith\("\/freedeliverymap"\)/.test(siteScript) && /startsWith\("\/free-delivery-map"\)/.test(siteScript), "Campaign page type should include both delivery-map paths");
assert(!/xyren-discover/.test(siteScript), "Lead CTA tracking should not use the legacy Calendly slug");
assert(/page_viewed/.test(siteScript), "Mixpanel should track page views");
assert(/scroll_depth_reached/.test(siteScript), "Mixpanel should track scroll depth");
assert(/page_engagement_completed/.test(siteScript), "Mixpanel should track active page engagement");
assert(/active_time_reached/.test(siteScript), "Mixpanel should track active-time milestones");
assert(/resource_read_completed/.test(siteScript), "Mixpanel should track completed resource reads");
assert(/resource_opened/.test(siteScript), "Mixpanel should track resource article opens");
assert(/navigation_clicked/.test(siteScript), "Mixpanel should track header and footer navigation");
assert(/outbound_link_clicked/.test(siteScript), "Mixpanel should track outbound link clicks");
assert(/mobile_menu_toggled/.test(siteScript), "Mixpanel should track mobile menu use");
assert(/inquiry_started/.test(siteScript), "Mixpanel should track inquiry starts");
assert(/lead_cta_clicked/.test(siteScript), "Mixpanel should track lead CTA clicks");
assert(/inquiry_submitted/.test(siteScript), "Mixpanel should track inquiry submissions");
assert(!/mixpanel\.track\([^)]*(?:email|message|full_name)/is.test(siteScript), "Mixpanel calls should not include direct form PII");
const preparePublic = read("scripts/prepare-public.mjs");
assert(/MIXPANEL_PRODUCTION_TOKEN/.test(preparePublic), "Production Mixpanel token should come from the build environment");
assert(/MIXPANEL_DEVELOPMENT_TOKEN/.test(preparePublic), "Development Mixpanel token should come from the build environment");
assert(/founder-working\.jpeg/.test(homepage), "Homepage should use the founder working portrait");
assert(/founder-working-mobile\.jpeg/.test(homepage), "Homepage should provide an optimized mobile hero image");
assert(/fetchpriority="high"/.test(homepage), "Homepage should prioritize its LCP image");
assert(/media="print" onload="this\.media=\x27all\x27"/.test(homepage), "Web fonts should not block first render");
assert(/Escape/.test(siteScript) && /menu-open/.test(siteScript), "Mobile navigation should close accessibly and manage page scroll");
assert(/@media \(max-width: 560px\)/.test(siteStyles), "Styles should include a narrow mobile layout");
const glossaryPage = read("glossary/index.html");
assert(/DefinedTermSet/.test(glossaryPage), "Glossary should expose DefinedTermSet schema");
assert(/Fractional product leadership/.test(glossaryPage), "Glossary should define the primary service term");
assert(/founder-portrait\.jpeg/.test(read("about/index.html")), "About page should use the founder portrait");
assert(/founder-seated\.jpeg/.test(read("contact/index.html")), "Contact page should use the seated founder portrait");

const resourcesPage = read("resources/index.html");
assert(/class="[^"]*resources-masthead/.test(resourcesPage), "Resources should retain the publishing masthead");
assert(!/What is fractional product leadership\?/.test(resourcesPage), "Resources should not contain hardcoded editorial articles");
assert(!/class="resource-row"/.test(resourcesPage), "Resources should not use the old utility-list layout");
assert(/OCC_RESOURCES_START[\s\S]*OCC_RESOURCES_END/.test(resourcesPage), "Resources should retain its OCC-managed publishing region");
assert(/No resources published yet\.|class="article-grid"/.test(resourcesPage), "Resources should show either the empty state or OCC-generated article cards");
assert(resourcesPage.includes(bookingUrl), "Shared footer should offer direct booking");
assert(/mailto:hello@herzenco\.co/.test(resourcesPage), "Shared footer should offer the public email address");

const contactPage = read("contact/index.html");
const contactMain = contactPage.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
assert(/action="\/api\/inquiry"/.test(contactPage), "Contact form should submit through the website inquiry endpoint");
assert(/data-form-status/.test(contactPage), "Contact form should provide an accessible submission status");
assert(/name="website"/.test(contactPage), "Contact form should include a spam honeypot");
assert(/<a href="mailto:hello@herzenco\.co">hello@herzenco\.co<\/a>/.test(contactMain), "Contact page should show a direct email address beside scheduling");
assert(/Schedule a call/.test(contactMain), "Contact page should keep direct call scheduling next to the form");
assert(/hello@herzenco\.co/.test(contactPage), "Contact metadata should use the correct Herzen Co. email address");
assert(!/hello@herzenco\.com/.test(contactPage), "Contact page should not use the old email domain");
assert(/fetch\("\/api\/inquiry"/.test(siteScript), "Contact form should send JSON to the website inquiry API");
assert(/response\.ok/.test(siteScript), "Contact form should confirm delivery before tracking success");
assert(contactPage.includes(bookingUrl), "Contact page should offer direct call scheduling");

for (const campaignPage of campaignPages) {
  assert(/class="campaign-page delivery-map-page"/.test(read(campaignPage)), `${campaignPage} should use the campaign design-system surface`);
}
assert(/\.delivery-hero[\s\S]*var\(--container-max\)/.test(siteStyles), "Delivery Map hero should use the shared container width token");
assert(/\.delivery-outcomes[\s\S]*var\(--container-max\)/.test(siteStyles), "Delivery Map sections should use the shared container width token");
assert(/\.delivery-map-card[\s\S]*border: 1px solid var\(--border-hairline\)/.test(siteStyles), "Delivery Map card should use the shared hairline border");
assert(/\.campaign-header \.brand-logo[\s\S]*height: 34px/.test(siteStyles), "Campaign header should use the approved 34px horizontal logo treatment");
assert(!/\.delivery-close[^}]*background: var\(--coral\)/.test(siteStyles), "Delivery Map close should not use an off-pattern clay color block");

const adLandingPage = read("free-delivery-map/index.html");
assert(/<link rel="canonical" href="https:\/\/www\.herzenco\.co\/free-delivery-map\/">/.test(adLandingPage), "Ad landing page must self-canonicalize to the lowercase campaign path");
assert(/<meta property="og:url" content="https:\/\/www\.herzenco\.co\/free-delivery-map\/">/.test(adLandingPage), "Ad landing page og:url must match the ad final URL");
assert(adLandingPage.includes(bookingUrl), "Ad landing page must use the current booking destination");
assert(!/xyren-discover/.test(adLandingPage), "Ad landing page must not use the legacy booking slug");
for (const campaignPage of campaignPages) {
  assert(/<meta name="robots" content="noindex, follow">/.test(read(campaignPage)), `${campaignPage} should stay available without being indexed`);
}
const sitemapXml = read("sitemap.xml");
assert(!sitemapXml.includes("https://www.herzenco.co/free-delivery-map/"), "Sitemap should omit the mismatched free-delivery-map slug");
assert(!sitemapXml.includes("https://www.herzenco.co/FreeDeliveryMap/"), "Sitemap should not list the superseded campaign path");
assert(sitemapXml.includes("https://www.herzenco.co/privacy-policy/"), "Sitemap should list the privacy policy");
assert(sitemapXml.includes("https://www.herzenco.co/terms-and-conditions/"), "Sitemap should list the terms and conditions");
const robotsTxt = read("robots.txt");
assert(/User-agent: AdsBot-Google\nAllow: \//.test(robotsTxt), "robots.txt should explicitly allow AdsBot-Google");
assert(/User-agent: AdsBot-Google-Mobile\nAllow: \//.test(robotsTxt), "robots.txt should explicitly allow AdsBot-Google-Mobile");

const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".zip", ".woff", ".woff2", ".ico"]);
for (const file of walkRepo(root)) {
  if (binaryExtensions.has(path.extname(file).toLowerCase())) continue;
  assert(!read(file).includes(staleEmail), `Stale email domain found in ${file}`);
}

for (const file of publicFiles.filter((entry) => entry.endsWith(".html"))) {
  for (const image of read(file).match(/<img\b[^>]*>/gi) || []) {
    assert(/\balt="[^"]+"/.test(image) && !/\balt=""/.test(image), `${file} image needs descriptive alt text: ${image}`);
  }
}
assert(/alt="Herzen Cortes working with a product team"/.test(adLandingPage), "Delivery Map hero should describe the founder photograph");

function headingLevels(html) {
  return [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
}

for (const page of ["pricing/index.html", "process/index.html", "resources/index.html", "faq/index.html"]) {
  const levels = headingLevels(read(page));
  assert(levels[0] === 1, `${page} should start with an H1`);
  for (let index = 1; index < levels.length; index += 1) {
    assert(levels[index] <= levels[index - 1] + 1, `${page} should not skip heading levels: ${levels.join(" > ")}`);
  }
}
assert(/<h2><a href="\/resources\/\$\{item\.slug\}\/">/.test(read("scripts/sync-content.mjs")), "Generated resource cards should use H2 titles");
const articlePage = read("resources/why-content-automation-still-needs-human-approval-gates/index.html");
assert(/<meta property="og:image" content="https:\/\/www\.herzenco\.co\/assets\/img\/og-default\.jpg">/.test(articlePage), "Published resource article should include the default social image");
assert(/og-default\.jpg/.test(read("scripts/sync-content.mjs")), "Generated articles without a hero image should use the default social image");
for (const file of publicFiles.filter((entry) => entry.endsWith(".html"))) {
  assert(!read(file).includes("\u2014"), `${file} should not use an em dash`);
}

console.log(`Verified ${pages.length} pages and ${publicFiles.length} public files.`);
