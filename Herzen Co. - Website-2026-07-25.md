# Herzen Co. - Website — 2026-07-25

## Summary

Expanded the consent-gated Mixpanel instrumentation across the marketing site and verified the implementation locally. Analytics payloads remain anonymous and exclude direct personal information.

## Change History

- 17:31 EDT — Expanded Mixpanel event coverage for navigation, outbound links, mobile-menu interactions, inquiry starts, resource opens, active-time milestones, and completed resource reads. Updated `assets/js/main.js` and `tests/site.test.mjs`.
- The current working tree also contains uncommitted website, styling, build-script, content, and test changes, plus new glossary and image assets. Their individual timestamps are unavailable from Git status; this report does not attribute them to July 25 beyond the recorded analytics work.

## Git Activity

- Branch: `main` tracking `origin/main` (`https://github.com/herzenco/herzen-co-unified.git`).
- No commits on July 25; the latest observable commit is `dc6159e` (2026-07-22), “Refine Resources page copy (#4)”.
- No pushes observed today.
- Uncommitted changes are present in the working tree.

## Decisions

- Event coverage is consent-gated and anonymous. Event payloads include page and content context, but omit names, email addresses, and form messages to preserve the project’s analytics privacy requirements.

## Validation

- `node --check assets/js/main.js` succeeded.
- `npm test` completed successfully: 13 passed, 0 failed.
- `git diff --check` found no whitespace errors.

## Outstanding Work

- Verify the added events in Mixpanel Development Live View and Reports before production use, as required by the project tracking plan.
- Review and commit the existing working-tree changes when ready.

## Sources

- `.codex/work-journal/2026-07-25.jsonl` (recorded 17:31 EDT change and validation events).
- Local Git status, branch, remotes, log, and reflog inspected during finalization.
