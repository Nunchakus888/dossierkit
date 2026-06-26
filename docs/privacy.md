# Privacy Guide

DossierKit is designed for public expert dossiers, but profile packs may contain sensitive information.

## Keep private data out of the repo

Do not commit:

- private phone numbers
- home addresses
- non-public customer names
- unreleased architecture diagrams
- raw production logs
- private compensation details

Use sanitized metrics and descriptions in public cases.

## Admin access

The `/admin` page is static, but CMS write access uses GitHub. Protect it with:

- GitHub OAuth
- branch protection
- Cloudflare Access or equivalent route protection

## AI-readable exports

`/profile.json` and `/llms.txt` are public exports. Anything in the active profile pack may become machine-readable. Review these files before publishing.

## Private deployments

For private job searches or confidential advisory profiles, deploy behind Cloudflare Access or a private preview URL and keep the GitHub repository private.
