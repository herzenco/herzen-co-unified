# Herzen Analytics Hub — Project Brief

## What we are building

A standalone analytics hub that brings performance data from all Herzen-operated properties into one normalized reporting system. It will give human operators and authorized agents, including Lupe, reliable evidence about traffic, engagement, content performance, and lead generation.

The platform reports facts and trends. It does not make editorial decisions, publish content, or change live content automatically.

## Initial scope

The first property is **Herzen Co.**

- Website: `herzenco.co`
- Mixpanel project: `4047259`
- Primary goal: lead generation
- Attribution: same browsing session
- Reporting cadence: daily

## How it works

1. A daily job imports the previous three days of Mixpanel events so late-arriving data is included.
2. Events are processed transiently and converted into anonymous daily aggregates.
3. Supabase stores property, content, traffic, engagement, conversion, synchronization, report, authorization, and audit records.
4. Reports provide yesterday, rolling 7-day, rolling 30-day, and prior-period comparisons.
5. The dashboard, REST API, and MCP tools expose the same scoped reporting data.
6. Authorized agents can use the evidence to propose content drafts or revisions, but every proposal requires human review.

## Technology

- Next.js 16 and TypeScript
- Vercel hosting and daily cron
- Supabase Postgres and SSR authentication
- Mixpanel Raw Event Export API
- REST and MCP reporting interfaces

## Privacy and security boundaries

- Store anonymous daily aggregates, not raw visitor events.
- Never retain IP addresses, names, emails, form messages, or service-account secrets in analytics records.
- Keep Supabase secret credentials server-only.
- Restrict each agent to approved properties and read-only scopes.
- Preserve historical reports when an integration is unavailable or returns malformed data.
- Never allow the analytics platform or an agent to publish content directly.

## Current progress

- Branded analytics dashboard implemented with the Herzen Co. design system.
- Initial Supabase schema and Herzen Co. property seed created.
- Reporting-window logic and automated tests implemented.
- Supabase publishable connection and SSR session-refresh proxy configured.
- Supabase Auth endpoint verified successfully.
- Linting, type checks, tests, and production build pass.

## Still to do

1. Add the server-side Supabase secret and apply the database migration.
2. Add the Mixpanel service-account credentials and confirm the project region.
3. Build and verify the idempotent three-day Mixpanel ingestion pipeline.
4. Generate the first daily report from real aggregates.
5. Replace dashboard placeholders with live reporting data.
6. Add scoped REST endpoints and matching read-only MCP tools.
7. Run one complete daily reporting cycle with Lupe in observation mode.

## Immediate next step

Connect Mixpanel and the server-side Supabase credentials, apply the migration, and validate the first three-day import without storing raw visitor identifiers.
