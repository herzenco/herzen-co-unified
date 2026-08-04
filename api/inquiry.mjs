const MAX_BODY_BYTES = 24_000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const rateLimitBuckets = new Map();

let cachedAccessToken = "";
let cachedAccessTokenExpiresAt = 0;

function reply(res, status, body) {
  return res.status(status).json(body);
}

function cleanString(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function parseBody(req) {
  if (typeof req.body === "string") return JSON.parse(req.body);
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) return req.body;
  throw new Error("invalid_json");
}

function getClientIp(req) {
  const forwarded = req.headers?.["x-vercel-forwarded-for"] || req.headers?.["x-forwarded-for"];
  return cleanString(Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0], 128) || "unknown";
}

function isRateLimited(ip, now = Date.now()) {
  const existing = rateLimitBuckets.get(ip);
  if (!existing || now - existing.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(ip, { count: 1, startedAt: now });
    return false;
  }
  existing.count += 1;
  return existing.count > RATE_LIMIT_MAX_REQUESTS;
}

function decodeTokenExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return Number(payload.exp) * 1000;
  } catch {
    return Date.now() + 5 * 60 * 1000;
  }
}

function getConfiguration() {
  const apiUrl = cleanString(process.env.OCC_API_URL, 500).replace(/\/$/, "");
  const email = cleanString(process.env.OCC_INTEGRATION_EMAIL, 320);
  const password = process.env.OCC_INTEGRATION_PASSWORD || "";
  const propertyId = cleanString(process.env.OCC_PROPERTY_ID, 64);
  if (!apiUrl || !email || !password || !UUID_PATTERN.test(propertyId)) return null;
  return { apiUrl, email, password, propertyId };
}

async function getOccAccessToken(config, forceRefresh = false) {
  if (!forceRefresh && cachedAccessToken && cachedAccessTokenExpiresAt > Date.now() + 30_000) {
    return cachedAccessToken;
  }

  const response = await fetch(`${config.apiUrl}/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: config.email, password: config.password }),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await response.json().catch(() => null);
  const token = payload?.data?.access_token;
  if (!response.ok || typeof token !== "string" || !token) throw new Error("occ_authentication_failed");

  cachedAccessToken = token;
  cachedAccessTokenExpiresAt = decodeTokenExpiry(token);
  return token;
}

async function createLead(config, token, lead) {
  return fetch(`${config.apiUrl}/leads`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(lead),
    signal: AbortSignal.timeout(8_000),
  });
}

function buildLead(payload, propertyId) {
  const name = cleanString(payload.name, 120);
  const company = cleanString(payload.company, 160);
  const email = cleanString(payload.email, 320).toLowerCase();
  const phone = cleanString(payload.phone, 40);
  const service = cleanString(payload.service, 80) || "Not sure yet";
  const message = cleanString(payload.message, 5_000);

  if (!name || !message || (!email && !phone) || (email && !EMAIL_PATTERN.test(email))) return null;

  const metadata = {
    form_name: "primary-contact",
    page_path: cleanString(payload.pagePath, 300) || "/contact/",
  };
  const attribution = payload.attribution && typeof payload.attribution === "object" ? payload.attribution : {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((key) => {
    const value = cleanString(attribution[key], 200);
    if (value) metadata[key] = value;
  });
  const referrer = cleanString(attribution.referrer, 500);
  const landingPage = cleanString(attribution.landing_page, 300);
  if (referrer) metadata.referrer = referrer;
  if (landingPage) metadata.landing_page = landingPage;

  return {
    property_id: propertyId,
    contact_name: name,
    company: company || null,
    email: email || null,
    phone: phone || null,
    source: "website",
    subject: `Website inquiry: ${service}`,
    inquiry: message,
    status: "new",
    priority: "medium",
    metadata,
  };
}

export function resetInquiryStateForTests() {
  rateLimitBuckets.clear();
  cachedAccessToken = "";
  cachedAccessTokenExpiresAt = 0;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return reply(res, 405, { error: "method_not_allowed" });
  }

  const contentType = String(req.headers?.["content-type"] || "").toLowerCase();
  if (!contentType.startsWith("application/json")) return reply(res, 415, { error: "unsupported_media_type" });
  const contentLength = Number(req.headers?.["content-length"] || 0);
  if (contentLength > MAX_BODY_BYTES) return reply(res, 413, { error: "request_too_large" });
  if (isRateLimited(getClientIp(req))) return reply(res, 429, { error: "too_many_requests" });

  const config = getConfiguration();
  if (!config) return reply(res, 500, { error: "server_not_configured" });

  let payload;
  try {
    payload = parseBody(req);
  } catch {
    return reply(res, 400, { error: "invalid_json" });
  }
  if (JSON.stringify(payload).length > MAX_BODY_BYTES) return reply(res, 413, { error: "request_too_large" });
  if (cleanString(payload.website, 200)) return reply(res, 201, { ok: true });

  const lead = buildLead(payload, config.propertyId);
  if (!lead) return reply(res, 400, { error: "invalid_inquiry" });

  try {
    let token = await getOccAccessToken(config);
    let occResponse = await createLead(config, token, lead);
    if (occResponse.status === 401) {
      token = await getOccAccessToken(config, true);
      occResponse = await createLead(config, token, lead);
    }
    const occPayload = await occResponse.json().catch(() => null);
    if (!occResponse.ok) {
      console.error("OCC lead submission failed", {
        status: occResponse.status,
        code: occPayload?.error?.code,
      });
      return reply(res, 502, { error: "inquiry_delivery_failed" });
    }
    return reply(res, 201, { ok: true });
  } catch (error) {
    console.error("OCC lead submission unavailable", { error: error?.name || "Error" });
    return reply(res, 502, { error: "inquiry_delivery_failed" });
  }
}
