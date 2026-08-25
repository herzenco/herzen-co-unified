# Codex Work Log

> Last updated: 2026-08-25 | Session #1 | Agent: Codex

## Purpose and evidence boundary

This is the persistent handoff record for the Herzen Co. website. It documents the observable work performed on the repository from the original marketing-site build through the current production deployment.

The history below was reconstructed from:

- the complete local Git history across all available branches;
- the current `origin/main` production history;
- `.codex/work-journal/*.jsonl` evidence from August 7–25, 2026;
- dated project reports committed in the repository;
- current source code, tests, configuration, and documentation;
- recorded Vercel build, deployment, and live-site verification results.

Where old work was later removed, superseded, left on a branch, or reverted by a newer production deployment, that distinction is stated explicitly. No secret values are recorded here.

## Project Overview

Herzen Co. is a static, multi-page marketing website for product leadership, custom digital projects, and project-management support. Its primary business goal is lead generation.

The current public positioning is centered on embedded product leadership for teams dealing with execution chaos. The primary commercial offer starts at `$2,000/month`; custom builds and larger project-management engagements are secondary, scoped services.

Production is hosted on Vercel. The canonical public origin is:

```text
https://www.herzenco.co
```

The repository is:

```text
https://github.com/herzenco/herzen-co-unified.git
```

The linked Vercel project is `herzen-co-unified` under the `herzens-projects` team.

## Current State

As of August 25, 2026:

- `origin/main` and the local branch `codex/fix-google-ads-canonical` resolve to commit `8ddbfa6` (`Align canonical URLs with www host`).
- The latest observed main-branch Vercel production deployment was `herzen-co-unified-dm0m6b5ij-herzens-projects.vercel.app`, and it reached `READY`.
- `https://www.herzenco.co/FreeDeliveryMap/` returns HTTP `200`.
- The live Free Delivery Map page declares the exact `www` URL in its canonical tag, `og:url`, and structured data.
- The apex host redirects to `www`. Vercel's domain-level response is currently HTTP `307`, even though `vercel.json` also contains a permanent host redirect rule.
- All 12 authored public pages and the 404 page include Google Tag Manager `GTM-K9SZRQ94` and Google Ads tag `AW-11011556680`.
- Mixpanel loads immediately and anonymously from the shared browser script. Vercel Web Analytics remains installed.
- The contact form submits through `/api/inquiry` and creates a lead in the Operations Command Center (OCC) only after server-side validation and authentication.
- OCC-backed Resources publishing is deployed. A webhook triggers a Vercel build, and the build pulls the complete authoritative set of published content from OCC.
- The Resources collection currently generates zero published articles when OCC returns an empty collection; the page shows its empty state.
- The Free Delivery Map campaign page is deployed and indexed in the sitemap.
- The source and live site currently use the older Calendly destination `https://calendly.com/herzenco/xyren-discover`. The intended replacement commit `06494b3` changed links to `https://calendly.com/herzenco/herzen-co-intro-call`, but that commit was never merged into `main` and was replaced in production by the August 25 main deployment.
- The working tree was clean before this documentation file was created.

## Tech Stack

| Area | Current implementation |
|---|---|
| Front end | Static HTML, shared CSS, and vanilla JavaScript |
| Hosting | Vercel |
| Runtime APIs | Vercel Functions in `api/*.mjs` |
| Build runtime | Node.js 24.x on Vercel |
| Package manager | npm |
| Content rendering | `marked` plus `sanitize-html` |
| Behavioral analytics | Mixpanel browser SDK |
| Aggregate analytics | Vercel Web Analytics |
| Tag management | Google Tag Manager `GTM-K9SZRQ94` |
| Advertising | Google Ads tag `AW-11011556680` |
| Lead system of record | Operations Command Center |
| Resource content source of truth | Operations Command Center |
| Automated tests | Node.js built-in test runner |
| Fonts | Newsreader and Jost |
| Canonical host | `https://www.herzenco.co` |

The site does not currently use a front-end framework, a CDP, client-side Supabase, or a website database.

## Public Routes

| Route | Purpose and current state |
|---|---|
| `/` | Homepage; leads with product leadership and embedded execution positioning. |
| `/product-leadership/` | Primary service page; fractional product leadership and `$2,000/month` starting point. |
| `/custom-builds/` | Scoped custom-project engagements for complex digital initiatives. |
| `/pricing/` | Product-leadership starting price plus custom/scoped engagement framing. |
| `/process/` | Discovery, prioritization, operating cadence, and delivery process. |
| `/resources/` | OCC-managed resource collection and generated article index. |
| `/resources/{slug}/` | Generated sanitized article pages when OCC has published content. |
| `/faq/` | Answer-ready sales and service questions. |
| `/glossary/` | Product-leadership definitions with `DefinedTermSet` structured data. |
| `/about/` | Company point of view and founder positioning. |
| `/contact/` | On-site inquiry form plus Calendly scheduling CTA. |
| `/meeting-booked/` | Booking confirmation page; `noindex,nofollow`. |
| `/FreeDeliveryMap/` | Focused Google Ads/campaign landing page with no site navigation and repeated scheduling CTA. |
| `/404.html` | Branded recovery page; `noindex`. |

