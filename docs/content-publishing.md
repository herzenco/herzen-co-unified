# Herzen Co. OCC publishing

The site remains static HTML, CSS, and JavaScript. Vercel runs `npm run build`,
which fetches reviewed content before deployment and generates:

- `/resources/index.html` (generated article listing inside the preserved page)
- `/resources/{slug}/index.html`

The authenticated OCC API exposes only effectively published records for property `herzenco`.
The generator removes stale generated resource pages using its manifest, leaves
manual website content untouched, and updates only the marked sitemap section.

## Vercel environment variables

Configure these for Production and Preview in the Vercel project settings:

```text
OCC_CONTENT_API_URL=https://operations.herzenco.co/api/v1/content
OCC_CONTENT_API_TOKEN=
SITE_URL=https://herzenco.co
HERZENCO_PUBLISH_WEBHOOK_SECRET=
VERCEL_DEPLOY_HOOK_URL=
```

`VERCEL_DEPLOY_HOOK_URL` is a private Vercel Deploy Hook created for the production
branch. It must never be sent to a browser or shared with the Content Engine.

## Content Engine publishing request

The Content Engine calls the public, authenticated site endpoint:

```http
POST https://herzenco.co/api/publish
Authorization: Bearer <HERZENCO_PUBLISH_WEBHOOK_SECRET>
Content-Type: application/json

{
  "event_id": "unique-event-uuid",
  "event": "content.published",
  "property": "herzenco",
  "content_id": "article-uuid",
  "slug": "article-slug",
  "occurred_at": "2026-08-14T14:00:00Z"
}
```

After validation, the function calls the private Vercel Deploy Hook. The hook
starts a new immutable deployment; the build fetches all currently published
content and generates the static pages.
