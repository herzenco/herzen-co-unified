# OCC resource publishing contract

This is the reusable contract for an OCC-owned content library. OCC is the source of truth. The website never accepts article bodies through the webhook: it receives a signed identifier-only event, starts an immutable deployment, and pulls the complete published collection from OCC during the build.

## End-to-end lifecycle

1. A human approves a complete website article in OCC.
2. OCC changes the item from `approved` to `scheduled`, preserving its approved `publish_at` timestamp.
3. At or after `publish_at`, OCC atomically changes the item to `status: published` and `publication_state: published`.
4. The database transaction adds an identifier-only event to `website_publication_events`.
5. OCC sends that event to the website with a shared bearer secret.
6. The website validates the event, calls a private Vercel Deploy Hook, and returns HTTP `202`.
7. The build calls OCC's authenticated pull API, regenerates the complete resource listing and article pages, removes stale generated pages, and updates the sitemap.
8. Failed builds leave the previous immutable production deployment active. OCC retries transient webhook failures.

An incomplete approved record must never be published. OCC moves it to `recovery_required` with `publication_state: failed` and a human-readable list of missing requirements.

## Website webhook

`POST https://herzenco.co/api/publish`

Headers:

```http
Authorization: Bearer <HERZENCO_PUBLISH_WEBHOOK_SECRET>
Content-Type: application/json
```

Body:

```json
{
  "event_id": "11111111-1111-4111-8111-111111111111",
  "event": "content.published",
  "property": "herzenco",
  "content_id": "22222222-2222-4222-8222-222222222222",
  "slug": "example-article",
  "occurred_at": "2026-08-14T18:00:00.000Z"
}
```

Allowed events are `content.published`, `content.updated`, `content.unpublished`, and `content.archived`. `event_id` is the idempotency key. The website returns `401` for an invalid secret, `400` for an invalid event, `202` after the deploy hook accepts it, and `502` when the deploy hook fails so OCC can retry.

The webhook must not contain article copy, approval notes, prompts, credentials, or personal information.

## Published-content pull API

`GET https://operations.herzenco.co/api/v1/content?property=herzenco&status=published`

Header:

```http
Authorization: Bearer <OCC_CONTENT_API_TOKEN>
```

Success is an unpaginated complete collection:

```json
{
  "data": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "property": "herzenco",
      "status": "published",
      "slug": "example-article",
      "title": "Example article",
      "excerpt": "A concise summary.",
      "body": "Markdown body.",
      "published_at": "2026-08-14T18:00:00.000Z",
      "updated_at": "2026-08-14T18:00:00.000Z",
      "seo": {
        "title": "Example article | Herzen Co.",
        "description": "Search description."
      },
      "hero_image": {
        "url": "https://cdn.example/hero.jpg",
        "alt": "Alternative text"
      },
      "canonical_url": "https://herzenco.co/resources/example-article/",
      "author": "Herzen Co.",
      "category": "Operations"
    }
  ]
}
```

The website must fail the build if the request fails, the response is not a `data` array, a record is outside `property: herzenco` or `status: published`, or a required public field is missing. Markdown is converted to sanitized HTML before it is written to an article page.

## Required server-only configuration

Website:

```dotenv
OCC_CONTENT_API_URL=https://operations.herzenco.co/api/v1/content
OCC_CONTENT_API_TOKEN=
HERZENCO_PUBLISH_WEBHOOK_SECRET=
VERCEL_DEPLOY_HOOK_URL=
SITE_URL=https://herzenco.co
```

OCC:

```dotenv
HERZENCO_CONTENT_API_TOKEN=
HERZENCO_PUBLISH_WEBHOOK_URL=https://herzenco.co/api/publish
HERZENCO_PUBLISH_WEBHOOK_SECRET=
CRON_SECRET=
```

`OCC_CONTENT_API_TOKEN` must exactly match `HERZENCO_CONTENT_API_TOKEN`. Both projects must use the same `HERZENCO_PUBLISH_WEBHOOK_SECRET`. All four credential or hook values are server-only and must never be exposed in browser JavaScript or committed to Git.

## Reliability and security requirements

- The OCC state transition is conditional on the prior status so overlapping cron runs cannot publish the same item twice.
- The database event is created in the same transaction as the published-state update.
- OCC retries network errors, HTTP `429`, and `5xx` responses with bounded exponential backoff; other `4xx` responses are permanent.
- Stale webhook delivery leases are recovered automatically.
- OCC stores sanitized delivery metadata, never authorization headers, request bodies, secrets, or provider response bodies.
- Unpublish, archive, and deletion events trigger a full pull so stale pages disappear.
- The website treats OCC as authoritative and always rebuilds from the complete collection rather than applying webhook data as a patch.

## Verification checklist

1. An unsigned pull request returns `401`; the website's remote production build receives `200`.
2. An unsigned webhook request returns `401`.
3. A valid signed event returns `202` and starts one deployment per `event_id` in a warm instance.
4. A published article appears in the Resources listing, at `/resources/{slug}/`, and in `sitemap.xml`.
5. Replaying the same event is harmless.
6. Unpublishing the record removes its generated page and sitemap entry on the next build.
7. No secret or private editorial field appears in logs, pages, browser assets, or deployment output.