## Current Architecture

### Static build and deployment

The production build runs:

```text
npm run sync-content
npm test
npm run prepare-public
```

`scripts/prepare-public.mjs` rebuilds `public/` from 18 required static entries and creates `public/assets/js/mixpanel-config.js` from the environment-appropriate Mixpanel token. A missing analytics token fails the build intentionally.

`vercel.json` pins the framework to `null`/Other, uses `npm run build`, and deploys `public/`. Pinning the framework was necessary because an earlier remote build incorrectly selected the Next.js builder.

### Inquiry flow

1. A visitor completes the form on `/contact/`.
2. `assets/js/main.js` validates browser constraints, preserves attribution, and sends JSON to `/api/inquiry`.
3. `api/inquiry.mjs` enforces JSON content type, a 24 KB size limit, a honeypot, field normalization, and an in-memory limit of five requests per IP per ten minutes.
4. The function authenticates to OCC through `/auth/token` using server-only integration credentials.
5. The function posts the normalized lead to OCC `/leads` with a bearer access token.
6. A `401` from the lead endpoint triggers one forced token refresh and retry.
7. Only an accepted OCC response produces website HTTP `201` and a success message.
8. Errors return safe status codes without logging visitor names, email addresses, phone numbers, or inquiry text.

Current server-only inquiry variables:

```text
OCC_API_URL
OCC_INTEGRATION_EMAIL
OCC_INTEGRATION_PASSWORD
OCC_PROPERTY_ID
```

### OCC Resources publishing flow

1. OCC sends an identifier-only event to `POST /api/publish` with a shared bearer secret.
2. `api/publish.mjs` validates UUIDs, property, slug, event name, timestamp, authorization, and optional idempotency-key consistency.
3. The function triggers a private Vercel Deploy Hook and returns `202` only when the hook accepts the request.
4. Warm-instance deduplication avoids repeating the same deploy for the same event ID; OCC remains the durable retry authority.
5. During the immutable build, `scripts/sync-content.mjs` calls the authenticated OCC content endpoint for the complete `property=herzenco&status=published` collection.
6. The build validates every returned item, converts Markdown to sanitized HTML, generates resource articles, updates the Resources listing and sitemap, and removes stale generated pages.
7. A failed or malformed OCC response fails closed so the previous immutable production deployment remains live.

Current server-only publishing variables:

```text
OCC_CONTENT_API_URL
OCC_CONTENT_API_TOKEN
HERZENCO_PUBLISH_WEBHOOK_SECRET
VERCEL_DEPLOY_HOOK_URL
SITE_URL
```

### Analytics flow

Google Tag Manager and Google Ads are installed directly in every authored HTML page. The shared browser script separately loads Mixpanel and Vercel Web Analytics.

Mixpanel configuration is generated at build time from:

```text
MIXPANEL_PRODUCTION_TOKEN
MIXPANEL_DEVELOPMENT_TOKEN
```

Mixpanel is anonymous:

- no `identify()` or user profiles;
- `ip: false` during initialization;
- no names, email addresses, phone numbers, inquiry messages, or other direct PII in events;
- global properties are `platform: web` and the build environment;
- active time only increments when the document is visible and focused;
- engagement is sent once on page hide/leave;
- scroll thresholds fire once per threshold per page.

Current Mixpanel events found in `assets/js/main.js`:

| Event | Purpose |
|---|---|
| `page_viewed` | Page view with route, page type, title, referrer domain, and available UTM values. |
| `scroll_depth_reached` | First reach of 25%, 50%, 75%, and 100%. |
| `active_time_reached` | Active-time milestones at 15, 30, 60, and 120 seconds. |
| `page_engagement_completed` | Final active seconds and maximum scroll depth. |
| `navigation_clicked` | Header/footer navigation. |
| `mobile_menu_toggled` | Mobile menu opened or closed. |
| `outbound_link_clicked` | External destination clicks. |
| `resource_opened` | Resource article link opened. |
| `resource_read_completed` | Resource article reaches at least 30 active seconds and 90% scroll depth. |
| `inquiry_started` | First interaction with the inquiry form. |
| `inquiry_submitted` | OCC-confirmed inquiry delivery, with service interest but no PII. |
| `lead_cta_clicked` | Contact or Calendly CTA click. |

Vercel Web Analytics also receives `Lead Form Submitted` and `Lead CTA Clicked` custom events.

## File Map

