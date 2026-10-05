# DossierKit Notes

DossierKit Notes combines one canonical publishing Skill with an authenticated remote MCP service. It deep-reads technical sources, consolidates overlapping notes, drafts evidence-backed articles, creates focused SVG covers, and publishes complete note packages.

## One source, two delivery surfaces

The repository is the source of truth for every surface:

- `skills/publish-note/SKILL.md` and its supporting files define the authoring workflow.
- `mcp.json` and `.mcp.json` connect Codex and ChatGPT desktop to the production service.
- The production MCP advertises the same Skill through `io.modelcontextprotocol/skills` for ChatGPT plugin scanning and publication.

The MCP Skill catalog is generated from the packaged Skill during the build. It is never maintained as an independent copy.

The Plugin default prompts explicitly invoke `$publish-note`. MCP initialization repeats a short preflight before tool guidance: apply the Skill, read the canonical note before an edit, and distinguish a repository save from verified live publication. These routing safeguards do not duplicate the full authoring policy.

## Production endpoint

```text
https://dossierkit-notes-mcp.pages.dev/api/mcp
```

The endpoint exposes `get_note`, `save_note`, and `delete_note`. Authentication and authorization remain server-side. Each client completes its own OAuth grant; credentials are never stored in this package.

To point a desktop package copy at another deployment:

```sh
node configure.mjs --url https://YOUR-NOTES-MCP/api/mcp
```

## Install in Codex or ChatGPT desktop

Install `dossierkit-notes` from the repository marketplace at `.agents/plugins/marketplace.json`. The package supplies both the Skill and the MCP connection. Start a new task after installation so the updated instructions and tools are loaded.

Do not also register the endpoint with `codex mcp add`; that creates a duplicate MCP registration. A direct MCP registration plus a separately installed Skill is only a compatibility option for clients that cannot install plugins.

## Use in ChatGPT Web

Connect the production endpoint in ChatGPT developer mode, then use **Scan tools** in the plugin submission flow. The scan imports a static snapshot of the canonical Skill and its supporting files from the MCP server.

Repository marketplace imports that declare `mcp.json` or `.mcp.json` are desktop-only, including packages that point to a remote HTTPS server. Use the MCP scan and submission route for a Web-capable ChatGPT plugin. After changing the Skill, deploy the MCP, scan again, review the imported Skill, and submit a new plugin version.

Private workspace and public directory publication are account-level actions. They require the appropriate ChatGPT workspace role, OAuth connection, publisher identity, domain verification, and review settings; none of those credentials belong in this repository.

## Asset contract

`assets` maps flat SVG filenames to source. `cover.svg` is the sharing cover; use `asset:name.svg` only when an image belongs in the note body. Omitted files are preserved, same-name files are updated, and `null` deletes an unreferenced asset. The website keeps body SVGs as SVG and rasterizes only the sharing cover for social metadata.

## Verification

The repository verifies package contents, English-only plugin copy, Skill frontmatter, MCP Skill discovery, resource digests, tool schemas, and SVG publishing semantics. A successful note save proves a repository commit; production deployment is verified separately through CI and live URL checks.

Documentation: https://sunionpeaks.pages.dev/plugins/dossierkit-notes
