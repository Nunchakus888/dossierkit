# DossierKit

DossierKit is a data-driven, bilingual, Git-backed expert dossier template. Replace `profiles/{profileId}` to generate a complete static expert website, PDF resumes, `profile.json`, `llms.txt`, a Decap CMS admin panel, and a Pagefind search index.

## Quick Start

```bash
pnpm install
ACTIVE_PROFILE=default pnpm validate
ACTIVE_PROFILE=default pnpm build
pnpm dev
```

Open `/zh`, `/en`, and `/admin`.

## Canonical Notes

Research notes live under `profiles/{profileId}/content/{locale}/notes` and publish at `/{locale}/notes`. The remote `save_note` MCP action accepts a finished Markdown note, generates a stable natural slug from its H1 title, and writes the only maintained copy directly to GitHub. URLs, download links, caller-provided slugs, and duplicate source files are rejected.

See `docs/notes-mcp.md` for the tool contract, runtime configuration, and ChatGPT setup boundary.

## CLI

```bash
pnpm dossier create-profile you
pnpm dossier validate
pnpm dossier generate-admin-config
pnpm dossier generate-pdf
pnpm dossier export-profile
```

## Deployment

CI and Cloudflare Pages deployment are configured in `.github/workflows/ci.yml`.

Configure `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_PROJECT_NAME`, then run the deploy workflow.

See `docs/` for schema, content, CMS, deployment, and privacy guidance.
