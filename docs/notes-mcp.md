# Canonical Notes MCP

The Notes MCP provides one write action from ChatGPT to the canonical website content. It does not accept URLs, download links, source copies, or a caller-controlled slug.

## Single source of truth

The only maintained note is:

```text
profiles/{profileId}/content/{locale}/notes/{generated-slug}.mdx
```

ChatGPT is the authoring surface, GitHub `main` stores the canonical MDX, and the website is a generated view. Git history provides versioning and rollback without creating a second maintained document.

## Tool contract

`save_note` accepts:

- one finished Markdown document with exactly one level-one title;
- optional topics extracted from the content;
- `research`, `learning`, or `engineering` as the note kind.

The tool rejects unknown fields, including `slug` and destination paths. The server extracts the title and language, generates the summary and natural slug, calculates the content hash, resolves deterministic collisions, and writes the canonical file.

Slug generation follows these rules:

1. Treat the canonical H1 title as the stable identity; body edits never change the URL.
2. Preserve technical terms in title order and map common Chinese engineering concepts to concise English terms.
3. Use pinyin only when the title contains no stable technical term.
4. Limit the result to six meaningful tokens and 72 characters.
5. Add a deterministic title fingerprint only when two different notes resolve to the same slug.
6. Repeated saves with the same title resolve to the same file; identical content creates no commit.

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
4. Scan the app and enable `save_note`.

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

Use a fine-grained GitHub token restricted to the selected repository with Contents read/write permission. `NOTES_MCP_TOKEN` protects the existing direct endpoint; ChatGPT uses the Access-managed OAuth endpoint. The CI workflow provisions the isolated Pages project, Zero Trust organization, one-time PIN provider, MCP application, owner policy, OAuth settings, runtime secrets, and deployment.

## Authoring instruction

Use this durable instruction for ChatGPT research workflows:

```text
When the research note is complete, call save_note with one polished Markdown document.
Use exactly one H1 title and H2-H4 sections. Extract three to six concrete topics from
the content. Do not propose, send, or mention a slug or repository path. The Notes MCP
owns identity, file location, deduplication, and publication.
```

## Local verification

```bash
pnpm test:notes
ACTIVE_PROFILE=default pnpm validate
ACTIVE_PROFILE=default pnpm build
```

Local MCP requests may run without `NOTES_MCP_TOKEN`; non-local requests fail closed when neither Access identity nor the configured bearer token is present.
