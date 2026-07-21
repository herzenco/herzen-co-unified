import fs from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const root = process.env.SITE_ROOT || process.cwd();
const engineUrl = (process.env.CONTENT_ENGINE_URL || "https://content.herzenco.co").replace(/\/$/, "");
const siteUrl = (process.env.SITE_URL || "https://herzenco.com").replace(/\/$/, "");
const feedUrl = `${engineUrl}/api/content?property=herzenco&status=published`;

const payload = process.env.CONTENT_FEED_FILE
  ? JSON.parse(await fs.readFile(process.env.CONTENT_FEED_FILE, "utf8"))
  : await fetchFeed(feedUrl);
const articles = Array.isArray(payload.data) ? payload.data : [];
validateArticles(articles);

const resourcesPath = path.join(root, "resources", "index.html");
const resourcesHtml = await fs.readFile(resourcesPath, "utf8");
const resourceRows = articles.map(renderResourceRow).join("");
await fs.writeFile(
  resourcesPath,
  replaceSection(resourcesHtml, "CONTENT_ENGINE", resourceRows),
);

const manifestPath = path.join(root, "resources", ".content-engine-manifest.json");
const previousSlugs = await readManifest(manifestPath);
for (const slug of previousSlugs) {
  if (!articles.some((article) => article.slug === slug)) {
    await fs.rm(path.join(root, "resources", slug), { recursive: true, force: true });
  }
}

for (const article of articles) {
  const articleDirectory = path.join(root, "resources", article.slug);
  await fs.mkdir(articleDirectory, { recursive: true });
  await fs.writeFile(path.join(articleDirectory, "index.html"), renderArticle(article));
}
await fs.writeFile(manifestPath, JSON.stringify(articles.map((article) => article.slug), null, 2));

const sitemapPath = path.join(root, "sitemap.xml");
const sitemap = await fs.readFile(sitemapPath, "utf8");
const sitemapEntries = articles.map(renderSitemapEntry).join("");
await fs.writeFile(
  sitemapPath,
  replaceSection(sitemap, "CONTENT_ENGINE_SITEMAP", sitemapEntries),
);

console.log(`Synced ${articles.length} published Herzen article${articles.length === 1 ? "" : "s"}.`);

async function fetchFeed(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Content Engine returned ${response.status} for ${url}`);
  return response.json();
}

function validateArticles(items) {
  for (const article of items) {
    for (const key of ["slug", "title", "body", "excerpt", "metaTitle", "metaDescription", "publishedAt"]) {
      if (typeof article[key] !== "string" || !article[key].trim()) {
        throw new Error(`Published article is missing ${key}`);
      }
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) {
      throw new Error(`Unsafe article slug: ${article.slug}`);
    }
  }
}

function replaceSection(source, marker, content) {
  const pattern = new RegExp(`<!-- ${marker}_START -->[\\s\\S]*?<!-- ${marker}_END -->`);
  if (!pattern.test(source)) throw new Error(`Missing ${marker} markers`);
  return source.replace(pattern, `<!-- ${marker}_START -->${content}<!-- ${marker}_END -->`);
}

function renderResourceRow(article) {
  return `<div class="resource-row"><span>${escapeHtml(formatDate(article.publishedAt))}</span><div><h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.excerpt)}</p></div><a class="button tertiary" href="/resources/${escapeAttribute(article.slug)}/">Read article</a></div>`;
}

function renderArticle(article) {
  const canonical = `${siteUrl}/resources/${article.slug}/`;
  const safeBody = sanitizeHtml(marked.parse(article.body), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
    allowedAttributes: { a: ["href", "title"], img: ["src", "alt", "title", "loading"] },
    allowedSchemes: ["http", "https", "mailto"],
  });
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.metaDescription,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    mainEntityOfPage: canonical,
    publisher: { "@type": "Organization", name: "Herzen Co.", url: siteUrl },
    ...(article.heroImageUrl ? { image: article.heroImageUrl } : {}),
  };
  const hero = article.heroImageUrl
    ? `<figure><img src="${escapeAttribute(article.heroImageUrl)}" alt="${escapeAttribute(article.heroImageAlt || article.title)}" loading="eager"></figure>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(article.metaTitle)}</title><meta name="description" content="${escapeAttribute(article.metaDescription)}"><link rel="canonical" href="${escapeAttribute(canonical)}">
<meta property="og:title" content="${escapeAttribute(article.metaTitle)}"><meta property="og:description" content="${escapeAttribute(article.metaDescription)}"><meta property="og:type" content="article"><meta property="og:url" content="${escapeAttribute(canonical)}">${article.heroImageUrl ? `<meta property="og:image" content="${escapeAttribute(article.heroImageUrl)}">` : ""}
<meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/css/styles.css?v=20260701"><script type="application/ld+json">${safeJson(jsonLd)}</script></head>
<body><a class="skip-link" href="#main">Skip to content</a>${siteHeader()}
<main id="main"><article class="article-shell"><header class="article-header"><p class="eyebrow">Herzen Co. resource</p><h1>${escapeHtml(article.title)}</h1><p class="lead">${escapeHtml(article.excerpt)}</p><p class="article-meta">Published ${escapeHtml(formatDate(article.publishedAt))}</p></header>${hero}<div class="article-body">${safeBody}</div></article></main>
${siteFooter()}<script src="/assets/js/main.js"></script></body></html>`;
}

function siteHeader() {
  return `<header class="site-header"><nav class="nav" aria-label="Main navigation"><a class="brand" href="/"><span class="brand-mark">HC</span>Herzen Co.</a><button class="nav-toggle" type="button" data-nav-toggle aria-label="Menu" aria-expanded="false">&#9776;</button><div class="nav-links" data-nav-links><a href="/product-leadership/">Product Leadership</a><a href="/custom-builds/">Custom Builds</a><a href="/pricing/">Pricing</a><a href="/resources/">Resources</a><a class="button" href="/contact/">Start a conversation</a></div></nav></header>`;
}

function siteFooter() {
  return `<footer class="site-footer"><div class="footer-grid"><div><a class="brand" href="/"><span class="brand-mark">HC</span>Herzen Co.</a><p>Product leadership first, with build and project support for teams that need clarity and momentum.</p></div><div class="footer-col"><strong>Services</strong><a href="/product-leadership/">Product Leadership</a><a href="/custom-builds/">Custom Builds</a></div><div class="footer-col"><strong>Company</strong><a href="/about/">About</a><a href="/process/">Process</a><a href="/contact/">Contact</a></div><div class="footer-col"><strong>Resources</strong><a href="/resources/">Resources</a><a href="/faq/">FAQ</a><a href="/pricing/">Pricing</a></div></div><p class="legal">&copy; 2026 Herzen Co. All rights reserved.</p></footer>`;
}

function renderSitemapEntry(article) {
  return `\n  <url><loc>${escapeHtml(siteUrl)}/resources/${escapeHtml(article.slug)}/</loc><lastmod>${escapeHtml(article.updatedAt || article.publishedAt)}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(value));
}

async function readManifest(filePath) {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}
