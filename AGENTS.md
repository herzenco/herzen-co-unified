# Analytics Tracking — Mixpanel

This static marketing website uses Mixpanel for behavioral and conversion analytics. Vercel Web Analytics remains installed for aggregate traffic reporting. Google Tag Manager container `GTM-K9SZRQ94` is also approved and installed through the shared analytics consent flow; do not add another analytics tool without explicit user approval.

## Before adding or changing tracking

- Use the browser Mixpanel SDK loaded by `assets/js/main.js`.
- Do not initialize another Mixpanel instance.
- This project does not use a CDP.
- Analytics consent is required. No Mixpanel or Vercel event may fire before the visitor opts in.
- Review the tracking plan below and reuse existing event/property names.
- Never send names, email addresses, form messages, IP addresses, or other direct personal identifiers to Mixpanel.

## Tech stack

| Detail | Value |
|---|---|
| Platform | Static HTML/CSS/JavaScript on Vercel |
| Mixpanel SDK | Browser SDK loaded from Mixpanel’s official CDN |
| Google Tag Manager | Container `GTM-K9SZRQ94`, loaded by `assets/js/main.js` only after analytics consent |
| Tracking method | Client-side |
| CDP | None |
| Consent required | Yes; conservative EU/California consent gate |
| Token location | `.env`: `MIXPANEL_PRODUCTION_TOKEN`, `MIXPANEL_DEVELOPMENT_TOKEN` |
| Runtime config | Generated at build time as `public/assets/js/mixpanel-config.js` |
| Initialization | `assets/js/main.js` |
| Identity | Anonymous visitors only; no `identify()` or user profiles |

## Current tracking plan

All event and property names use `snake_case`.

| Event | Trigger | Key properties | File |
|---|---|---|---|
| `page_viewed` | A consented visitor opens a page | `page_path`, `page_type`, `page_title`, optional referral and UTM properties | `assets/js/main.js` |
| `scroll_depth_reached` | Visitor first reaches 25%, 50%, 75%, or 100% | `scroll_depth_percent`, page context, optional `content_slug` | `assets/js/main.js` |
| `page_engagement_completed` | Consented visitor hides or leaves after active engagement | `active_seconds`, `max_scroll_depth_percent`, page context | `assets/js/main.js` |
| `lead_cta_clicked` | Visitor clicks a contact-form or Calendly CTA | `cta_text`, `cta_location`, `destination`, page context | `assets/js/main.js` |
| `inquiry_submitted` | The website API confirms that the inquiry was delivered to the Operations Command Center | `service_interest`, page context | `assets/js/main.js` |

Global properties registered after consent:

- `platform`: always `web`
- `environment`: `development` or `production`

## Rules

- Track events only after the associated action occurs.
- Track scroll thresholds once per threshold per page.
- Active time counts only while the page is visible and focused.
- Use numeric values for `active_seconds`, `max_scroll_depth_percent`, and `scroll_depth_percent`.
- Omit unavailable properties rather than sending `null`, empty strings, or `"N/A"`.
- Do not create dynamic event names.
- Update this file whenever an event or property is added or changed.
- Verify new events in the Mixpanel Development project’s Live View and Reports before production.
