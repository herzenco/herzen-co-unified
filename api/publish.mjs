import { timingSafeEqual } from "node:crypto";

const SITE_URL = (process.env.SITE_URL || "https://herzenco.co").replace(/\/$/, "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256 = /^[0-9a-f]{64}$/i;
const deliveries = new Map();

function reply(res, status, body) { return res.status(status).json(body); }

function secretMatches(provided, expected) {
  const left = Buffer.from(provided || "");
  const right = Buffer.from(expected || "");
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

function parseBody(req) {
  if (typeof req.body === "string") return JSON.parse(req.body);
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) return req.body;
  throw new Error("invalid_json");
}

function validPayload(payload) {
  return payload.schema_version === 1 && UUID.test(payload.content_item_id || "") &&
    typeof payload.idempotency_key === "string" && payload.idempotency_key.length > 0 && payload.idempotency_key.length <= 300 &&
    SHA256.test(payload.approved_content_hash || "") && typeof payload.title === "string" && payload.title.trim().length > 0 &&
    typeof payload.body === "string" && payload.body.trim().length > 0 && payload.content_type === "article" &&
    payload.destination === "resource_library" && SLUG.test(payload.slug || "") &&
    payload.canonical_path === `/resources/${payload.slug}/` && payload.status === "published" &&
    typeof payload.seo?.title === "string" && payload.seo.title.trim().length > 0 &&
    typeof payload.seo?.description === "string" && payload.seo.description.trim().length > 0 &&
    payload.source?.system === "occ";
}

async function triggerDeployment(deployHookUrl, payload) {
  const response = await fetch(deployHookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      source: "occ-content-publishing",
      content_item_id: payload.content_item_id,
      idempotency_key: payload.idempotency_key,
      approved_content_hash: payload.approved_content_hash,
      slug: payload.slug,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`deploy_hook_${response.status}`);
}

function remember(eventId, value) {
  deliveries.set(eventId, value);
  if (deliveries.size > 500) deliveries.delete(deliveries.keys().next().value);
}

export function resetPublishStateForTests() { deliveries.clear(); }

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return reply(res, 405, { error: "method_not_allowed" });
  }

  const secret = process.env.HERZENCO_PUBLISH_WEBHOOK_SECRET || "";
  const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL || "";
  if (!secret || !deployHookUrl) return reply(res, 500, { error: "server_not_configured" });

  const authorization = String(req.headers?.authorization || "");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secretMatches(token, secret)) return reply(res, 401, { error: "invalid_secret" });

  let payload;
  try { payload = parseBody(req); } catch { return reply(res, 400, { error: "invalid_json" }); }
  if (!validPayload(payload)) return reply(res, 400, { error: "invalid_event" });

  const requestKey = String(req.headers?.["idempotency-key"] || "");
  if (requestKey && requestKey !== payload.idempotency_key) return reply(res, 400, { error: "idempotency_key_mismatch" });
  const finalUrl = `${SITE_URL}/resources/${payload.slug}/`;
  const success = (duplicate = false) => ({
    accepted: true,
    duplicate,
    id: payload.content_item_id,
    final_url: finalUrl,
    published_at: new Date().toISOString(),
    publishing_status: "publishing",
  });

  const existing = deliveries.get(payload.idempotency_key);
  if (existing === true) return reply(res, 202, success(true));

  try {
    const pending = existing || triggerDeployment(deployHookUrl, payload);
    if (!existing) remember(payload.idempotency_key, pending);
    await pending;
    remember(payload.idempotency_key, true);
    console.info("OCC publication accepted", { content_item_id: payload.content_item_id, slug: payload.slug });
    return reply(res, 202, success());
  } catch (error) {
    deliveries.delete(payload.idempotency_key);
    console.error("OCC publication deployment trigger failed", { content_item_id: payload.content_item_id, error: error?.name || "Error" });
    return reply(res, 502, { error: "deployment_hook_failed" });
  }
}
