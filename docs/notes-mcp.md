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

Use a fine-grained GitHub token restricted to the selected repository with Contents read/write permission. The MCP bearer token must be a separate high-entropy secret. The public endpoint stays disabled when `NOTES_MCP_TOKEN` is missing.

The deployed MCP endpoint is:

```text
https://sunionpeaks.pages.dev/api/mcp
```

ChatGPT full MCP write actions currently require an eligible Business or Enterprise/Edu workspace and may request user confirmation. Register the remote endpoint as a private custom app, configure its authentication, scan the tools, and enable only `save_note`.

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

Local MCP requests may run without `NOTES_MCP_TOKEN`; non-local requests fail closed when the token is absent.
