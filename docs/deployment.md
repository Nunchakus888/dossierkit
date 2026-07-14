# Deployment

DossierKit is a static Astro project and can deploy to Cloudflare Pages, Vercel, or Netlify.

## Current automation

This repository includes two GitHub Actions workflows:

- `.github/workflows/ci.yml`: validates the active profile, builds the static site, generates Pagefind, and uploads `dist` as an artifact on every push to `main` and pull request.
- `.github/workflows/deploy-cloudflare-pages.yml`: deploys `dist` to Cloudflare Pages on every push to `main`; it also supports manual dispatch for redeploys.

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

## Cloudflare Pages setup

Create a Cloudflare Pages project named `dossierkit` with production branch `main`.

```bash
pnpm dlx wrangler pages project create dossierkit --production-branch main
```

Then configure GitHub secrets and variables:

```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
gh variable set CLOUDFLARE_PROJECT_NAME --body dossierkit
```

The API token needs Cloudflare Pages edit access for the account.

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
