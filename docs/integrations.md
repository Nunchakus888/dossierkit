# Interactions and assisted sharing

The existing `ci.yml` remains the only production build/deployment workflow. Notes stay in Git; comments and analytics never modify Notes or trigger a site deployment. No X API, GoatCounter, custom account system, or interaction database is used.

## Configuration

Optional configuration lives in `profiles/<id>/integrations.yaml`. Missing configuration disables all integrations. `pnpm generate-admin-config` and `pnpm dossier generate-admin-config` include an **Integrations** editor in Decap when this file exists. Notes themselves remain editable through the canonical MCP/Git workflow; HTML Notes are not routed through a Markdown editor.

- `productionOrigin` is a bare HTTPS origin. Browser integrations only activate on this origin.
- `instanceRepository` binds assisted sharing to the production repository. Fork builds do not operate on the source instance.
- `siteId` is stable across title/domain changes. Each discussion uses `siteId:profileId:noteRef` with giscus `specific` + strict mapping.
- `overrides` can disable comments, reader sharing or assisted sharing for one `noteRef`, supply a short social text, or preserve an old discussion key after a path migration.
- Feature configuration contains public IDs, not API secrets. Runtime interaction data does not belong in frontmatter.

## Cloudflare Web Analytics

Use `analytics.provider: cloudflare`, `mode: pages`, and an empty `token` with Pages automatic injection. Enable Web Analytics in the existing Pages project if it is not already enabled; Cloudflare injects the beacon on a subsequent deployment. This code cannot enable a Cloudflare account setting without account access.

For deployments without automatic injection, choose `mode: manual` and supply the public Web Analytics beacon token. Never put a Cloudflare API token here. The schema rejects combining Pages mode with a manual token, and the browser loader checks for an existing beacon.

Analytics remain in the Cloudflare dashboard. There is no fabricated public visit counter, custom-event reporting, or promise of UTM/click-through attribution. Preview hosts must not be registered for production tracking.

Official setup: https://developers.cloudflare.com/pages/how-to/web-analytics/

## Comments and reactions

The production source repository remains private. Before selecting `comments.provider: giscus`:

1. Select/create a **public** discussion repository, enable Discussions and a dedicated category (Announcements recommended).
2. Install the giscus GitHub App on that repository and use https://giscus.app/ to obtain `repo`, `repoId`, `category`, `categoryId`.
3. Configure those real identifiers in Integrations, then publish through the existing CI.

The component lazy-loads giscus, includes reactions, and links to GitHub Discussions if embedding is unavailable. Readers authorize giscus using GitHub, separately from Decap OAuth and Notes MCP Access. Reactions are not anonymous likes.

Place `giscus.json` in the **discussion repository**, not automatically in the private source repository:

```json
{"origins":["https://YOUR-PRODUCTION-HOST"],"defaultCommentOrder":"oldest"}
```

Changing a title or adding query parameters does not split a discussion. Changing `siteId`, `profileId`, or a filename can; preserve the prior key with an override when migrating. Repository installation/authorization is never simulated by a code-only upgrade.

Official configuration: https://giscus.app/ and https://github.com/giscus/giscus/blob/main/ADVANCED-USAGE.md

## X: reader share and author assistance

Reader share buttons open the official X editor with prefilled text or copy the canonical URL. They never send a post. Draft budgeting uses X's documented single-weight code-point ranges and reserves 23 characters for the URL; emoji sequences are conservatively overcounted and truncation preserves graphemes. Final sending and validation remain in X. No new package dependency is required.

The separate `social-assist.yml` **does not install dependencies, build, or deploy**. It runs after successful push-to-main CI or from Actions → Social assist → Run workflow.

`prepare` validates the upstream CI and its immutable `notes-publication` artifact, scans the complete deployed Notes list, verifies canonical URL + identity + recomputed publication fingerprint, then creates/refreshes a private `[待分享 X]` Issue. `baselineSha` excludes all pre-existing Notes. Closed Issues and human-confirmed results are terminal. Updates retain the Issue and human notes; changed text invalidates the draft hash. Creation commits and deployed commits are recorded separately.

Issues created by this workflow are the durable task ledger. Do not delete them or edit their machine marker. A missing baseline, duplicate managed records, wrong artifact, or incomplete scan fails closed. A POST timeout is not immediately retried; the next full Issue scan checks for an already-created task first.

After sending manually, run `confirm` with the Issue number, its current draft hash and actual X post URL. This records `published_manual` and closes the Issue; it does not claim API verification. `skip` records an intentional skip. Simply opening the editor is never treated as success. Manually closing a task prevents it being reopened automatically.

`maxPerRun` bounds new/refreshed drafts. Re-run `prepare` for backlog or transient URL failures. There is no background polling by default. Artifacts are retained for 90 days; after expiry, use a fresh successful production CI. Disabled/deleted articles must not be shared from an old draft: always check the article before sending.

The workflow only receives the normal GitHub token with contents/actions read and Issues write. It never receives Cloudflare, Notes MCP or X credentials. `workflow_run` artifacts are treated as bounded JSON data, not executable code.

## Checks

- `pnpm test:notes` — existing canonical Notes checks.
- `pnpm test:integrations` — configuration, identity, URL guards, baseline, duplicate prevention, conservative text budgeting and mocked Issue workflows.
- `pnpm build` — the single static build also generates `_meta/notes.json` and article identity metadata.
- CI uploads that exact manifest only after both existing deployments succeed.

On production, inspect a real Notes page for share buttons, matching canonical/identity metadata and (when configured) the giscus frame. Check that exactly one Cloudflare beacon is injected. A 200 response or a giscus component in source alone does not prove the integrations are active.