| Path | Responsibility |
|---|---|
| `index.html` | Homepage and Organization structured data. |
| `*/index.html` | Static route documents. |
| `FreeDeliveryMap/index.html` | Standalone campaign landing page. |
| `assets/css/styles.css` | Entire shared visual system and responsive layout. |
| `assets/js/main.js` | Navigation, analytics, attribution, form handling, and CTA instrumentation. |
| `assets/brand/` | Official logo system exports. |
| `assets/img/` | Founder photography, campaign image, mobile LCP image, and favicon source. |
| `api/inquiry.mjs` | Server-side OCC lead delivery. |
| `api/publish.mjs` | OCC publication-event receiver and deploy-hook trigger. |
| `scripts/sync-content.mjs` | Build-time OCC content pull and article/listing/sitemap generation. |
| `scripts/prepare-public.mjs` | Static output packaging and Mixpanel runtime config generation. |
| `tests/site.test.mjs` | Sitewide SEO, brand, analytics, accessibility, page, route, and regression contract. |
| `tests/inquiry.test.mjs` | Inquiry validation, spam, auth refresh, rate-limit, and OCC lead tests. |
| `tests/content-publishing.test.mjs` | Webhook, content pull, sanitization, generation, cleanup, and sitemap tests. |
| `sitemap.xml` | Canonical public route list plus generated Resources marker region. |
| `robots.txt` | Crawl permission and canonical sitemap reference. |
| `llms.txt` | Public entity and offer summary for AI/LLM discovery. |
| `site.webmanifest` | Basic install metadata and icon. |
| `vercel.json` | Static build/output and host-redirect configuration. |
| `.github/workflows/deploy-qa.yml` | `development` branch QA deployment workflow. |
| `docs/design-system/` | Official logo system, export archive, and usage rules. |
| `docs/occ-article-publishing.md` | Current resource-publishing contract. |
| `docs/operational-command-center-inquiry-integration.md` | Original inquiry architecture proposal; parts are now stale relative to the implemented `/auth/token` + `/leads` flow. |
| `AGENTS.md` | Analytics rules and project-specific agent constraints. |

## Complete Work History

### June 23, 2026 — planning

- Wrote the static marketing-site implementation plan.
- Chose folder-based routes with an `index.html` per route, one shared stylesheet, and minimal JavaScript.
- Defined SEO/AEO requirements: focused titles, descriptions, canonical URLs, Open Graph data, JSON-LD, one H1 per page, `robots.txt`, `sitemap.xml`, `llms.txt`, and a web manifest.
- Wrote an editorial homepage refresh plan intended to reduce generic card-heavy/machine-like copy and introduce a quieter founder-studio presentation.

### July 1, 2026 — initial launch, QA, and Vercel Analytics

- Created the original static marketing site in commit `0fe3182` with the homepage, product leadership, custom builds, pricing, process, resources, FAQ, about, and contact pages.
- Added the first shared design system in `assets/css/styles.css`, shared behavior in `assets/js/main.js`, founder photography, campaign imagery, favicon, crawler files, manifest, package configuration, and the first 126-line site test.
- Initial repository content also included Supabase middleware/client/server utilities and `middleware.ts`; those were later removed when the project was corrected to a purely static site.
- Created a GitHub Actions QA deployment in `4a4a85b`, ignored the local Vercel project link in `f4afc68`, and added Vercel Web Analytics in `80dd16a`.
- A separate branch commit `a98cafc` removed the QA workflow, but that removal did not become part of current `main`; the QA workflow is present today.

### July 10, 2026 — homepage and early lead-capture experiment

- Branch-only commit `6bfbf23` broadly refined homepage and service copy, expanded shared CSS/JS, and added an early `api/leads.js` flow, a downloadable product-system audit checklist, a resource landing page, `thank-you/`, and lead-capture documentation.
- This experiment is not part of current production. The current lead implementation is `api/inquiry.mjs` and OCC `/leads`; the early download/thank-you assets are absent from the current tree.

### July 19–21, 2026 — local website passes and brand work

- Dated reports show wide uncommitted passes across homepage, about, contact, services, FAQ, pricing, process, resources, shared CSS/JS, metadata, tests, and a new logo asset.
- A July 19 report recorded 361 tracked insertions and 105 deletions plus untracked API, downloads, thank-you, and lead-capture documentation. No executed test evidence was found for that date.
- A July 21 report recorded 13 local changes across site pages, shared CSS, tests, `.gitignore`, and an untracked logo asset. No commit or test run was discoverable for that report.
- Branch commit `85f5fc9` refined pricing and Resources but remained on `development`, not production `main`.

### July 21–22, 2026 — official brand system and first content-publishing architecture

- `d1365b6` added the official Herzen Co. logo system, PDF guide, PNG export archive, updated every public page to the approved logo treatment, and introduced the first branded static content publisher.
- Added publishing configuration, `api/publish.mjs`, a large build-time content synchronizer, content tests, and Vercel config.
- `aa9cc68` shifted Resources generation toward the Content Engine, added `scripts/prepare-public.mjs`, fixtures, and removed the initial Supabase/middleware application layer.
- `d4b6f5d` made Resources explicitly Content Engine driven.
- `3b61abd` corrected Vercel static output and removed remaining middleware/Supabase remnants and unnecessary packages.
- `4285416`, merge commit `22acce7`, and `236a5e7` reconciled and fixed production content publishing, build packaging, tests, docs, and sitemap behavior.
- `8914f0d`, `5d799cc`, and merged result `dc6159e` refined Resources copy and implemented website-audit improvements across metadata, canonical domains, 404 handling, crawler files, and public-page copy.

### July 25, 2026 — expanded Mixpanel instrumentation

- Expanded consent-gated Mixpanel coverage for navigation, outbound links, mobile-menu interactions, inquiry starts, resource opens, active-time milestones, and completed resource reads.
- Confirmed analytics payloads remained anonymous and excluded direct PII.
- Validation evidence: `node --check assets/js/main.js`, 13 passing tests, and a clean `git diff --check`.
- The explicit consent gate was later removed on August 4; the event coverage largely remained.

