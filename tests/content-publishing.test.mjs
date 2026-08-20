import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import publishHandler, { resetPublishStateForTests } from "../api/publish.mjs";
import { fetchPublishedContent, generateContent, normalizePublishedItems, sanitizeMarkdown } from "../scripts/sync-content.mjs";

const publication = {
  schema_version: 1,
  content_item_id: "22222222-2222-4222-8222-222222222222",
  idempotency_key: "occ:22222222-2222-4222-8222-222222222222:approved-hash",
  approved_content_hash: "a".repeat(64),
  title: "Clearer Product Roadmaps",
  body: "## Start with the decision\n\nUse **evidence** before adding more work.",
  content_type: "article",
  destination: "resource_library",
  slug: "clearer-product-roadmaps",
  canonical_path: "/resources/clearer-product-roadmaps/",
  seo: { title: "Clearer Product Roadmaps | Herzen Co.", description: "A practical guide to clearer roadmap decisions.", keywords: ["roadmaps"] },
  featured_image: { url: "https://images.example.test/roadmap.jpg", alt_text: "A roadmap workshop" },
  media: [],
  author: "Herzen Co.",
  publish_date: "2026-08-14T18:00:00.000Z",
  tags: ["Operations"],
  categories: ["Operations"],
  status: "published",
  source: { system: "occ", approved_at: "2026-08-14T17:00:00.000Z", approved_by: "Reviewer" },
};

const article = {
  id: publication.content_item_id,
  property_id: "33333333-3333-4333-8333-333333333333",
  status: "published",
  slug: publication.slug,
  title: publication.title,
  brief: "A practical approach to roadmap decisions for teams balancing evidence, risk, and delivery.",
  body: publication.body,
  published_at: "2026-08-14T18:00:00.000Z",
  updated_at: "2026-08-14T18:00:00.000Z",
  seo_title: publication.seo.title,
  meta_description: publication.seo.description,
  creative_external_url: publication.featured_image.url,
  final_url: "https://herzenco.co/resources/clearer-product-roadmaps/",
  tags: publication.tags,
  metadata: { author: publication.author, categories: publication.categories, image_alt: publication.featured_image.alt_text },
};

function response() {
  return { statusCode: 200, body: null, headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function request(body = publication, secret = "test-secret") {
  return { method: "POST", headers: { authorization: `Bearer ${secret}`, "idempotency-key": body.idempotency_key }, body };
}

test.beforeEach(() => {
  resetPublishStateForTests();
  process.env.HERZENCO_PUBLISH_WEBHOOK_SECRET = "test-secret";
  process.env.VERCEL_DEPLOY_HOOK_URL = "https://api.vercel.com/v1/integrations/deploy/test";
});

test("OCC publication payload authenticates, validates, and triggers a deployment", async () => {
  const originalFetch = globalThis.fetch;
  let call;
  globalThis.fetch = async (url, options) => { call = { url, options }; return { ok: true, status: 200 }; };
  try {
    const res = response();
    await publishHandler(request(), res);
    assert.equal(res.statusCode, 202);
    assert.equal(call.url, process.env.VERCEL_DEPLOY_HOOK_URL);
    assert.equal(JSON.parse(call.options.body).content_item_id, publication.content_item_id);
    assert.equal(res.body.final_url, `https://herzenco.co${publication.canonical_path}`);
  } finally { globalThis.fetch = originalFetch; }
});

test("webhook rejects invalid secrets and malformed events", async () => {
  let res = response();
  await publishHandler(request(publication, "wrong"), res);
  assert.equal(res.statusCode, 401);
  res = response();
  await publishHandler(request({ ...publication, destination: "homepage" }), res);
  assert.equal(res.statusCode, 400);
});

test("duplicate idempotency keys trigger only one deployment per warm instance", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return { ok: true, status: 200 }; };
  try {
    const first = response();
    const second = response();
    await publishHandler(request(), first);
    await publishHandler(request(), second);
    assert.equal(calls, 1);
    assert.equal(second.body.duplicate, true);
  } finally { globalThis.fetch = originalFetch; }
});

test("failed deployment hooks remain retryable", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => ({ ok: ++calls > 1, status: calls > 1 ? 200 : 503 });
  try {
    const first = response();
    const second = response();
    await publishHandler(request(), first);
    await publishHandler(request(), second);
    assert.equal(first.statusCode, 502);
    assert.equal(second.statusCode, 202);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("OCC pull uses server authentication and the finalized filters", async () => {
  const calls = [];
  const items = await fetchPublishedContent({
    apiUrl: "https://operations.example.test/api/v1/content-items",
    token: "content-token",
    fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ data: { items: [article], count: 1, limit: 500, offset: 0 } }) }; },
  });
  assert.equal(items[0].slug, article.slug);
  assert.equal(calls[0].url.searchParams.get("property"), "herzen-co");
  assert.equal(calls[0].url.searchParams.get("status"), "published");
  assert.equal(calls[0].url.searchParams.get("limit"), "500");
  assert.equal(calls[0].options.headers.authorization, "Bearer content-token");
});

test("unexpected non-published OCC records fail closed", () => {
  assert.throws(() => normalizePublishedItems([{ ...article, status: "draft" }]), /outside the requested published set/);
});

test("generation creates current pages and removes stale generated pages", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "herzenco-occ-"));
  await fs.mkdir(path.join(root, "resources", "stale-article"), { recursive: true });
  await fs.copyFile(path.resolve("resources/index.html"), path.join(root, "resources", "index.html"));
  await fs.copyFile(path.resolve("sitemap.xml"), path.join(root, "sitemap.xml"));
  await fs.writeFile(path.join(root, ".occ-content-manifest.json"), JSON.stringify({ slugs: ["stale-article"] }));
  await generateContent({ rootDir: root, items: normalizePublishedItems([article]) });
  const html = await fs.readFile(path.join(root, "resources", article.slug, "index.html"), "utf8");
  const listing = await fs.readFile(path.join(root, "resources", "index.html"), "utf8");
  const sitemap = await fs.readFile(path.join(root, "sitemap.xml"), "utf8");
  assert.match(html, /<h1>Clearer Product Roadmaps<\/h1>/);
  assert.match(html, /GTM-K9SZRQ94/);
  assert.match(listing, /\/resources\/clearer-product-roadmaps\//);
  assert.match(sitemap, /\/resources\/clearer-product-roadmaps\//);
  await assert.rejects(fs.access(path.join(root, "resources", "stale-article")));
});

test("Markdown is sanitized before publication", () => {
  const html = sanitizeMarkdown("## Safe\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))");
  assert.match(html, /<h2>Safe<\/h2>/);
  assert.doesNotMatch(html, /<script|javascript:/i);
});
