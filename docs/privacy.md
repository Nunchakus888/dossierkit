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

## Public view counter

The first-party `/api/views` endpoint stores only cumulative and daily aggregate counts by published article ID. It does not persist IP addresses, visitor identifiers, referrers, device data, query strings, cookies, or per-visit logs. The request body contains a public page path and public article IDs only. Existing Cloudflare Web Analytics remains a separate integration.

The counter is disabled on previews, admin and missing pages. Failed/unconfigured counters stay hidden. To opt out on the current browser, set `localStorage.setItem('dossierkit:views:exclude', '1')`; remove it to resume counting. This setting applies only to the first-party counter, not to Cloudflare Web Analytics. Global Privacy Control, Do Not Track and automated browser contexts use read-only requests. Counts represent browser page loads, not unique people or verified reading.
