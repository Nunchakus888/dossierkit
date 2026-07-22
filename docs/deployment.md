# Deployment

DossierKit is a static Astro project and can deploy to Cloudflare Pages, Vercel, or Netlify.

## Current automation

This repository uses one GitHub Actions workflow:

- `.github/workflows/ci.yml`: tests the Notes write contract, validates the active profile, builds the static site and Pagefind index, and deploys to Cloudflare Pages on every push to `main`. Pull requests run the same checks without deployment, and manual dispatch supports redeployment.

## Build command

```bash
pnpm install --frozen-lockfile
ACTIVE_PROFILE=default pnpm validate
ACTIVE_PROFILE=default pnpm build
```

## Output directory

```text
dist
```

## Environment variables

```text
ACTIVE_PROFILE=default
DEFAULT_LOCALE=zh
PUBLIC_SITE_URL=https://your-domain.example
GITHUB_REPOSITORY=owner/dossierkit
```

For the canonical Notes MCP, also configure the variables documented in `docs/notes-mcp.md`. The ChatGPT-facing deployment uses Cloudflare Access Managed OAuth and validates the signed Access identity at the origin.

## Cloudflare Pages setup

Create a Cloudflare Pages project named `dossierkit` with production branch `main`.

```bash
pnpm dlx wrangler pages project create dossierkit --production-branch main
```

Then configure GitHub secrets and variables:

```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCESS_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set NOTES_ACCESS_EMAIL
gh variable set CLOUDFLARE_PROJECT_NAME --body dossierkit
```

`CLOUDFLARE_API_TOKEN` needs Cloudflare Pages Write permission. `CLOUDFLARE_ACCESS_API_TOKEN` is independently scoped to Access Apps and Policies Write, Access Identity Providers Write, and Access Organizations Write permissions for the account.

After that, every push to `main` will validate, build, and deploy automatically.

For a manual redeploy, run the `Deploy Cloudflare Pages` workflow from GitHub Actions and provide:

```text
active_profile=default
site_url=https://your-domain.example
```

## Manual Cloudflare deploy

```bash
ACTIVE_PROFILE=default PUBLIC_SITE_URL=https://your-domain.example pnpm build
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... pnpm dlx wrangler pages deploy dist --project-name sunionpeaks --branch main
```

## PDF resumes

Generate PDFs after the site builds:

```bash
pnpm dossier generate-pdf --skip-build
```

The script writes PDFs to:

```text
public/resumes
dist/resumes
```

## Search

`pnpm build` runs Pagefind after Astro build. The index is written to:

```text
dist/pagefind
```
