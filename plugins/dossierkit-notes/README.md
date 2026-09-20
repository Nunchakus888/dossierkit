# DossierKit Notes plugin

One writing Skill, the same remote MCP, three tools. Requires the DossierKit Notes 1.5 server for SVG assets. No local image renderer or model API key is needed by the client.

## Configure your instance

The source package intentionally contains no active destination. In a copy of this directory:

```sh
node configure.mjs --url https://YOUR-NOTES-MCP/api/mcp
```

This writes portable `mcp.json` and the thin `.mcp.json` Codex compatibility file. It does not change the Skill. Do not point another user's plugin at the original author's private server; deploy/configure your own instance and authorize your own GitHub repository.

## Codex and other MCP clients

Install the plugin using a supported local or repository marketplace. The repository catalog is `.agents/plugins/marketplace.json`. Older clients can install `skills/publish-note/` as a Skill and configure the same remote MCP separately. For Codex's standalone MCP connection:

```sh
codex mcp add dossierkit-notes --url https://YOUR-NOTES-MCP/api/mcp
codex mcp login dossierkit-notes
```

Keep only one active connection to this endpoint in a client to avoid duplicate tools. The client manages its OAuth grant and tool confirmations. Refresh tool discovery after a server upgrade. Native plugin loading and marketplace availability vary by client/version; the standalone MCP + Skill path is the compatibility fallback.

## ChatGPT Web

Register the remote endpoint in ChatGPT's developer-mode plugin connections and complete OAuth. Use that real connection's technical ID to prepare the binding:

```sh
node configure.mjs --url https://YOUR-NOTES-MCP/api/mcp --app-id YOUR_REGISTERED_CONNECTION_ID
```

Then use the host's plugin authoring/install flow (such as its plugin-creator) to import this directory/Skill and the registered connection. The generated `.app.json` is a connection reference, not a credential. A downloaded ZIP does not automatically install itself in a web account or transfer a Codex login. Do not fabricate a connection ID or store OAuth tokens in the package. Public-directory listing requires the platform's submission/review process; packaging alone is not publication.

## Content contract

`assets` maps flat SVG filenames to source. `cover.svg` is the share cover; use `asset:name.svg` only when an image belongs in the body. Omitted files stay; same names update; null deletes unreferenced files. See the Skill for the compact static SVG dialect and read-before-edit workflow. The MCP commits a complete note package once; the existing website CI rasterizes only the cover and emits OG metadata. No share object or asset manifest is required.

## Verification

The repository tests validate configuration generation, package contents, Skills frontmatter, MCP wire schema and SVG publishing semantics. Client installation and authenticated write testing must also be performed in the actual destination account; this package does not claim universal client certification.

Sources: https://agent-plugins.org/schemas/1.0.0/plugin.schema.json · https://agent-plugins.org/schemas/1.0.0/mcp.schema.json · https://agentskills.io/specification · https://developers.openai.com/plugins/build/plugins · https://developers.openai.com/codex/mcp