### August 4, 2026 — analytics and inquiry-system overhaul

- `c595493` refreshed the site architecture, analytics, copy, styling, images, and inquiry flow.
- Added the current `api/inquiry.mjs` foundation and its tests.
- Reworked `assets/js/main.js` extensively for Mixpanel, Vercel Analytics, attribution, forms, mobile navigation, and CTA behavior.
- Added the glossary route, optimized mobile founder image, current OCC inquiry documentation, and project/analytics notes.
- Removed the then-current content-publishing implementation and tests; Resources publishing was restored with a new OCC contract later in August.
- `2b823a0` removed the analytics consent UI/gate and made analytics load immediately on every page, matching the current project rule.

### August 7, 2026 — repository recovery, meeting confirmation, and Google Ads tag

- Repaired the local Website workspace shortcut after a project reorganization.
- Determined the active folder initially lacked a usable repository and that redeploying an older archive could remove newer production work.
- Restored tracked commit `2b823a0` from the recovery archive while excluding local secrets and stale untracked Content Engine files.
- Imported the live meeting-booked page into source, included it in packaging/tests, and preserved it as `meeting-booked/index.html`.
- Installed Google Ads tag `AW-11011556680` in all 12 deployed HTML documents while retaining GTM.
- Created commit `c04b3cf` (`Install Google Ads tag site-wide`).
- Deployed Vercel production deployment `dpl_BD53uqvSP5hjuZmcYjLUQynwAyzu`, which reached `READY`, passed all six tests, and prepared 17 static entries.
- Verified homepage and meeting-booked returned `200`, each contained one Ads loader/config call, and `/api/inquiry` remained active by returning the expected `405` for GET.

### August 12, 2026 — Free Delivery Map campaign development

- Created `/FreeDeliveryMap/` as a no-navigation campaign landing page with only the home logo/skip target and Calendly as outbound destinations.
- Added campaign packaging, sitemap inclusion, route classification, CTA tracking, and regression tests.
- Iterated repeatedly on the offer and copy:
  - initially centered the 30-minute live Delivery Map working session;
  - repositioned the `$2,000/month` fractional product/project-management subscription as the primary paid offer;
  - sharpened the copy into a direct founder-led voice;
  - made the operational pain, priorities, cuts, ownership, and expected outcomes concrete;
  - later removed early price emphasis from the hero and used the free Delivery Map as the booking incentive.
- Iterated repeatedly on design:
  - replaced bespoke widths, hard borders, offset shadows, and off-system color blocks;
  - adopted shared containers, gutters, section spacing, hairline borders, typography, white panels, ink bands, and approved horizontal logos;
  - simplified the hero from a competing two-column layout to a direct service message;
  - added founder photography on desktop;
  - improved the Delivery Map explanation and made the closing CTA high contrast.
- Added tests for shared container widths, hairline borders, 34px horizontal campaign logo treatment, and closing-section design.
- Each recorded revision passed six automated tests and `git diff --check`.
- Production deployment `dpl_BBUbHUR7nyQm4jt4y24iAenW5TyY` reached `READY` and was aliased to `www.herzenco.co`.
- Verified the live campaign returned `200`, showed the approved headline and founder image, and contained both Calendly CTAs.

### August 14, 2026 — OCC article-publishing implementation and diagnosis

- Implemented authenticated OCC-driven website publishing in `api/publish.mjs` and `scripts/sync-content.mjs`.
- Chose an identifier-only webhook plus full build-time pull rather than accepting article bodies through the webhook.
- Added validation, idempotency behavior, deploy-hook triggering, complete collection pulls, generated article pages, listing and sitemap updates, stale-page removal, and Markdown sanitization.
- Added 14-test coverage for webhook auth, validation, retries, deduplication, pull authentication, filtering, generation, cleanup, sitemap behavior, sanitization, inquiry flow, and site checks.
- Pinned `framework: null` after Vercel incorrectly selected Next.js.
- A production-target candidate reached the live OCC endpoint but failed because OCC returned HTTP `500`; diagnosis pointed to a PostgREST relationship ambiguity in the OCC codebase.
- Production was intentionally not replaced by the failed candidate.
- Branch commit `2739320` captured one version of the integration but was later superseded by the August 20 contract work.

### August 20, 2026 — contact release, Resources contract repair, and campaign production work

