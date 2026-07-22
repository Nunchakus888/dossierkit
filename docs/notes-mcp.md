# Canonical Notes MCP

The Notes MCP connects ChatGPT authoring directly to the canonical website content. It accepts completed Markdown, not download URLs or source copies.

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

For creation, `save_note` accepts one finished Markdown document with exactly one H1, optional topics and kind, and `suggestedSlug`. ChatGPT derives `suggestedSlug` semantically from the complete note. The API validates its lowercase hyphenated form, resolves path collisions, and freezes the resulting `noteRef`.

For updates, the model calls `get_note`, edits the returned Markdown, and sends it to `save_note` with the unchanged `noteRef`. The title may change without moving the file or public URL. Existing date, featured state, kind, and topics are preserved when the update omits them.

The service also protects identity in two ways:

1. A new save with the same normalized title reuses the existing file even if the model proposes a different `suggestedSlug`.
2. An identical content hash returns `unchanged` and creates no commit.

The Function does not call a second language model. ChatGPT supplies semantic parameters through the MCP schema; the API handles authentication, validation, identity, persistence, and deterministic retries.

## ChatGPT web connection

The ChatGPT-facing endpoint is isolated from the public website:

```text
https://dossierkit-notes-mcp.pages.dev/api/mcp
```

Cloudflare Access provides OAuth discovery, dynamic client registration, PKCE authorization, short-lived access tokens, and refresh tokens. The MCP origin validates the signed `Cf-Access-Jwt-Assertion` before accepting a request. One-time PIN login is restricted to the configured owner email.

In ChatGPT web:

1. Enable Developer mode in **Settings → Security and login**.
2. Open **Settings → Plugins**, create an app, and enter the endpoint above.
3. Complete the Cloudflare email authorization once.
4. Refresh or scan the app and enable `get_note` and `save_note`.

ChatGPT requests confirmation before the write action. The OAuth grant lasts up to two weeks and refreshes 15-minute access tokens without routine interaction.

## Runtime configuration

Set the following Cloudflare Pages production variables:

```text
NOTES_MCP_TOKEN
NOTES_GITHUB_TOKEN
NOTES_GITHUB_REPOSITORY=Nunchakus888/dossierkit
NOTES_GITHUB_BRANCH=main
NOTES_PROFILE_ID=default
PUBLIC_SITE_URL=https://sunionpeaks.pages.dev
```

The isolated MCP project additionally receives:

```text
NOTES_ACCESS_AUD
NOTES_ACCESS_ISSUER
NOTES_ACCESS_EMAIL
```

Use a fine-grained GitHub token restricted to the selected repository with Contents read/write permission. `NOTES_MCP_TOKEN` protects the direct endpoint; ChatGPT uses the Access-managed OAuth endpoint. The CI workflow provisions the isolated Pages project, Zero Trust configuration, runtime secrets, and deployment.

## Authoring instruction

Use this durable instruction for ChatGPT research workflows:

```text
When creating a finished note, call save_note with one polished Markdown document,
exactly one H1, three to six concrete topics, and a concise semantic suggestedSlug.
When editing a note, call get_note first, revise the returned Markdown, and call
save_note with the unchanged noteRef. Never invent noteRef or a repository path.
```

## Local verification

```bash
pnpm test:notes
ACTIVE_PROFILE=default pnpm validate
ACTIVE_PROFILE=default pnpm build
```

Local MCP requests may run without `NOTES_MCP_TOKEN`; non-local requests fail closed when neither Access identity nor the configured bearer token is present.
