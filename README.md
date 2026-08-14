# Herzen Co. website

Static HTML/CSS/JavaScript website deployed by Vercel.

## Content Engine integration

The production build fetches published articles from the Herzen Content Engine,
generates static pages under `resources/{slug}/`, updates the Resources listing
and sitemap, runs the site checks, and assembles the `public/` deployment directory.

Required Vercel build variables:

- `OCC_CONTENT_API_URL=https://operations.herzenco.co/api/v1/content`
- `OCC_CONTENT_API_TOKEN` (server-only)
- `SITE_URL=https://herzenco.co`
- `HERZENCO_PUBLISH_WEBHOOK_SECRET` (server-only)
- `VERCEL_DEPLOY_HOOK_URL` (server-only)

Run locally:

```bash
npm install
npm test
npm run build
```

`npm run build` intentionally fails if the Content Engine cannot be reached,
returns malformed content, or returns no published articles.