- Split the release so verified contact/OCC lead fixes could reach production without shipping a broken Resources build.
- Confirmed the old live site had an incorrect `.com` mail link and mailto-based form; deployed the verified on-site/OCC-backed form instead.
- Fast-forwarded production through `c04b3cf` while holding later Resources work until its OCC credential/endpoint problems were resolved.
- Production deployment `herzen-co-unified-1pt7jsmbq-herzens-projects.vercel.app` reached `READY`; the earlier direct artifact `a04ado60q` was also ready.
- Verified the contact page returned `200`, the form posted to `/api/inquiry`, `hello@herzenco.co` was present, the old mailto behavior was gone, and GET `/api/inquiry` returned `405`.
- Audited the live OCC-to-Resources chain and found multiple moving blockers: outdated URLs/tokens, missing website `/api/publish`, no OCC cron jobs, unpublished approval state, and a temporary split contract between OCC and website code.
- `3616243` restored the publishing implementation, and `6814ef4` aligned it with OCC's actual identifier-only webhook and `property=herzenco` pull response.
- Deployed a prebuilt Free Delivery Map artifact after a normal deployment failed in unrelated OCC sync. The campaign itself passed and returned `200` in production.
- Created the clean `codex/free-delivery-map-production` branch from updated `origin/main`, applied the campaign as `ac96d42`, pushed it, closed superseded PR #7, and opened draft PR #8.
- Finished the OCC publishing alignment, passed all 14 tests, verified a signed canary event returned `202`, and confirmed the triggered production build succeeded with an empty authoritative article collection.
- Pushed through `b7fbb96` and deployed Resources publishing in Vercel deployment `dpl_J6o11kBxUjKw93Hip6qQfarGVP9h`.
- Sent one clearly labeled synthetic inquiry through production; the site returned `201` only after OCC accepted the lead.

### August 24, 2026 — campaign merge and Calendly URL update

- Used an isolated Git worktree to validate `origin/main` plus the Free Delivery Map commit without disturbing unrelated workspace files.
- Passed all 14 tests and static packaging; traced the old PR preview failure to missing Preview-scoped OCC credentials rather than campaign code.
- Marked PR #8 ready and merged it into `main` as merge commit `d93ca31`.
- Vercel deployment `herzen-co-unified-iugy9tk4n-herzens-projects.vercel.app` reached `READY`; apex redirected to `www`, and `/FreeDeliveryMap/` returned `200` with the expected campaign.
- Replaced 11 visible booking links across process, pricing, contact, product leadership, custom builds, and Free Delivery Map with `https://calendly.com/herzenco/herzen-co-intro-call`.
- Updated Mixpanel CTA matching, inquiry documentation, test expectations, and the authored-source scan.
- Created and pushed commit `06494b3` (`Update Calendly booking links`) on `codex/free-delivery-map-production`.
- Vercel branch deployment `dpl_kR7n6o2krNvCqGQtGY9dZJMtpvqc` reached `READY`, passed all 14 tests, showed 11 new intro-call links, and had no recorded production errors at that time.
- Important current-state correction: `06494b3` was not merged into `main`. The August 25 production deployment from `main` restored the old `xyren-discover` links, which are live now.

### August 25, 2026 — Google Ads destination/canonical repair

- Investigated Google Ads destination failures against the live Free Delivery Map page.
- Verified that `www` served HTTP `200`, apex redirected to `www`, but the delivered canonical tag, `og:url`, structured data, sitemap, robots reference, publishing defaults, and other absolute URLs pointed back to apex.
- Chose `www.herzenco.co` as the one canonical host because it matches the actual serving host and Google Ads final URL.
- Updated canonical and Open Graph URLs, absolute image URLs, JSON-LD, sitemap, robots, `llms.txt`, `.env.example`, publishing code, tests, and documentation across 22 files.
- Added URL normalization so a stale `SITE_URL=https://herzenco.co` environment value still emits `www` publishing URLs.
- Added a source-controlled apex-to-`www` permanent redirect rule in `vercel.json` and regression coverage for it.
- Restored `.vercel` exclusion in the authored-file test scan after moving the work onto current production `main`; otherwise stale ignored build output caused a false test failure.
- Ran all 14 tests successfully in both the default environment and with the old apex `SITE_URL` value.
- Built an isolated production-target Vercel deployment successfully before changing live traffic.
- Created commit `8ddbfa6` (`Align canonical URLs with www host`), pushed the feature branch, and fast-forwarded `origin/main`.
- Main-branch Vercel deployment `herzen-co-unified-dm0m6b5ij-herzens-projects.vercel.app` reached `READY`.
- Verified the live Free Delivery Map page returned `200` and served `www` canonical, `og:url`, and structured-data URLs.
- The apex host still responds with Vercel's domain-level `307` redirect before the source-controlled `308` rule executes. The canonical mismatch that triggered the Google issue is nevertheless resolved.
- Google Ads destination review/re-submission remains an account-side step.

### August 25, 2026 — work-log creation

- Reconstructed the entire observable repository history and created this `Codex-work.md` handoff at the user's requested filename.
- Compared all available branches with production `main`, all August project journals, dated reports, current source, tests, configuration, and recorded deployments.
- Identified the unmerged Calendly commit and confirmed the live site currently uses the older `xyren-discover` destination.
- Documented current architecture, historical work, decisions, validation, deployments, superseded work, known issues, and prioritized next steps.

## Full Git Ledger

The table includes every commit visible in the local repository, including branch-only and superseded work.

