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

See `docs/` for schema, content, CMS, deployment, and privacy guidance.
