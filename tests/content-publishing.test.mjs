import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import publishHandler, { resetPublishStateForTests } from "../api/publish.mjs";
import {
  contentSyncMode, fetchPublishedContent, generateContent, normalizePublishedItems, sanitizeMarkdown,
} from "../scripts/sync-content.mjs";

const publication = {
  event_id: "11111111-1111-4111-8111-111111111111",
  event: "content.published",
  property: "herzenco",
  content_id: "22222222-2222-4222-8222-222222222222",
  slug: "clearer-product-roadmaps",
  occurred_at: "2026-08-14T18:00:00.000Z",
};

const article = {
  id: publication.content_id,
  revision: 3,
  revision_digest: "a".repeat(64),
  property: "herzenco",
  status: "published",
  slug: publication.slug,
  title: "Clearer Product Roadmaps",
  excerpt: "A practical approach to roadmap decisions for teams balancing evidence, risk, and delivery.",
  body: "## Start with the decision\n\nUse **evidence** before adding more work.",
  published_at: "2026-08-14T18:00:00.000Z",
  updated_at: "2026-08-14T18:00:00.000Z",
  seo: { title: "Clearer Product Roadmaps | Herzen Co.", description: "A practical guide to clearer roadmap decisions." },
  hero_image: { url: "https://images.example.test/roadmap.jpg", alt: "A roadmap workshop" },
  canonical_url: "https://www.herzenco.co/resources/clearer-product-roadmaps/",
  author: "Herzen Co.",
  category: "Operations",
};

function response() {
  return { statusCode: 200, body: null, headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function request(body = publication, secret = "test-secret") {
  return { method: "POST", headers: { authorization: `Bearer ${secret}`, "idempotency-key": body.event_id }, body };
}

test.beforeEach(() => {
  resetPublishStateForTests();
  process.env.HERZENCO_PUBLISH_WEBHOOK_SECRET = "test-secret";
  process.env.VERCEL_DEPLOY_HOOK_URL = "https://api.vercel.com/v1/integrations/deploy/test";
});

test("OCC identifier event authenticates, validates, and triggers a deployment", async () => {
  const originalFetch = globalThis.fetch;
  let call;
  globalThis.fetch = async (url, options) => { call = { url, options }; return { ok: true, status: 200 }; };
  try {
    const res = response();
    await publishHandler(request(), res);
    assert.equal(res.statusCode, 202);
    assert.equal(call.url, process.env.VERCEL_DEPLOY_HOOK_URL);
    const deployEvent = JSON.parse(call.options.body);
    assert.equal(deployEvent.event_id, publication.event_id);
    assert.equal(deployEvent.content_id, publication.content_id);
    assert.doesNotMatch(JSON.stringify(deployEvent), /title|body|approved_content_hash/);
    assert.equal(res.body.final_url, `https://www.herzenco.co/resources/${publication.slug}/`);
  } finally { globalThis.fetch = originalFetch; }
});

test("webhook rejects invalid secrets and malformed events", async () => {
  let res = response();
  await publishHandler(request(publication, "wrong"), res);
  assert.equal(res.statusCode, 401);
  res = response();
  await publishHandler(request({ ...publication, property: "other" }), res);
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
    apiUrl: "https://operations.example.test/api/v1/content",
    token: "content-token",
    fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ data: [article] }) }; },
  });
  assert.equal(items[0].slug, article.slug);
  assert.equal(calls[0].url.searchParams.get("property"), "herzenco");
  assert.equal(calls[0].url.searchParams.get("status"), "published");
  assert.equal(calls[0].url.searchParams.has("limit"), false);
  assert.equal(calls[0].url.searchParams.has("offset"), false);
  assert.equal(calls[0].options.headers.authorization, "Bearer content-token");
});

test("public Preview builds never require or partially configure the production OCC credential", () => {
  assert.equal(contentSyncMode({ vercelEnvironment: "preview", apiUrl: "", token: "" }), "skip_preview");
  assert.equal(contentSyncMode({ vercelEnvironment: "production", apiUrl: "", token: "" }), "required");
  assert.equal(contentSyncMode({ vercelEnvironment: "preview", apiUrl: "https://occ.example.test", token: "secret" }), "required");
  assert.throws(
    () => contentSyncMode({ vercelEnvironment: "preview", apiUrl: "https://occ.example.test", token: "" }),
    /incomplete/,
  );
  assert.throws(
    () => contentSyncMode({ vercelEnvironment: "preview", apiUrl: "", token: "secret" }),
    /incomplete/,
  );
});

test("unexpected non-published OCC records fail closed", () => {
  assert.throws(() => normalizePublishedItems([{ ...article, status: "draft" }]), /outside the requested published set/);
  assert.throws(() => normalizePublishedItems([{ ...article, revision_digest: "not-a-digest" }]), /missing a required field/);
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
  assert.match(html, /<meta name="occ:content-id" content="22222222-2222-4222-8222-222222222222">/);
  assert.match(html, /<meta name="occ:revision" content="3">/);
  assert.match(html, new RegExp(`<meta name="occ:revision-digest" content="${"a".repeat(64)}">`));
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
