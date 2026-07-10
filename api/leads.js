const MAX_BODY_BYTES = 16 * 1024;

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function clean(value) {
  return String(value || "").trim();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildLead(payload, req) {
  const lead = {
    receivedAt: new Date().toISOString(),
    name: clean(payload.name),
    email: clean(payload.email).toLowerCase(),
    company: clean(payload.company),
    service: clean(payload.service || "Not sure yet"),
    timeline: clean(payload.timeline),
    budget: clean(payload.budget),
    message: clean(payload.message),
    leadType: clean(payload.leadType || "contact"),
    source: clean(payload.source || "website"),
    path: clean(payload.path),
    pageTitle: clean(payload.pageTitle),
    referrer: clean(payload.referrer),
    utmSource: clean(payload.utmSource),
    utmMedium: clean(payload.utmMedium),
    utmCampaign: clean(payload.utmCampaign),
    userAgent: clean(req.headers["user-agent"]),
    ip: clean(req.headers["x-forwarded-for"] || req.socket?.remoteAddress).split(",")[0],
  };

  return lead;
}

function leadText(lead) {
  return [
    `New Herzen Co. lead (${lead.leadType})`,
    "",
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Company: ${lead.company || "Not provided"}`,
    `Need: ${lead.service}`,
    `Timeline: ${lead.timeline || "Not provided"}`,
    `Budget/Fit: ${lead.budget || "Not provided"}`,
    `Source: ${lead.source}`,
    `Path: ${lead.path || "Not provided"}`,
    "",
    "Message:",
    lead.message || "Not provided",
  ].join("\n");
}

function leadMarkdown(lead) {
  return [
    `## New Herzen Co. lead: ${lead.leadType}`,
    "",
    `**Name:** ${lead.name}`,
    `**Email:** ${lead.email}`,
    `**Company:** ${lead.company || "Not provided"}`,
    `**Need:** ${lead.service}`,
    `**Timeline:** ${lead.timeline || "Not provided"}`,
    `**Budget/Fit:** ${lead.budget || "Not provided"}`,
    `**Source:** ${lead.source}`,
    `**Path:** ${lead.path || "Not provided"}`,
    `**Referrer:** ${lead.referrer || "Not provided"}`,
    `**UTM Source:** ${lead.utmSource || "Not provided"}`,
    `**UTM Medium:** ${lead.utmMedium || "Not provided"}`,
    `**UTM Campaign:** ${lead.utmCampaign || "Not provided"}`,
    "",
    "### Message",
    lead.message || "Not provided",
  ].join("\n");
}

function leadHtml(lead) {
  const rows = [
    ["Name", lead.name],
    ["Email", lead.email],
    ["Company", lead.company || "Not provided"],
    ["Need", lead.service],
    ["Timeline", lead.timeline || "Not provided"],
    ["Budget/Fit", lead.budget || "Not provided"],
    ["Source", lead.source],
    ["Path", lead.path || "Not provided"],
    ["Referrer", lead.referrer || "Not provided"],
  ];

  const bodyRows = rows
    .map(([label, value]) => `<tr><th align="left">${label}</th><td>${escapeHtml(value)}</td></tr>`)
    .join("");

  return `
    <h1>New Herzen Co. lead</h1>
    <p><strong>Type:</strong> ${escapeHtml(lead.leadType)}</p>
    <table cellpadding="6" cellspacing="0">${bodyRows}</table>
    <h2>Message</h2>
    <p>${escapeHtml(lead.message || "Not provided").replace(/\n/g, "<br>")}</p>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendWebhook(lead) {
  const webhookUrl = process.env.LEAD_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const headers = { "Content-Type": "application/json" };
  if (process.env.LEAD_WEBHOOK_SECRET) {
    headers.Authorization = `Bearer ${process.env.LEAD_WEBHOOK_SECRET}`;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ lead }),
  });

  if (!response.ok) {
    throw new Error(`Lead webhook failed with ${response.status}`);
  }

  return true;
}

async function sendEmail(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFY_TO;
  const from = process.env.LEAD_FROM;

  if (!apiKey || !to || !from) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: to.split(",").map((item) => item.trim()).filter(Boolean),
      reply_to: lead.email,
      subject: `New lead: ${lead.service} from ${lead.name}`,
      text: leadText(lead),
      html: leadHtml(lead),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend failed with ${response.status}: ${details.slice(0, 240)}`);
  }

  return true;
}

async function sendClickUp(lead) {
  const apiToken = process.env.CLICKUP_API_TOKEN;
  const listId = process.env.CLICKUP_LIST_ID;

  if (!apiToken || !listId) return false;

  const tags = [
    "website-lead",
    lead.leadType,
    ...clean(process.env.CLICKUP_TAGS)
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  ];

  const assignees = clean(process.env.CLICKUP_ASSIGNEES)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => Number(id.trim()))
    .filter(Number.isFinite);

  const payload = {
    name: `Lead: ${lead.name} - ${lead.service}`,
    markdown_content: leadMarkdown(lead),
    tags,
    notify_all: true,
  };

  if (assignees.length > 0) payload.assignees = assignees;
  if (process.env.CLICKUP_STATUS) payload.status = process.env.CLICKUP_STATUS;

  const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
    method: "POST",
    headers: {
      Authorization: apiToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`ClickUp failed with ${response.status}: ${details.slice(0, 240)}`);
  }

  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const payload = JSON.parse(await readBody(req));

    if (clean(payload.website)) {
      return sendJson(res, 200, { ok: true });
    }

    const lead = buildLead(payload, req);
    const errors = [];

    if (!lead.name) errors.push("name");
    if (!isEmail(lead.email)) errors.push("email");
    if (!lead.message && lead.leadType !== "lead-magnet") errors.push("message");

    if (errors.length > 0) {
      return sendJson(res, 400, { ok: false, error: "Missing required fields", fields: errors });
    }

    const delivered = [];
    const deliveryErrors = [];

    for (const [name, send] of [
      ["clickup", sendClickUp],
      ["webhook", sendWebhook],
      ["email", sendEmail],
    ]) {
      try {
        if (await send(lead)) delivered.push(name);
      } catch (deliveryError) {
        deliveryErrors.push(`${name}: ${deliveryError.message}`);
      }
    }

    if (delivered.length === 0) {
      if (deliveryErrors.length > 0) {
        console.error("Lead delivery failed", deliveryErrors);
        return sendJson(res, 502, { ok: false, error: "Lead delivery failed" });
      }

      return sendJson(res, 503, {
        ok: false,
        error: "Lead delivery is not configured",
        needs: [
          "CLICKUP_API_TOKEN + CLICKUP_LIST_ID",
          "or RESEND_API_KEY + LEAD_NOTIFY_TO + LEAD_FROM",
          "or LEAD_WEBHOOK_URL",
        ],
      });
    }

    if (deliveryErrors.length > 0) {
      console.warn("Lead captured with partial delivery", deliveryErrors);
    }

    return sendJson(res, 200, { ok: true, delivered });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { ok: false, error: "Lead submission failed" });
  }
};
