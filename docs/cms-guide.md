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

Protect `/admin` with GitHub OAuth in Decap and Cloudflare Access or your hosting provider's access-control layer.
