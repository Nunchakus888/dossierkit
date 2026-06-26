# Deployment

DossierKit is a static Astro project and can deploy to Cloudflare Pages, Vercel, or Netlify.

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
