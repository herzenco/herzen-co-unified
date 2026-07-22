import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  generateContent,
  normalizePublishedItems,
  sanitizeMarkdown,
  syncContent,
  updateSitemapXml,
} from "../scripts/sync-content.mjs";
import publishHandler from "../api/publish.mjs";

const published = {
  slug: "clearer-product-roadmaps",
  title: "Clearer Product Roadmaps",
  property: "herzenco",
  status: "published",
  excerpt: "A practical approach to roadmap decisions for teams balancing evidence, risk, and delivery.",
  body: "## Start with the decision\n\nUse **evidence** before adding more work.",
  publishedAt: "2026-07-20T12:00:00.000Z",
  updatedAt: "2026-07-21T12:00:00.000Z",
  metaTitle: "Clearer Product Roadmaps | Herzen Co.",
  metaDescription: "Learn a practical approach to clearer product roadmap decisions from Herzen Co.",
  heroImageUrl: "https://images.example.com/roadmap.jpg",
  heroImageAlt: "A product roadmap workshop",
};

async function fixtureRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "herzen-content-"));
  await fs.mkdir(path.join(root, "resources"), { recursive: true });
  await fs.copyFile(path.resolve("resources/index.html"), path.join(root, "resources/index.html"));
  await fs.copyFile(path.resolve("sitemap.xml"), path.join(root, "sitemap.xml"));
  return root;
}

test("published content generates an index and article with metadata", async () => {
  const root = await fixtureRoot();
  const items = normalizePublishedItems({ items: [published] });
  await generateContent({ rootDir: root, items });
  const index = await fs.readFile(path.join(root, "content/index.html"), "utf8");
  const article = await fs.readFile(path.join(root, "content/clearer-product-roadmaps/index.html"), "utf8");
  const resources = await fs.readFile(path.join(root, "resources/index.html"), "utf8");
  assert.match(index, /Clearer Product Roadmaps/);
  assert.match(article, /<h1>Clearer Product Roadmaps<\/h1>/);
  assert.match(article, /Published <time/);
  assert.match(article, /Updated <time/);
  assert.match(article, /rel="canonical" href="https:\/\/herzenco\.com\/content\/clearer-product-roadmaps\//);
  assert.match(article, /application\/ld\+json/);
  assert.match(article, /A product roadmap workshop/);
  assert.match(resources, /href="\/content\/clearer-product-roadmaps\//);
  assert.match(resources, /Clearer Product Roadmaps/);
});

test("unpublished and other-property content is excluded", () => {
  const items = normalizePublishedItems({
    data: [
      published,
      { ...published, slug: "draft-item", status: "drafting" },
      { ...published, slug: "scheduled-item", status: "scheduled" },
      { ...published, slug: "review-item", status: "needs_review" },
      { ...published, slug: "rejected-item", status: "rejected" },
      { ...published, slug: "failed-item", status: "failed" },
      { ...published, slug: "other-property", property: "another-site" },
    ],
  });
  assert.deepEqual(items.map((item) => item.slug), ["clearer-product-roadmaps"]);
});

test("Markdown output is sanitized against script injection", () => {
  const html = sanitizeMarkdown("## Safe\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n<img src=x onerror=alert(1)>");
  assert.doesNotMatch(html, /<script|onerror|javascript:/i);
  assert.match(html, /<h2>Safe<\/h2>/);
});

test("sitemap includes published URLs and removes stale generated URLs", () => {
  const input = '<?xml version="1.0"?><urlset><url><loc>https://herzenco.com/</loc></url><url><loc>https://herzenco.com/content/stale/</loc><lastmod>2020-01-01</lastmod></url></urlset>';
  const output = updateSitemapXml(input, normalizePublishedItems([published]));
  assert.match(output, /https:\/\/herzenco\.com\/content\//);
  assert.match(output, /https:\/\/herzenco\.com\/content\/clearer-product-roadmaps\//);
  assert.doesNotMatch(output, /content\/stale/);
});

test("failed Content Engine requests fail the sync without writing content", async () => {
  const root = await fixtureRoot();
  await assert.rejects(
    syncContent({
      rootDir: root,
      contentEngineUrl: "https://engine.example.com",
      fetchImpl: async () => ({ ok: false, status: 503, statusText: "Unavailable" }),
    }),
    /Content Engine request failed \(503 Unavailable\)/,
  );
  await assert.rejects(fs.access(path.join(root, "content/index.html")));
});

function mockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("publishing endpoint rejects invalid secrets", async () => {
  process.env.PUBLISH_SECRET = "correct-secret";
  process.env.DEPLOY_HOOK_URL = "https://api.vercel.com/v1/integrations/deploy/test";
  const res = mockResponse();
  await publishHandler({ method: "POST", headers: { authorization: "Bearer wrong-secret" }, body: { propertySlug: "herzenco", slug: "article-slug" } }, res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "invalid_secret" });
});

test("publishing endpoint rejects invalid property slugs", async () => {
  process.env.PUBLISH_SECRET = "correct-secret";
  process.env.DEPLOY_HOOK_URL = "https://api.vercel.com/v1/integrations/deploy/test";
  const res = mockResponse();
  await publishHandler({ method: "POST", headers: { authorization: "Bearer correct-secret" }, body: { propertySlug: "another-site", slug: "article-slug" } }, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "invalid_property_slug" });
});

test("publishing endpoint triggers the private deployment hook", async () => {
  process.env.PUBLISH_SECRET = "correct-secret";
  process.env.DEPLOY_HOOK_URL = "https://api.vercel.com/v1/integrations/deploy/test";
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true };
  };
  try {
    const res = mockResponse();
    await publishHandler({ method: "POST", headers: { authorization: "Bearer correct-secret" }, body: { propertySlug: "herzenco", slug: "article-slug" } }, res);
    assert.equal(res.statusCode, 202);
    assert.equal(request.url, process.env.DEPLOY_HOOK_URL);
    assert.equal(request.options.method, "POST");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
