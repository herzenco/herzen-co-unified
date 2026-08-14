import { timingSafeEqual } from "node:crypto";

const PROPERTY_SLUG = "herzenco";
const EVENTS = new Set(["content.published", "content.updated", "content.unpublished", "content.archived"]);

function secretMatches(provided, expected) {
  const left = Buffer.from(provided || "");
  const right = Buffer.from(expected || "");
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

function reply(res, status, body) {
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return reply(res, 405, { error: "method_not_allowed" });
  }

  const publishSecret = process.env.HERZENCO_PUBLISH_WEBHOOK_SECRET;
  const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!publishSecret || !deployHookUrl) return reply(res, 500, { error: "server_not_configured" });

  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secretMatches(token, publishSecret)) return reply(res, 401, { error: "invalid_secret" });

  let payload = req.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { return reply(res, 400, { error: "invalid_json" }); }
  }
  if (payload?.property !== PROPERTY_SLUG) return reply(res, 400, { error: "invalid_property" });
  if (typeof payload?.event_id !== "string" || !payload.event_id.trim()) return reply(res, 400, { error: "invalid_event_id" });
  if (!EVENTS.has(payload?.event)) return reply(res, 400, { error: "invalid_event" });
  if (typeof payload?.content_id !== "string" || !payload.content_id.trim()) return reply(res, 400, { error: "invalid_content_id" });
  if (!Number.isFinite(Date.parse(payload?.occurred_at))) return reply(res, 400, { error: "invalid_occurred_at" });
  if (typeof payload?.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) {
    return reply(res, 400, { error: "invalid_slug" });
  }

  try {
    const hookResponse = await fetch(deployHookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_id: payload.event_id, event: payload.event, property: PROPERTY_SLUG, content_id: payload.content_id, slug: payload.slug, occurred_at: payload.occurred_at, source: "occ" }),
    });
    if (!hookResponse.ok) return reply(res, 502, { error: "deployment_hook_failed" });
    return reply(res, 202, { accepted: true, event_id: payload.event_id });
  } catch {
    return reply(res, 502, { error: "deployment_hook_failed" });
  }
}
