import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const PROPERTY = "herzenco";
const SITE_URL = (() => {
  const url = new URL(process.env.SITE_URL || "https://www.herzenco.co");
  if (url.hostname === "herzenco.co") url.hostname = "www.herzenco.co";
  return url.href.replace(/\/$/, "");
})();
const MANIFEST = ".occ-content-manifest.json";
const RESOURCE_START = "<!-- OCC_RESOURCES_START -->";
const RESOURCE_END = "<!-- OCC_RESOURCES_END -->";
const SITEMAP_START = "<!-- OCC_RESOURCES_SITEMAP_START -->";
const SITEMAP_END = "<!-- OCC_RESOURCES_SITEMAP_END -->";

const sanitizer = {
  allowedTags: ["p", "br", "strong", "em", "s", "blockquote", "ul", "ol", "li", "h2", "h3", "h4", "h5", "h6", "a", "code", "pre", "hr", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td"],
  allowedAttributes: { a: ["href", "title"], img: ["src", "alt", "title", "width", "height", "loading"], th: ["scope"], td: ["colspan", "rowspan"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: (_tag, attrs) => ({ tagName: "a", attribs: { ...attrs, ...(attrs.href?.startsWith("http") ? { rel: "noopener noreferrer" } : {}) } }),
    img: (_tag, attrs) => ({ tagName: "img", attribs: { ...attrs, loading: "lazy" } }),
  },
};

export function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function sanitizeMarkdown(value = "") {
  return sanitizeHtml(marked.parse(String(value), { async: false, gfm: true }), sanitizer);
}

function isoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid publication date: ${value || "(missing)"}`);
  return date.toISOString();
}

function displayDate(value) {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function mediaUrl(value = "") {
  const url = String(value).trim();
  return /^(https?:\/\/|\/(?!\/))/i.test(url) ? url : "";
}

export function normalizePublishedItems(payload) {
  const items = Array.isArray(payload) ? payload : payload?.data;
  if (!Array.isArray(items)) throw new Error("OCC content response must contain a data array");
  return items.map((item) => {
    const slug = String(item?.slug || "");
    if (item?.property !== PROPERTY) throw new Error("OCC returned content outside the Herzen Co. public property");
    if (item?.status !== "published") throw new Error("OCC returned content outside the requested published set");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Invalid content slug: ${slug || "(missing)"}`);
    const title = String(item.title || "").trim();
    const excerpt = String(item.excerpt || item.meta_description || item.brief || "").trim();
    const body = String(item.body || "").trim();
    if (!item.id || !title || !excerpt || !body) throw new Error(`Published item "${slug}" is missing a required field`);
    const publishedAt = isoDate(item.published_at || item.publish_at);
    const updatedAt = isoDate(item.updated_at || item.published_at || item.publish_at);
    const heroImage = item.hero_image && typeof item.hero_image === "object" && !Array.isArray(item.hero_image) ? item.hero_image : {};
    return {
      id: String(item.id), slug, title, excerpt, body, publishedAt, updatedAt,
      seoTitle: String(item.seo_title || item.seo?.title || title).trim(),
      seoDescription: String(item.meta_description || item.seo?.description || excerpt).trim(),
      heroImageUrl: mediaUrl(heroImage.url),
      heroImageAlt: String(heroImage.alt || "").trim(),
      canonicalUrl: String(item.final_url || item.canonical_url || `${SITE_URL}/resources/${slug}/`).trim(),
      author: String(item.author || "Herzen Co.").trim(),
      category: String(item.category || "Resources").trim(),
    };
  }).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function replaceSection(source, start, end, replacement) {
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!pattern.test(source)) throw new Error(`Missing generated-content markers: ${start}`);
  return source.replace(pattern, `${start}\n${replacement}\n      ${end}`);
}

function resourceCards(items) {
  if (!items.length) return '      <div class="resources-empty"><p>No resources published yet.</p></div>';
  const cards = items.map((item, index) => `        <article class="article-card">
          <span class="article-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
          <div class="article-meta"><span>${escapeHtml(item.category)}</span><time datetime="${item.publishedAt}">${displayDate(item.publishedAt)}</time></div>
          <h3><a href="/resources/${item.slug}/">${escapeHtml(item.title)}</a></h3>
          <p>${escapeHtml(item.excerpt)}</p>
          <a class="story-link" href="/resources/${item.slug}/">Read article <span aria-hidden="true">→</span></a>
        </article>`).join("\n");
  return `      <div class="article-grid">\n${cards}\n      </div>`;
}

function siteChrome(template) {
  const header = template.match(/(<header class="site-header">[\s\S]*?<\/header>)/i)?.[1];
  const footer = template.match(/(<footer class="site-footer">[\s\S]*?<\/footer>)/i)?.[1];
  const trackingHead = template.match(/<head>([\s\S]*?)<meta charset=/i)?.[1] || "";
  const fontLinks = (template.match(/<link rel="preconnect"[\s\S]*?<noscript><link rel="stylesheet"[\s\S]*?<\/noscript>/i) || [""])[0];
  const bodyTracking = template.match(/<body>([\s\S]*?)<a class="skip-link"/i)?.[1] || "";
  if (!header || !footer) throw new Error("Could not extract shared site chrome from resources/index.html");
  return { header, footer, trackingHead, fontLinks, bodyTracking };
}

