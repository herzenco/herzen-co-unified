# QA Environment

QA mirrors the Vercel production project but is fed by the `development` branch.

## Flow

1. Work lands on `development`.
2. GitHub Actions runs `Deploy QA`.
3. The workflow installs dependencies and runs `npm test`.
4. Vercel creates a preview deployment for the current `development` commit.
5. The workflow points the stable QA alias to that deployment.

## URLs

- Production: `https://herzen-co-unified.vercel.app`
- QA: `https://herzen-co-unified-qa.vercel.app`

## Required GitHub Secret

Add this repository secret in GitHub before the workflow can deploy:

- `VERCEL_TOKEN`: a Vercel token with access to the `Herzen's projects` team and the `herzen-co-unified` project.

The workflow intentionally stores non-secret Vercel IDs in source control and keeps the token in GitHub Secrets.

## Vercel Project

- Team: `Herzen's projects`
- Team slug: `herzens-projects`
- Team ID: `team_5TSOBOtfAFPyjrRDDUENfyQd`
- Project: `herzen-co-unified`
- Project ID: `prj_CsClHWJtQS79mDZE9ECdJ3fwuqzy`
