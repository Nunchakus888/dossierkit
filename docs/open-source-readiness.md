# Public template and private production instance

This upgrade adds optional, isolated integrations; it does not change repository visibility or publish personal profiles/history.

A public template should be exported as a new clean repository from an explicit allowlist of runtime code, scripts, workflows and sanitized examples. Keep the production instance and author-sharing Issues private. The existing production `ci.yml` remains its sole deployment entry point.

Before a public release:

- Supply a sanitized profile and assets; do not copy `profiles/default`, resumes, personal project archives or Git history wholesale.
- Replace hard-coded production origins/repository defaults in the existing core config and deployment workflow. Check generated CMS configuration as well as source.
- Default all integrations off. Each installation must configure its own OAuth App, Access settings, Cloudflare project, discussion repository and analytics identifiers.
- Keep CI validation/build usable without production credentials; explicitly gate optional production deployment and MCP provisioning in the distributable template.
- Select a code license with the owner and document content/media licenses separately. Public visibility alone is not an open-source license.
- Scan the complete export and history for secrets. Never publish an artifact containing environment variables or credentials. A prior leaked credential must be revoked, not merely deleted from the latest revision.

The new integration schema supports a missing config, and browser origin/repository guards prevent copies of the source instance from using its configured interactions. These guards do not replace the export review above.
