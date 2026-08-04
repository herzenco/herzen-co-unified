# Operational Command Center Inquiry Integration

## Purpose

The Herzen Co. website should submit inquiries through the website and send them securely to the separate Operational Command Center. Visitors should not be sent to an email client. The Operational Command Center will become the system of record for inquiry review, qualification, assignment, and follow-up.

The public contact email is `hello@herzenco.co`, but website form submissions should be delivered to the Operational Command Center rather than emailed.

## System flow

1. A visitor completes the form on the Herzen Co. website.
2. The browser submits the form to a private Vercel Function in the website project.
3. The website function validates the submission and applies spam protection.
4. The function signs and forwards the inquiry to the Operational Command Center.
5. The Operational Command Center validates the signature and stores the inquiry.
6. The website displays an on-page success or recoverable error message.

The browser must never receive the Operational Command Center signing secret or submit directly to its private ingestion endpoint.

## Operational Command Center endpoint

```http
POST https://{command-center-domain}/api/v1/inquiries
Content-Type: application/json
X-Herzen-Timestamp: 2026-07-31T18:30:00.000Z
X-Herzen-Signature: sha256={hmac-signature}
Idempotency-Key: {uuid}
```

The signature must be an HMAC-SHA256 of:

```text
{timestamp}.{raw-request-body}
```

Both projects must store the same server-side secret:

```env
OCC_INQUIRY_SIGNING_SECRET=
```

The endpoint must reject a request when:

- The signature is missing or invalid.
- The timestamp is more than five minutes old.
- Required fields are missing or malformed.
- The request exceeds applicable rate limits.

An already-processed idempotency key should return the original successful result without creating a second inquiry.

## Request payload

```json
{
  "propertySlug": "herzenco",
  "source": "website_contact_form",
  "submittedAt": "2026-07-31T18:30:00.000Z",
  "contact": {
    "name": "Jane Smith",
    "email": "jane@example.com"
  },
  "inquiry": {
    "serviceInterest": "product_leadership",
    "projectContext": "Description supplied by the visitor"
  },
  "attribution": {
    "sourcePage": "/contact/",
    "landingPage": "/resources/example-article/",
    "contentSlug": "example-article",
    "referrer": "https://example.com/",
    "utmSource": "linkedin",
    "utmMedium": "social",
    "utmCampaign": "founder-content"
  },
  "technical": {
    "websiteEnvironment": "production"
  }
}
```

Required fields:

- `propertySlug`
- `source`
- `submittedAt`
- `contact.name`
- `contact.email`
- `inquiry.serviceInterest`
- `inquiry.projectContext`

Unavailable optional attribution properties must be omitted rather than sent as empty strings, `null`, or placeholder values.

Allowed `serviceInterest` values:

```text
product_leadership
custom_project
project_management
not_sure
```

Do not send Mixpanel identifiers, IP addresses, cookies, browser fingerprints, analytics-consent values, or unrelated browser data.

## Successful responses

For a newly created inquiry:

```http
HTTP 201 Created
```

```json
{
  "data": {
    "id": "inquiry-uuid",
    "status": "new",
    "receivedAt": "2026-07-31T18:30:01.000Z"
  }
}
```

For an idempotent replay, return the original result with `HTTP 200 OK`.

## Error responses

```json
{
  "error": "invalid_request",
  "message": "Human-readable explanation"
}
```

Use these status codes:

- `400` for malformed JSON or invalid fields.
- `401` for a missing or invalid signature.
- `409` for an unrecoverable idempotency conflict.
- `429` when rate limited.
- `500` for an internal failure.
- `503` when the Command Center is temporarily unavailable.

Responses must never expose database details, credentials, secrets, or stack traces.

## Command Center data model

Create an `inquiries` table containing:

```text
id
property_slug
source
status
name
email
service_interest
project_context
source_page
landing_page
content_slug
referrer
utm_source
utm_medium
utm_campaign
submitted_at
received_at
idempotency_key
assigned_to
follow_up_at
created_at
updated_at
```

Recommended inquiry statuses:

```text
new
reviewing
qualified
call_scheduled
proposal
won
lost
spam
archived
```

The Command Center should record inquiry lifecycle changes in its existing activity or audit log.

## Website endpoint

The Herzen Co. website should expose:

```http
POST /api/inquiry
```

The Vercel Function must:

1. Accept the browser form submission.
2. Validate and normalize every field.
3. Reject unexpected fields and oversized payloads.
4. Apply a honeypot and server-side rate limiting.
5. Generate an ISO timestamp and UUID idempotency key.
6. Serialize the outbound JSON exactly once.
7. Generate the HMAC signature over the timestamp and raw body.
8. Send the signed request to the Operational Command Center.
9. Return a safe success or error response to the browser.
10. Avoid logging names, email addresses, or project context.

Website environment variables:

```env
OCC_INQUIRY_ENDPOINT=https://{command-center-domain}/api/v1/inquiries
OCC_INQUIRY_SIGNING_SECRET=
```

Neither value may be exposed through static JavaScript, HTML, Mixpanel, Vercel Web Analytics, Git, or client-visible error messages.

## Contact-form experience

The on-site form should:

- Submit without opening an email client.
- Disable the submit button while a request is active.
- Prevent accidental duplicate submissions.
- Display an accessible success confirmation on the same page.
- Display a recoverable error without erasing the visitor's entered information.
- Provide `hello@herzenco.co` as a fallback contact method only when submission fails.
- Remain functional when the visitor declines analytics consent.

Mixpanel may record `inquiry_started`, `inquiry_submitted`, or a submission-failure event only after analytics consent. These events must not contain the visitor's name, email, or project context.

## CTA routing

General conversation CTAs should lead to the on-site contact form:

- Start a conversation
- Talk with us
- Ask your question

High-intent scheduling CTAs should lead to the Herzen Co. Calendly destination:

```text
https://calendly.com/herzenco/xyren-discover
```

Recommended scheduling CTAs:

- Start discovery
- Talk through pricing
- Discuss fit
- Start product leadership
- Discuss your project
- Discuss project management solutions

To keep the visitor within the branded site where practical, the website may provide an internal `/schedule/` page containing an approved Calendly embed. The integration must clearly disclose that scheduling data is processed by Calendly.

## Operational Command Center interface

The Command Center should provide:

- An inquiry list with status, property, date, assignee, and service filters.
- Search by contact or project context.
- An inquiry detail view.
- Status and assignee management.
- Original attribution and project context.
- Follow-up dates and internal notes.
- Duplicate detection by idempotency key.
- A complete activity history.
- An optional internal notification when a new inquiry arrives.
- Access restrictions appropriate for stored personal information.

## Validation requirements

Verify:

1. A valid website submission creates one inquiry.
2. A repeated idempotency key does not create a duplicate.
3. Invalid signatures and expired timestamps are rejected.
4. Required fields and allowed service values are enforced.
5. Oversized and unexpected input is rejected safely.
6. Command Center downtime produces a recoverable website error.
7. The visitor's form values survive recoverable errors.
8. Secrets never appear in browser assets or responses.
9. Personal inquiry data never appears in Mixpanel events or application logs.
10. The form works when analytics consent is declined.
11. Successful submissions display an accessible on-page confirmation.
12. Command Center status and assignment changes create audit records.

## Implementation boundary

The Operational Command Center endpoint and data model must be completed before the website switches away from its current email-based submission behavior. Changes to either repository should be implemented and validated in its own project context.
