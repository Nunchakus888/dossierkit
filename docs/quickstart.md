# Quickstart

DossierKit is a static, Git-backed expert dossier template. A profile is a folder under `profiles/{profileId}`.

## Install

```bash
pnpm install
```

## Validate the default profile

```bash
ACTIVE_PROFILE=default pnpm validate
```

## Run locally

```bash
ACTIVE_PROFILE=default pnpm dev
```

Open:

- `/zh`
- `/en`
- `/zh/cv`
- `/admin`

## Build

```bash
ACTIVE_PROFILE=default pnpm build
```

The build outputs:

- static HTML under `dist/`
- `profile.json`
- `llms.txt`
- `sitemap.xml`
- Pagefind index under `dist/pagefind`

## Create a new profile

```bash
pnpm dossier create-profile you
ACTIVE_PROFILE=you pnpm validate
ACTIVE_PROFILE=you pnpm build
```

Only edit files under `profiles/you` when creating a new person.
