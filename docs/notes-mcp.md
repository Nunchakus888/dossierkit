# Canonical Notes MCP

The Notes MCP connects ChatGPT and Codex authoring directly to the canonical website content. It accepts completed Markdown or safe semantic HTML, not download URLs or source copies.

## Single source of truth

The only maintained note is:

```text
profiles/{profileId}/content/{locale}/notes/{canonical-key}.{mdx|html}
```

GitHub `main` stores the canonical note file, the website is a generated view, and Git history provides versioning and rollback. The filename is the canonical path identity; note metadata does not duplicate a `slug` field.

## Tool contract

The MCP exposes three tools:

- `get_note` reads the current canonical Markdown or HTML by `noteRef`, filename, title, or title phrase.
- `save_note` creates a note or updates the exact file identified by `noteRef`.
- `delete_note` removes the exact version identified by `noteRef` and `contentHash`.

For creation, `save_note` accepts exactly one of:

- one finished Markdown document with exactly one H1;
- one semantic HTML fragment or full HTML document with exactly one H1.

The API derives a lowercase canonical key from the H1 and semantic topics, resolves path collisions deterministically, and freezes the resulting `noteRef`. Callers cannot provide a slug or repository path.

HTML is stored as a valid standalone `.html` document. The canonical file embeds DossierKit metadata and a sanitized `<article>` body. Scripts, styles supplied by the caller, forms, event handlers, unsafe URL schemes, iframes, and executable embeds are rejected. The website extracts the safe article and renders it inside the same Notes layout used by Markdown.

For updates, the model calls `get_note`, edits the returned `markdown` or `html`, and sends it to `save_note` with the unchanged `noteRef`. The title may change without moving the file or public URL. Existing date, featured state, kind, and topics are preserved when the update omits them. MCP edits preserve the original format; batch format migrations remain local repository work.

For deletion, the model calls `get_note`, presents the exact title and public URL for confirmation, then passes the returned `noteRef` and `contentHash` to `delete_note`. A stale hash fails closed, so a note changed after review cannot be deleted accidentally. Git history keeps the deletion recoverable.

The service also protects identity in two ways:

1. A new save with the same normalized title reuses the existing file instead of deriving a second path.
2. An identical content hash returns `unchanged` and creates no commit.

The Function does not call a second language model. ChatGPT supplies the polished title, body, format, and topics through the MCP schema; the API handles authentication, HTML sanitization, validation, deterministic path generation, identity, persistence, deletion, and retries.

## One plugin and one production endpoint

The canonical `dossierkit-notes` plugin gives ChatGPT and Codex the same Skill, references, MCP endpoint, tool definitions, identity policy, and persistence behavior:

```text
https://dossierkit-notes-mcp.pages.dev/api/mcp
```

Cloudflare Access provides OAuth discovery, dynamic client registration, PKCE authorization, short-lived access tokens, and refresh tokens. ChatGPT uses its registered HTTPS callback, while Codex CLI uses a temporary localhost loopback callback protected by PKCE. The MCP origin validates the signed `Cf-Access-Jwt-Assertion` before accepting a request. One-time PIN login is restricted to the configured owner email.

Each client receives its own OAuth grant. ChatGPT and Codex therefore share configuration and behavior without sharing an access token or refresh token. Both grants resolve to the same authorized identity and MCP backend; revoking one client leaves the other grant independent.

The repository plugin already declares the production endpoint consistently in portable `mcp.json`, Codex `.mcp.json`, and the `publish-note` Skill dependency. Installing it loads the Skill and the named MCP server together.

To retarget another deployment or add a ChatGPT connection mapping, configure a copy:

```bash
node plugins/dossierkit-notes/configure.mjs \
  --url https://dossierkit-notes-mcp.pages.dev/api/mcp \
  --app-id YOUR_REGISTERED_CONNECTION_ID
```

The command rewrites the endpoint consistently across all three declarations. The optional `.app.json` binds ChatGPT to the connection previously registered for that same endpoint; it contains no credential.

Install this configured package in Codex locally when needed. Import the same package and registered connection in ChatGPT for remote use. Complete OAuth separately in each client. Keep only this plugin registration active for the endpoint so the three tools appear once.

Standalone Skill plus `codex mcp add` remains a compatibility route for clients without plugin support. It replaces the plugin in that client rather than running beside it.

ChatGPT requests confirmation before write actions. Cloudflare Access handles client authorization without copying a long-lived bearer token into the package, shell, or launch environment.

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

Use MCP for a single note create, edit, or deletion. Use a freshly synchronized local repository for batch migrations, schema changes, or site-level maintenance; those changes still update the same canonical files on `main`.

Without MCP, delete a note through the repository:

```bash
git switch main
git pull --ff-only
git switch -c codex/delete-note
# Choose the extension used by the canonical file:
git rm profiles/default/content/{locale}/notes/{canonical-key}.mdx
# or: git rm profiles/default/content/{locale}/notes/{canonical-key}.html
ACTIVE_PROFILE=default pnpm validate
ACTIVE_PROFILE=default pnpm build
git commit -m "Delete note: {title}"
git push -u origin codex/delete-note
```

Open and merge the pull request. The main deployment removes the public page. The same operation is possible from GitHub's file view with **Delete file**, but the local flow provides validation before publication.

## Authoring instruction

The packaged `publish-note` Skill is the durable authoring instruction. Its core publication contract is:

```text
Open with one evidence-grounded philosophical proposition, then develop one
central technical argument in a complete Markdown or semantic HTML document with
one H1 and three to six topics. The server owns the canonical path. For edits,
read first and preserve noteRef and format. For deletion, obtain confirmation and
use the exact latest noteRef and contentHash. Create a topic-specific cover.svg
for new notes by default while preserving artwork during text-only edits.
```

## Local verification

```bash
pnpm test:notes
ACTIVE_PROFILE=default pnpm validate
ACTIVE_PROFILE=default pnpm build
```

Localhost MCP requests may run without Access for automated verification. Every non-local deployment requires a valid Cloudflare Access identity; a deployment without Access configuration does not expose the route.
