import { timingSafeEqual } from "node:crypto";

const PROPERTY_SLUG = "herzenco";

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

  const publishSecret = process.env.PUBLISH_SECRET;
  const deployHookUrl = process.env.DEPLOY_HOOK_URL;
  if (!publishSecret || !deployHookUrl) return reply(res, 500, { error: "server_not_configured" });

  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secretMatches(token, publishSecret)) return reply(res, 401, { error: "invalid_secret" });

  let payload = req.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { return reply(res, 400, { error: "invalid_json" }); }
  }
  if (payload?.propertySlug !== PROPERTY_SLUG) return reply(res, 400, { error: "invalid_property_slug" });
  if (typeof payload?.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) {
    return reply(res, 400, { error: "invalid_slug" });
  }

  try {
    const hookResponse = await fetch(deployHookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ propertySlug: PROPERTY_SLUG, slug: payload.slug, source: "herzen-content-engine" }),
    });
    if (!hookResponse.ok) return reply(res, 502, { error: "deployment_hook_failed" });
    return reply(res, 202, { accepted: true, propertySlug: PROPERTY_SLUG, slug: payload.slug });
  } catch {
    return reply(res, 502, { error: "deployment_hook_failed" });
  }
}
