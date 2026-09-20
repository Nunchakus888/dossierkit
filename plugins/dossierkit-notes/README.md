# DossierKit Notes plugin

One authoring Skill, one remote MCP contract, and the same three note tools in Codex and ChatGPT. The Skill covers source research, canonical-note consolidation, formal writing, SVG artwork, publication, and revision. DossierKit Notes 1.5 or newer is required for SVG assets. The client needs neither a local image renderer nor a model API key.

## Canonical endpoint

The repository package is ready to use with the canonical production endpoint:

```text
https://dossierkit-notes-mcp.pages.dev/api/mcp
```

The same endpoint is declared in portable `mcp.json`, Codex `.mcp.json`, and the Skill's `agents/openai.yaml` dependency. Installing the repository plugin therefore loads both the Skill and the MCP connection.

To target another deployment, configure a copy of the package:

```sh
node configure.mjs --url https://YOUR-NOTES-MCP/api/mcp
```

The command rewrites all three endpoint declarations together. The writing instructions remain identical across products. Independent deployments should authorize their own GitHub repository and users.

## Codex and ChatGPT use the same configured package

Use the same configured package for both Codex and ChatGPT. Codex loads the packaged Skill and MCP definition. ChatGPT binds the package to the registered connection identified by `.app.json`. The endpoint, tool workflow, Skill, references, and plugin metadata remain the same; each client completes its own OAuth grant.

For Codex local development, install the plugin from a supported local or repository marketplace. The repository catalog is `.agents/plugins/marketplace.json`. Keep the plugin as the only active registration for this endpoint.

Clients without plugin support can use the compatibility path below, but it must not be enabled alongside the plugin:

```sh
codex mcp add dossierkit-notes --url https://YOUR-NOTES-MCP/api/mcp
codex mcp login dossierkit-notes
```

Install `skills/publish-note/` separately only in that compatibility mode. The client manages its OAuth grant and tool confirmations. Refresh tool discovery after a server upgrade.

## ChatGPT Web

Register the remote endpoint in ChatGPT's developer-mode plugin connections and complete OAuth. Use that real connection's technical ID to prepare the binding:

```sh
node configure.mjs --url https://YOUR-NOTES-MCP/api/mcp --app-id YOUR_REGISTERED_CONNECTION_ID
```

Then use the host's plugin authoring or install flow to import the configured package and registered connection. The generated `.app.json` is a connection reference, not a credential. A downloaded ZIP does not install itself in a web account or transfer a Codex login. Use the exact registered connection ID and keep OAuth tokens outside the package. Public-directory listing follows the platform's submission and review process.

## Content contract

`assets` maps flat SVG filenames to source. `cover.svg` is the share cover; use `asset:name.svg` only when an image belongs in the body. Omitted files stay, same names update, and `null` deletes unreferenced files. The Skill contains the research and publication workflow, while its references hold the detailed evidence and visual rules. The MCP commits a complete note package once; the existing website CI rasterizes only the cover and emits OG metadata. No share object or asset manifest is required.

## Verification

The repository tests validate one-endpoint configuration generation, package contents, Skill frontmatter, MCP wire schema, and SVG publishing semantics. Client installation and authenticated write testing still run in the actual destination account.

Sources: https://agent-plugins.org/schemas/1.0.0/plugin.schema.json · https://agent-plugins.org/schemas/1.0.0/mcp.schema.json · https://developers.openai.com/plugins/build/plugins · https://developers.openai.com/plugins/build/skills
