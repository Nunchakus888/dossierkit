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

## CLI

```bash
pnpm dossier create-profile you
pnpm dossier validate
pnpm dossier generate-admin-config
pnpm dossier generate-pdf
pnpm dossier export-profile
```

## Deployment

CI is configured in `.github/workflows/ci.yml`. Cloudflare Pages deployment is configured as a manual GitHub Actions workflow in `.github/workflows/deploy-cloudflare-pages.yml`.

Configure `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_PROJECT_NAME`, then run the deploy workflow.

See `docs/` for schema, content, CMS, deployment, and privacy guidance.
