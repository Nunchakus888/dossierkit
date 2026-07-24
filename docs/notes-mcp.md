# Canonical Notes MCP

The Notes MCP connects ChatGPT and Codex authoring directly to the canonical website content. It accepts completed Markdown, not download URLs or source copies.

## Single source of truth

The only maintained note is:

```text
profiles/{profileId}/content/{locale}/notes/{canonical-key}.mdx
```

GitHub `main` stores the canonical MDX, the website is a generated view, and Git history provides versioning and rollback. The filename is the canonical path identity; note frontmatter does not duplicate a `slug` field.

## Tool contract

The MCP exposes two tools:

- `get_note` reads the current canonical Markdown by `noteRef`, filename, title, or title phrase.
- `save_note` creates a note or updates the exact file identified by `noteRef`.

For creation, `save_note` accepts one finished Markdown document with exactly one H1, plus optional topics and kind. The API derives a lowercase canonical key from the H1 and semantic topics, resolves path collisions deterministically, and freezes the resulting `noteRef`. Callers cannot provide a slug or repository path.

For updates, the model calls `get_note`, edits the returned Markdown, and sends it to `save_note` with the unchanged `noteRef`. The title may change without moving the file or public URL. Existing date, featured state, kind, and topics are preserved when the update omits them.

The service also protects identity in two ways:

1. A new save with the same normalized title reuses the existing file instead of deriving a second path.
2. An identical content hash returns `unchanged` and creates no commit.

The Function does not call a second language model. ChatGPT supplies the polished title, body, and topics through the MCP schema; the API handles authentication, validation, deterministic path generation, identity, persistence, and retries.

## One production endpoint

ChatGPT web and Codex CLI use the same endpoint, tool definitions, identity policy, and persistence code:

```text
https://dossierkit-notes-mcp.pages.dev/api/mcp
```

Cloudflare Access provides OAuth discovery, dynamic client registration, PKCE authorization, short-lived access tokens, and refresh tokens. ChatGPT uses its registered HTTPS callback, while Codex CLI uses a temporary localhost loopback callback protected by PKCE. The MCP origin validates the signed `Cf-Access-Jwt-Assertion` before accepting a request. One-time PIN login is restricted to the configured owner email.

Each client receives its own OAuth grant. ChatGPT and Codex therefore do not share an access token or refresh token, but both grants resolve to the same authorized identity and the same MCP backend. Revoking one client does not invalidate the other.

In ChatGPT web:

1. Enable Developer mode in **Settings → Security and login**.
2. Open **Settings → Plugins**, create an app, and enter the endpoint above.
3. Complete the Cloudflare email authorization once.
4. Refresh or scan the app and enable `get_note` and `save_note`.

ChatGPT requests confirmation before the write action. The OAuth grant lasts up to two weeks and refreshes 15-minute access tokens without routine interaction.

For Codex CLI:

```bash
codex mcp remove dossierkit-notes
codex mcp add dossierkit-notes --url https://dossierkit-notes-mcp.pages.dev/api/mcp
codex mcp login dossierkit-notes
```

The last command completes the same Cloudflare Access login through a separate OAuth grant. No long-lived bearer token needs to be copied into the shell or launch environment.

## Runtime configuration

Only the isolated OAuth MCP project receives the Notes runtime variables:

```text
NOTES_GITHUB_TOKEN
NOTES_GITHUB_REPOSITORY={owner}/{repository}
NOTES_GITHUB_BRANCH=main
NOTES_PROFILE_ID=default
PUBLIC_SITE_URL=https://{public-site}.pages.dev
NOTES_ACCESS_AUD
NOTES_ACCESS_ISSUER
NOTES_ACCESS_EMAIL
```

`NOTES_GITHUB_TOKEN` is the single backend credential shared by both client flows and is never returned to either client. Use a fine-grained GitHub token restricted to the selected repository with Contents read/write permission. The public website project receives no GitHub write credential; its `/api/mcp` route returns `404`. The CI workflow provisions the isolated Pages project, Zero Trust configuration, runtime secrets, and deployment.

Use MCP for a single note create or edit. Use a freshly synchronized local repository for batch migrations, schema changes, or site-level maintenance; those changes still update the same canonical MDX files on `main`.

## Authoring instruction

Use this durable instruction for ChatGPT research workflows:

```text
When creating a finished note, call save_note with one polished Markdown document,
exactly one H1, and three to six concrete topics. The server owns the canonical path.
When editing a note, call get_note first, revise the returned Markdown, and call
save_note with the unchanged noteRef. Never invent noteRef or a repository path.
```

## Local verification

```bash
pnpm test:notes
ACTIVE_PROFILE=default pnpm validate
ACTIVE_PROFILE=default pnpm build
```

Localhost MCP requests may run without Access for automated verification. Every non-local deployment requires a valid Cloudflare Access identity; a deployment without Access configuration does not expose the route.
