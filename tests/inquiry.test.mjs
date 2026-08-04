import assert from "node:assert/strict";
import test from "node:test";
import inquiryHandler, { resetInquiryStateForTests } from "../api/inquiry.mjs";

const validPayload = {
  name: "Jane Smith",
  company: "Example Company",
  email: "jane@example.com",
  phone: "",
  service: "Product leadership",
  message: "We need help clarifying priorities and owning delivery.",
  website: "",
  pagePath: "/contact/",
  attribution: { utm_source: "google", landing_page: "/?utm_source=google" },
};

function configureEnvironment() {
  process.env.OCC_API_URL = "https://operations.example.test/api/v1";
  process.env.OCC_INTEGRATION_EMAIL = "operator@herzenco.co";
  process.env.OCC_INTEGRATION_PASSWORD = "test-password";
  process.env.OCC_PROPERTY_ID = "00000000-0000-4000-8000-000000000001";
}

function request(body = validPayload, headers = {}) {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.8",
      ...headers,
    },
    body,
  };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function token() {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return `header.${payload}.signature`;
}

test.beforeEach(() => {
  configureEnvironment();
  resetInquiryStateForTests();
});

test("valid website inquiries authenticate and create an OCC lead", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/token")) {
      return { ok: true, status: 200, json: async () => ({ data: { access_token: token() } }) };
    }
    return { ok: true, status: 201, json: async () => ({ data: { id: "lead-id" } }) };
  };

  try {
    const res = response();
    await inquiryHandler(request(), res);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, { ok: true });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "https://operations.example.test/api/v1/auth/token");
    assert.equal(calls[1].url, "https://operations.example.test/api/v1/leads");
    const lead = JSON.parse(calls[1].options.body);
    assert.equal(lead.contact_name, validPayload.name);
    assert.equal(lead.email, validPayload.email);
    assert.equal(lead.source, "website");
    assert.equal(lead.status, "new");
    assert.equal(lead.metadata.utm_source, "google");
    assert.equal(calls[1].options.headers.authorization, `Bearer ${token()}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invalid inquiries are rejected before OCC is called", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; };
  try {
    const res = response();
    await inquiryHandler(request({ ...validPayload, name: "", email: "not-an-email" }), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "invalid_inquiry" });
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("honeypot submissions return success without creating a lead", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; };
  try {
    const res = response();
    await inquiryHandler(request({ ...validPayload, website: "spam.example" }), res);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, { ok: true });
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("expired OCC authentication is refreshed and lead creation is retried once", async () => {
  const originalFetch = globalThis.fetch;
  let authCalls = 0;
  let leadCalls = 0;
  globalThis.fetch = async (url) => {
    if (url.endsWith("/auth/token")) {
      authCalls += 1;
      return { ok: true, status: 200, json: async () => ({ data: { access_token: token() } }) };
    }
    leadCalls += 1;
    if (leadCalls === 1) return { ok: false, status: 401, json: async () => ({ error: { code: "expired" } }) };
    return { ok: true, status: 201, json: async () => ({ data: { id: "lead-id" } }) };
  };
  try {
    const res = response();
    await inquiryHandler(request(), res);
    assert.equal(res.statusCode, 201);
    assert.equal(authCalls, 2);
    assert.equal(leadCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the public inquiry route enforces content type and rate limits", async () => {
  let res = response();
  await inquiryHandler(request(validPayload, { "content-type": "text/plain" }), res);
  assert.equal(res.statusCode, 415);

  for (let index = 0; index < 5; index += 1) {
    res = response();
    await inquiryHandler(request({ ...validPayload, website: "spam.example" }), res);
    assert.equal(res.statusCode, 201);
  }
  res = response();
  await inquiryHandler(request({ ...validPayload, website: "spam.example" }), res);
  assert.equal(res.statusCode, 429);
});
