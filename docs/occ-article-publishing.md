# OCC article publishing

The Operations Command Center (OCC) is the source of truth for Herzen Co. resource articles. OCC sends its frozen, human-approved website package to the website publishing endpoint. The endpoint validates that package, queues an immutable Vercel deployment, and returns the article's final URL. The build then pulls the complete published resource collection from OCC so the static site can be rebuilt deterministically.

## Runtime flow

1. OCC sends the authenticated `schema_version: 1` approved website package to `POST https://herzenco.co/api/publish`.
2. The website validates the shared secret, idempotency key, approved content hash, destination, article fields, and canonical path.
3. The website calls a private Vercel Deploy Hook and returns the final `/resources/{slug}/` URL to OCC.
4. OCC records the item as published and the Vercel build requests the complete published set from `GET /api/v1/content-items?property=herzen-co&status=published`.
5. The generator replaces the marked listing in `resources/index.html`, creates `/resources/{slug}/index.html`, removes previously generated stale pages, and updates the marked sitemap section.
6. A failed content request or invalid OCC payload fails the build, leaving the prior immutable production deployment active.

## Website environment variables

Configure these as server-only Vercel variables in both Preview and Production:

```dotenv
OCC_CONTENT_API_URL=https://operations.herzenco.co/api/v1/content-items
OCC_CONTENT_API_TOKEN=
HERZENCO_PUBLISH_WEBHOOK_SECRET=
VERCEL_DEPLOY_HOOK_URL=
SITE_URL=https://herzenco.co
```

`HERZENCO_PUBLISH_WEBHOOK_SECRET` must equal OCC's `WEBSITE_PUBLISHING_WEBHOOK_SECRET`. `OCC_CONTENT_API_TOKEN` must be a current OCC machine credential with `occ:read` scope. Never expose either value in browser code.

The repository sets `"framework": null` in `vercel.json` deliberately. This is a static project using a custom build command and must remain on Vercel's **Other** framework preset; do not add Next.js as a workaround for framework-detection errors.

## Webhook contract

The endpoint accepts OCC's frozen `schema_version: 1` website publication payload for `content_type: article` and `destination: resource_library`. It validates the content UUID, idempotency key, SHA-256 approved content hash, title, body, SEO fields, URL-safe slug, canonical resource path, published status, and OCC source marker. Accepted payloads return HTTP 202 with `final_url`, `published_at`, and `publishing_status`. Transient deployment-hook failures return HTTP 502 so OCC can retry.

Deduplication prevents duplicate deploy-hook calls for the same idempotency key within the same warm serverless instance. OCC remains responsible for durable attempt auditing. Vercel deployments are immutable, so an occasional duplicate delivery is safe but may cause a redundant build.

## Preview verification

1. Configure preview-only credentials and a preview deploy hook.
2. Run `npm test` locally.
3. Publish a non-production approved website package through OCC or send the frozen package with non-production credentials.
4. Confirm the preview deployment lists the article, renders its Markdown safely, includes analytics tags, and updates the sitemap.
5. Unpublish the test record and confirm the next preview deployment removes its page and sitemap entry.