| Date | Commit | Summary | Current relationship |
|---|---|---|---|
| 2026-07-01 | `0fe3182` | Launch Herzen Co marketing site | In `main`; original static site. |
| 2026-07-01 | `4a4a85b` | Set up QA deployment environment | In `main`; workflow remains present. |
| 2026-07-01 | `f4afc68` | Ignore local Vercel project link | In `main`. |
| 2026-07-01 | `80dd16a` | Add Vercel Analytics package | In `main`; still active. |
| 2026-07-01 | `e01cf54` | Merge pull request #1 from `development` | In `main`. |
| 2026-07-01 | `a98cafc` | Remove QA deployment environment | Branch-only; not in current `main`. |
| 2026-07-10 | `6bfbf23` | Refine homepage and lead capture | Branch-only experiment; not current production. |
| 2026-07-20 | `85f5fc9` | Refine pricing and resources pages | `origin/development`; not current `main`. |
| 2026-07-21 | `d1365b6` | Add branded static content publishing | In `main`; official brand assets remain. |
| 2026-07-21 | `aa9cc68` | Generate resources from Content Engine | In `main`; architecture later replaced. |
| 2026-07-22 | `d4b6f5d` | Make Resources Content Engine driven | In `main`; later replaced. |
| 2026-07-22 | `3b61abd` | Fix Vercel static output | In `main`; removed middleware/Supabase remnants. |
| 2026-07-22 | `4285416` | Reconcile production content publishing | In `main`; reconciliation commit. |
| 2026-07-22 | `22acce7` | Merge PR #2 from static-content-publishing | In `main`. |
| 2026-07-22 | `236a5e7` | Fix resource content publishing (#3) | In `main`; later superseded. |
| 2026-07-22 | `8914f0d` | Refine Resources page copy | Branch commit; incorporated through later PR work. |
| 2026-07-22 | `5d799cc` | Implement website audit improvements | Branch commit; incorporated through `dc6159e`. |
| 2026-07-22 | `dc6159e` | Refine Resources page copy (#4) | In `main`; includes audit improvements. |
| 2026-08-04 | `c595493` | Refresh site analytics and inquiry flow | In `main`; basis of current inquiry/analytics architecture. |
| 2026-08-04 | `2b823a0` | Load analytics without consent gate | In `main`; current behavior. |
| 2026-08-07 | `79f5d97` | Add meeting booking confirmation page | Branch commit; page imported into later production source. |
| 2026-08-07 | `c04b3cf` | Install Google Ads tag site-wide | In `main`; Ads tag remains active. |
| 2026-08-14 | `2739320` | Complete OCC website publishing integration | Branch-only version; superseded by August 20 contract. |
| 2026-08-20 | `3616243` | Restore OCC resource publishing | In `main`; current publishing foundation. |
| 2026-08-20 | `6814ef4` | Align Resources publishing with OCC contract | In `main`; current identifier-only/full-pull contract. |
| 2026-08-20 | `907cd26` | Add Free Delivery Map landing page | Duplicate branch commit; not the production lineage. |
| 2026-08-20 | `ac96d42` | Add Free Delivery Map landing page | In `main`; production campaign lineage. |
| 2026-08-20 | `b7fbb96` | Document direct OCC webhook endpoint | In `main`. |
| 2026-08-24 | `d93ca31` | Merge PR #8 for Free Delivery Map | In `main`. |
| 2026-08-24 | `06494b3` | Update Calendly booking links | Branch-only; deployed temporarily, not merged, currently absent from production. |
| 2026-08-25 | `8ddbfa6` | Align canonical URLs with www host | Current `origin/main` and production source. |

## Key Decisions

1. **Keep the website static.** Plain HTML/CSS/JavaScript provides fast, crawlable pages and a small operational surface. Vercel Functions are used only for private server-side integration endpoints.
2. **Lead with product leadership.** Product leadership is the primary offer; custom builds and project-management engagements support it rather than competing equally in the hierarchy.
3. **Use the official horizontal logo system.** Headers use `logo-1a-black.png`, footers use `logo-1a-white.png`, and the old vertical lockups remain archived but are not rendered.
4. **Use a warm editorial design system.** Newsreader, Jost, paper/ink/clay tokens, generous spacing, restrained borders, founder photography, and lower card density replaced a heavier generic layout.
5. **Keep analytics anonymous and client-side.** Mixpanel, Vercel Web Analytics, GTM, and Google Ads are allowed; no additional analytics system should be added without approval.
6. **Load analytics immediately.** The explicit consent gate was removed on August 4, matching the current requirement that analytics load on every page.
7. **Never send inquiry PII to analytics.** Names, emails, phones, companies, and messages remain limited to the secure website-to-OCC lead flow.
8. **Keep contact conversion on the site.** The primary form posts to `/api/inquiry` rather than opening an email client.
9. **OCC is the inquiry system of record.** Website success is shown only after OCC accepts a lead.
10. **OCC is the resource-content source of truth.** The website never trusts article bodies in webhooks and regenerates from the complete published collection during a build.
11. **Fail closed on content errors.** A bad OCC response fails a new build, leaving the prior immutable production deployment active.
12. **Use identifier-only publishing webhooks.** Webhook payloads carry event and content identifiers, not editorial copy or private notes.
13. **Use `www` as the canonical host.** It matches the actual serving host and the Google Ads final URL. All public URL signals should use it consistently.
14. **Do not depend on cross-host redirects for authenticated POSTs.** OCC webhook configuration must use the direct `www` URL because authorization headers may be lost across host redirects.
15. **Keep the Free Delivery Map page conversion-focused.** It intentionally omits normal navigation and repeats one scheduling action.
16. **Separate unrelated blockers from safe releases.** Contact and campaign changes were deployed independently when OCC content synchronization was broken.
17. **Do not knowingly replace production with a failing build.** Failed candidates were not promoted; prebuilt or isolated production-target validation was used where appropriate.

## Validation History

Current automated test coverage includes:

- existence of all required pages and assets;
- titles, descriptions, canonical URLs, Open Graph tags, JSON-LD, and one H1 per page;
- canonical `www` usage and rejection of apex or old `.com` website URLs;
- official logo and favicon rules;
- versioned shared CSS and JS;
- image dimensions and responsive/LCP behavior;
- accessibility of mobile navigation and form status;
- 404 recovery and `noindex` behavior;
- Google Tag Manager and Google Ads installation on every page;
- anonymous Mixpanel event coverage and exclusion of form PII;
- Free Delivery Map navigation restrictions, styling, and CTA count;
- inquiry validation, honeypot behavior, rate limiting, authentication, retry, and safe failure;
- publication webhook auth, validation, idempotency, retryability, and safe event payloads;
- OCC full-collection pull authentication and filtering;
- Markdown sanitization;
- generated article/listing/sitemap behavior and stale-page cleanup;
- Vercel redirect configuration.

Most recent evidence:

- `npm test`: 14 passed, 0 failed on August 25.
- `SITE_URL=https://herzenco.co npm test`: 14 passed, 0 failed on August 25.
- Isolated Vercel production-target build: all 14 tests and all build steps passed.
- Main Vercel deployment: `READY`.
- Live Free Delivery Map: HTTP `200` with corrected `www` canonical/OG/schema URLs.

## Deployment History

| Date | Deployment | Outcome |
|---|---|---|
| 2026-08-07 | `dpl_BD53uqvSP5hjuZmcYjLUQynwAyzu` | `READY`; Google Ads tag deployed; six tests passed. |
| 2026-08-12 | `dpl_BBUbHUR7nyQm4jt4y24iAenW5TyY` | `READY`; first recorded Free Delivery Map production deployment. |
| 2026-08-14 | `herzen-co-unified-3wpqozwju-herzens-projects.vercel.app` | Candidate failed because OCC returned HTTP `500`; not promoted. |
| 2026-08-20 | `a04ado60q` | Direct verified contact artifact; `READY`. |
| 2026-08-20 | `herzen-co-unified-1pt7jsmbq-herzens-projects.vercel.app` | Git production contact release; `READY`. |
| 2026-08-20 | `dpl_546CE4PkK1XunCAnEzbxnzLevnRm` | Failed in unrelated OCC content sync with HTTP `400`. |
| 2026-08-20 | `dpl_ALybS3EfTkT7NqNgNLu57iUB3nLw` | Prebuilt campaign deployment; `READY` and aliased to production. |
| 2026-08-20 | `dpl_J6o11kBxUjKw93Hip6qQfarGVP9h` | OCC Resources publishing integration; `READY`. |
| 2026-08-24 | `herzen-co-unified-iugy9tk4n-herzens-projects.vercel.app` | PR #8 main deployment; `READY`. |
| 2026-08-24 | `dpl_kR7n6o2krNvCqGQtGY9dZJMtpvqc` | Calendly feature-branch deployment; `READY`, but its commit was not merged. |
| 2026-08-25 | `herzen-co-unified-7o3o3s2cb-herzens-projects.vercel.app` | Preview failed because Preview lacks OCC content variables. |
| 2026-08-25 | `herzen-co-unified-ppplglsko-herzens-projects.vercel.app` | Isolated production-target validation; `READY`. |
| 2026-08-25 | `herzen-co-unified-dm0m6b5ij-herzens-projects.vercel.app` | Current recorded main production deployment; `READY`. |

## Environment and Configuration

Never commit real values. Required names are documented in `.env.example`.

| Variable | Scope | Purpose |
|---|---|---|
| `SITE_URL` | Build/server | Canonical public origin; should be `https://www.herzenco.co`. |
| `OCC_CONTENT_API_URL` | Server/build | Complete published-content pull endpoint. |
| `OCC_CONTENT_API_TOKEN` | Server/build | Bearer token for the OCC content pull. |
| `HERZENCO_PUBLISH_WEBHOOK_SECRET` | Server | Shared bearer secret for `/api/publish`. |
| `VERCEL_DEPLOY_HOOK_URL` | Server | Private deploy hook triggered by accepted publication events. |
| `OCC_API_URL` | Server | OCC base API for inquiry authentication and lead creation. |
| `OCC_INTEGRATION_EMAIL` | Server | OCC integration login identity. |
| `OCC_INTEGRATION_PASSWORD` | Server | OCC integration password. |
| `OCC_PROPERTY_ID` | Server | Herzen Co. property UUID for new leads. |
| `MIXPANEL_PRODUCTION_TOKEN` | Build/public output | Production Mixpanel project token. |
| `MIXPANEL_DEVELOPMENT_TOKEN` | Build/public output | Development/Preview Mixpanel project token. |
| `VERCEL_TOKEN` | GitHub Actions secret | QA workflow authorization. |

## External Resources

- Production site: `https://www.herzenco.co`
- Google Ads landing page: `https://www.herzenco.co/FreeDeliveryMap/`
- OCC: `https://operations.herzenco.co`
- GitHub repository: `https://github.com/herzenco/herzen-co-unified`
- Vercel project: `herzens-projects/herzen-co-unified`
- Google Tag Manager: `GTM-K9SZRQ94`
- Google Ads account tag: `AW-11011556680`
- Mixpanel project noted in `PROJECT-BRIEF.md`: `4047259`
- Intended new Calendly destination: `https://calendly.com/herzenco/herzen-co-intro-call`
- Currently live old Calendly destination: `https://calendly.com/herzenco/xyren-discover`
- Brand source: `docs/design-system/Herzen-Co-logo-system.pdf`

## Known Issues

1. **Calendly update is not in production `main`.** Commit `06494b3` changed 11 links to `herzen-co-intro-call` and was temporarily deployed, but it was never merged. The live site reverted to `xyren-discover` after the August 25 main deployment.
2. **Preview deployments lack OCC content variables.** Git-triggered previews fail in `npm run sync-content` because `OCC_CONTENT_API_URL` and `OCC_CONTENT_API_TOKEN` are not configured for Preview.
3. **The QA workflow may be nonfunctional for the same environment reason.** It pulls Preview configuration and builds the project, so missing OCC/Mixpanel Preview values can block it.
4. **Apex redirect status is still `307`.** Vercel's domain-level redirect executes before the source-controlled permanent redirect in `vercel.json`. Canonical signals are now correct, but the external redirect is temporary rather than permanent.
5. **`llms.txt` contains `hello@herzenco.com`.** The rest of the current site and project rules use `hello@herzenco.co`; this appears to be stale public metadata.
6. **Inquiry documentation is stale.** `docs/operational-command-center-inquiry-integration.md` describes a proposed HMAC `/api/v1/inquiries` contract, but the current implementation authenticates with `OCC_INTEGRATION_EMAIL`/`OCC_INTEGRATION_PASSWORD` and posts to OCC `/leads`.
7. **The analytics tracking plan is incomplete.** `AGENTS.md` lists only five current events, while `assets/js/main.js` implements additional active-time, resource, navigation, outbound, and mobile-menu events.
8. **`PROJECT-BRIEF.md` describes a separate Herzen Analytics Hub.** It is not the architecture of this static website and can mislead a future agent unless clearly separated or moved.
9. **Resources are empty.** The integration works and correctly builds an empty state, but no published articles were returned during the latest recorded production builds.
10. **Google Ads account-side review is still required.** The destination/canonical site issue is fixed, but ad approval or destination re-review must occur in Google Ads.

## Next Steps (prioritized)

1. Merge or reapply commit `06494b3` onto current `main`, run all tests, deploy, and verify all live Calendly links use `herzen-co-intro-call`.
2. Correct `llms.txt` from `hello@herzenco.com` to `hello@herzenco.co` and add a regression assertion.
3. Update `docs/operational-command-center-inquiry-integration.md` to match the implemented token-authenticated `/auth/token` + `/leads` workflow.
4. Expand `AGENTS.md` so its Mixpanel tracking plan includes every event currently emitted by `assets/js/main.js`.
5. Configure Preview-scoped OCC and Mixpanel variables, then verify both Git previews and the `development` QA workflow.
6. Decide whether to change the Vercel apex-domain redirect from `307` to a permanent redirect at the domain-management layer.
7. Request or re-run Google Ads destination review for the Free Delivery Map final URL.
8. Verify all Mixpanel events in the Development project's Live View and Reports before changing or expanding production reporting.
9. Publish and unpublish one controlled OCC resource article to validate the full production listing/page/sitemap lifecycle.
10. Move or clearly label `PROJECT-BRIEF.md` if the Analytics Hub remains a separate project.

## Session Log

### Session #1 — 2026-08-25
**Agent:** Codex  
**Branch / Commit:** `codex/fix-google-ads-canonical` / `8ddbfa6` (`origin/main`)  
**Summary:** Created the first comprehensive website work log from all observable Git, journal, report, source, test, configuration, and deployment evidence. Distinguished current production behavior from branch-only, superseded, temporarily deployed, and reverted work.

**Done:**

- Documented the current site architecture, routes, integrations, analytics, environment variables, validation, and deployment state.
- Reconstructed the complete chronology from June 23 through August 25, 2026.
- Recorded all visible Git commits and their relationship to current `main`.
- Recorded deployment successes, failures, blockers, and mitigations.
- Confirmed the live Free Delivery Map currently uses the old `xyren-discover` Calendly destination because `06494b3` was never merged.
- Added known issues and prioritized next steps for a cold handoff.

**Decisions:**

- Used the exact user-requested filename `Codex-work.md`.
- Treated Git and recorded evidence as authoritative; historical work with unclear final disposition is labeled as local, branch-only, superseded, or unknown rather than presented as current production.

**Files changed:** `Codex-work.md`

**Blocked / Open questions:**

- Whether the intended `herzen-co-intro-call` Calendly destination should now be restored to production.
- Whether Preview should receive OCC credentials or intentionally continue to fail closed.
