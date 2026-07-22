# Herzen Co. website

Static HTML/CSS/JavaScript website deployed by Vercel.

## Content Engine integration

The production build fetches published articles from the Herzen Content Engine,
generates static pages under `content/{slug}/`, updates the Resources listing
and sitemap, and runs the site checks. Vercel deploys the static repository root.

Required Vercel build variables:

- `CONTENT_ENGINE_URL=https://content.herzenco.co`
- `PUBLISH_SECRET`
- `DEPLOY_HOOK_URL`

Run locally:

```bash
npm install
npm test
npm run build
```

`npm run build` intentionally fails if the Content Engine cannot be reached or returns invalid content, preventing an incomplete production build.