function articleHtml(item, chrome) {
  let canonical = `${SITE_URL}/resources/${item.slug}/`;
  try {
    const candidate = new URL(item.canonicalUrl);
    if (candidate.origin === new URL(SITE_URL).origin) canonical = candidate.href;
  } catch {
    // Use the local canonical URL when OCC returns a malformed or external value.
  }
  const imageMeta = item.heroImageUrl ? `\n    <meta property="og:image" content="${escapeHtml(item.heroImageUrl)}">` : "";
  const hero = item.heroImageUrl ? `<figure class="content-hero-image"><img src="${escapeHtml(item.heroImageUrl)}" alt="${escapeHtml(item.heroImageAlt || item.title)}" loading="lazy"></figure>` : "";
  const schema = JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: item.title, description: item.seoDescription, datePublished: item.publishedAt, dateModified: item.updatedAt, mainEntityOfPage: canonical, url: canonical, author: { "@type": "Organization", name: item.author }, publisher: { "@type": "Organization", name: "Herzen Co.", url: SITE_URL }, ...(item.heroImageUrl ? { image: item.heroImageUrl } : {}) }).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="en">
  <head>
    ${chrome.trackingHead.trim()}
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(item.seoTitle)}</title>
    <meta name="description" content="${escapeHtml(item.seoDescription)}">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:title" content="${escapeHtml(item.seoTitle)}">
    <meta property="og:description" content="${escapeHtml(item.seoDescription)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${escapeHtml(canonical)}">${imageMeta}
    <meta name="twitter:card" content="${item.heroImageUrl ? "summary_large_image" : "summary"}">
    <link rel="icon" href="/assets/brand/icon.png" type="image/png">
    ${chrome.fontLinks}
    <link rel="stylesheet" href="/assets/css/styles.css?v=20260814occ1">
    <script type="application/ld+json">${schema}</script>
  </head>
  <body>
    ${chrome.bodyTracking.trim()}
    <a class="skip-link" href="#main">Skip to content</a>
    ${chrome.header}
    <main id="main"><article class="content-article">
      <header class="content-article-header"><div class="container container-narrow"><p class="eyebrow">${escapeHtml(item.category)}</p><h1>${escapeHtml(item.title)}</h1><p class="content-excerpt">${escapeHtml(item.excerpt)}</p><div class="content-dates"><span>Published <time datetime="${item.publishedAt}">${displayDate(item.publishedAt)}</time></span><span>Updated <time datetime="${item.updatedAt}">${displayDate(item.updatedAt)}</time></span></div></div></header>
      <div class="container container-narrow">${hero}<div class="prose">${sanitizeMarkdown(item.body)}</div><footer class="content-article-footer"><a class="story-link" href="/resources/">← All resources</a></footer></div>
    </article></main>
    ${chrome.footer}
    <script src="/assets/js/main.js?v=20260804gtm2"></script>
  </body>
</html>\n`;
}

export async function fetchPublishedContent({ apiUrl, token, fetchImpl = fetch }) {
  if (!apiUrl || !token) throw new Error("OCC_CONTENT_API_URL and OCC_CONTENT_API_TOKEN are required");
  const endpoint = new URL(apiUrl);
  endpoint.searchParams.set("property", PROPERTY);
  endpoint.searchParams.set("status", "published");
  const response = await fetchImpl(endpoint, { headers: { accept: "application/json", authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`OCC content request failed (${response.status} ${response.statusText || ""})`.trim());
  return normalizePublishedItems(await response.json());
}

async function previousSlugs(rootDir) {
  try { return JSON.parse(await fs.readFile(path.join(rootDir, MANIFEST), "utf8")).slugs || []; } catch { return []; }
}

export async function generateContent({ rootDir = process.cwd(), items }) {
  const resourcesPath = path.join(rootDir, "resources", "index.html");
  const template = await fs.readFile(resourcesPath, "utf8");
  const chrome = siteChrome(template);
  for (const slug of await previousSlugs(rootDir)) {
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) await fs.rm(path.join(rootDir, "resources", slug), { recursive: true, force: true });
  }
  for (const item of items) {
    const articleDir = path.join(rootDir, "resources", item.slug);
    await fs.mkdir(articleDir, { recursive: true });
    await fs.writeFile(path.join(articleDir, "index.html"), articleHtml(item, chrome));
  }
  await fs.writeFile(resourcesPath, replaceSection(template, RESOURCE_START, RESOURCE_END, resourceCards(items)));
  const sitemapPath = path.join(rootDir, "sitemap.xml");
  const sitemap = await fs.readFile(sitemapPath, "utf8");
  const entries = items.map((item) => `  <url><loc>${SITE_URL}/resources/${escapeHtml(item.slug)}/</loc><lastmod>${item.updatedAt.slice(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join("\n");
  await fs.writeFile(sitemapPath, replaceSection(sitemap, SITEMAP_START, SITEMAP_END, entries));
  await fs.writeFile(path.join(rootDir, MANIFEST), `${JSON.stringify({ slugs: items.map((item) => item.slug) }, null, 2)}\n`);
}

export async function syncContent(options = {}) {
  const items = await fetchPublishedContent({ apiUrl: options.apiUrl ?? process.env.OCC_CONTENT_API_URL, token: options.token ?? process.env.OCC_CONTENT_API_TOKEN, fetchImpl: options.fetchImpl });
  await generateContent({ rootDir: options.rootDir, items });
  return items;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) syncContent().then((items) => console.log(`Generated ${items.length} OCC resource article(s).`)).catch((error) => { console.error(`OCC content sync failed: ${error.message}`); process.exitCode = 1; });
