# CMS Guide

DossierKit uses Decap CMS at `/admin`.

## Generate config

```bash
GITHUB_REPOSITORY=owner/dossierkit ACTIVE_PROFILE=default pnpm dossier generate-admin-config
```

This writes:

```text
public/admin/config.yml
```

The generated config includes:

- profile YAML editing
- experience, education, skills, roles, metrics, theme, resume, home, and design config editing
- Chinese and English case creation
- Chinese and English lab creation
- Chinese and English writing creation
- asset uploads to `profiles/{profileId}/assets`
- navigation menu editing through `navigation.yaml`
- hero, quick links, and contact strip editing through `design.yaml`

## Local backend

For local CMS testing, run:

```bash
npx decap-server
pnpm dev
```

Then open `/admin`.

## Production protection

Production `/admin` uses Decap CMS with the GitHub backend and a Cloudflare Pages Functions OAuth proxy.

Create a GitHub OAuth App:

- Homepage URL: `https://dossierkit.pages.dev`
- Authorization callback URL: `https://dossierkit.pages.dev/api/callback`

Configure Cloudflare Pages production environment variables:

```text
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
```

The generated `public/admin/config.yml` points Decap at:

```yaml
backend:
  name: github
  base_url: https://dossierkit.pages.dev
  auth_endpoint: api/auth
```

Do not use `https://api.netlify.com/auth` for Cloudflare Pages deployments. That endpoint only works for Netlify-managed OAuth and returns Not Found for `dossierkit.pages.dev`.

For private repositories, keep the Decap scope as `repo`. Also consider Cloudflare Access in front of `/admin` if the admin UI itself should not be publicly reachable.
