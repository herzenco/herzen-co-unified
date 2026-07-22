# Herzen Content Engine publishing

The site remains static HTML, CSS, and JavaScript. Vercel runs `npm run build`,
which fetches reviewed content before deployment and generates:

- `/resources/index.html` (generated article listing inside the preserved page)
- `/resources/{slug}/index.html`

The public API already exposes only published records for property `herzenco`.
The generator removes stale generated resource pages using its manifest, leaves
manual website content untouched, and updates only the marked sitemap section.

## Vercel environment variables

Configure these for Production and Preview in the Vercel project settings:

```text
CONTENT_ENGINE_URL=https://content.herzenco.co
SITE_URL=https://herzenco.co
PUBLISH_SECRET=
DEPLOY_HOOK_URL=
```

`DEPLOY_HOOK_URL` is a private Vercel Deploy Hook created for the production
branch. It must never be sent to a browser or shared with the Content Engine.

## Content Engine publishing request

The Content Engine calls the public, authenticated site endpoint:

```http
POST https://herzenco.co/api/publish
Authorization: Bearer <PUBLISH_SECRET>
Content-Type: application/json

{
  "propertySlug": "herzenco",
  "slug": "article-slug"
}
```

After validation, the function calls the private Vercel Deploy Hook. The hook
starts a new immutable deployment; the build fetches all currently published
content and generates the static pages.
